import {defineStore} from 'pinia';
import type {
  IActiveNetwork,
  IConnectedForm,
  IContractsErrors,
  IContractsForms,
  IContractsLoading,
  IContractsModal,
  IContractsStore,
  IContractsWallets,
  IExternalForm,
  IOpenReservation,
  IRpc,
  IToken,
  IVaultTokenBalance,
  IWallet,
  IWithdrawal,
  TTokenBalances
} from '@/types/contracts.ts';
import {Contract, Web3, type ContractAbi} from 'web3';
import {toast} from 'vue3-toastify';
import {
  avalancheMainnet,
  CHAINS,
  NETWORKS,
  polygonMainnet,
  THIS_YEAR_DAYS,
  TODAY_TIME
} from '@/utils/constants.ts';
import {metamaskSdk} from '@/utils/metamask.ts';
import type {
  IBlock,
  ICancelledWithdrawReservationData,
  IReservation,
  IVaultEvent,
  IWithdrawRequestData
} from '@/types/vault.ts';
import {
  bottomToast,
  formatNumberToUint256,
  formatUint256toNumber,
  isMobileChrome,
  validateAddress
} from '@/utils/helpers.ts';
import {markRaw} from 'vue';

/** Minimal ERC-20 ABI for reading a token balance */
const ERC20_BALANCE_ABI = [
  {
    inputs: [{name: 'account', type: 'address'}],
    name: 'balanceOf',
    outputs: [{name: '', type: 'uint256'}],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

/** Incremented on every vault balance read and reset, so results of a superseded read (vault or chain switched meanwhile) are dropped */
let balanceRequestSeq = 0;

/** Registry token ids never change for a token, cache them per registry */
const paymentTokenIdCache = new Map<string, number>();

const tokenKey = (address: string) => address.toLowerCase();

/** Block timestamp (seconds) loader that fetches each block once */
const makeBlockTimeLoader = (
  getBlock: (blockNumber: bigint | number) => Promise<{timestamp: unknown}>
) => {
  const cache = new Map<string, Promise<number>>();

  return (blockNumber: bigint | number) => {
    const key = String(blockNumber);

    if (!cache.has(key)) {
      cache.set(
        key,
        getBlock(blockNumber).then((block) => Number(block.timestamp))
      );
    }

    return cache.get(key)!;
  };
};

/** uint256 token amount (6 decimals) to token units; undefined stays undefined */
const toTokenUnits = (value: unknown) =>
  value === undefined ? undefined : formatUint256toNumber(BigInt(value as bigint));

/**
 * Narrow block range that contains every block whose timestamp equals `target`
 * (seconds). Searches block timestamps by alternating interpolation and
 * bisection; `blocksPerDay` only seeds the first guess. If the search can't
 * narrow below `tolerance` blocks, the returned range is wider but still
 * contains the target.
 */
export const findBlockRangeForTimestamp = async (
  getTimestamp: (block: number) => Promise<number>,
  latestBlock: number,
  target: number,
  blocksPerDay: number,
  tolerance = 500
): Promise<{from: number; to: number}> => {
  let hi = latestBlock;
  let hiTs = await getTimestamp(hi);

  if (target >= hiTs) {
    return {from: Math.max(0, hi - tolerance), to: hi};
  }

  /** Initial lower bound from the average block rate, with slack */
  const blocksPerSecond = Math.max(blocksPerDay, 1) / 86400;
  let lo = Math.max(
    0,
    hi - Math.ceil((hiTs - target) * blocksPerSecond * 1.5) - tolerance
  );
  let loTs = await getTimestamp(lo);

  /** Move the lower bound further back until it is before the target */
  for (let i = 0; loTs >= target && lo > 0 && i < 10; i++) {
    hi = lo;
    hiTs = loTs;
    lo = Math.max(0, lo - (latestBlock - lo) - tolerance);
    loTs = await getTimestamp(lo);
  }

  if (loTs >= target) {
    return {from: 0, to: Math.min(latestBlock, hi + tolerance)};
  }

  /** Invariant: timestamp(lo) < target <= timestamp(hi) */
  for (let i = 0; i < 40 && hi - lo > tolerance; i++) {
    let mid =
      i % 2 === 0
        ? lo + Math.round(((target - loTs) / (hiTs - loTs)) * (hi - lo))
        : lo + Math.floor((hi - lo) / 2);
    mid = Math.min(hi - 1, Math.max(lo + 1, mid));
    const midTs = await getTimestamp(mid);

    if (midTs < target) {
      lo = mid;
      loTs = midTs;
    } else {
      hi = mid;
      hiTs = midTs;
    }
  }

  /** Blocks sharing the target timestamp can follow hi */
  return {from: lo, to: Math.min(latestBlock, hi + tolerance)};
};

export const useContractsStore = defineStore('contracts', {
  state: (): IContractsStore => ({
    web3: null,
    firstSign: false,
    connectedAccount: '',
    balance: '',
    balances: {},
    vaultBalance: {},
    amountDecimalPoints: 6,
    provider: null,
    allAccounts: [],
    inputs: {
      privateKey: '',
      nonce: '',
      transactionHash: '',
      apiKey: '',
      factory: ''
    },
    loading: {
      transactionHash: false,
      factory: false,
      balance: false,
      withdrawConnected: false,
      withdrawExternal: false,
      connect: false,
      history: false,
      withdraw: false,
      cancelWithdraw: false,
      completeWithdraw: false,
      vaultBalance: false
    },
    transactionHash: {
      contractAddress: ''
    },
    factory: {
      contractAddress: '',
      factoryABI: []
    },
    deployer: {
      contractAddress: ''
    },
    modal: {
      connect: false,
      withdrawConnected: false,
      withdrawExternal: false,
      cancelWithdraw: false,
      completeWithdraw: false,
      overtime: false,
      rpc: false
    },
    withdrawals: [],
    form: {
      connected: {
        amount: {
          required: true,
          value: null
        }
      },
      external: {
        amount: {
          required: true,
          value: null
        },
        address: {
          required: true,
          value: ''
        }
      }
    },
    wallets: {
      connected: {
        step: 1
      },
      external: {
        step: 1
      }
    },
    error: {
      external: false,
      connected: false,
      externalAddress: false
    },
    factoryContracts: [],
    activeFactory: null,
    vaultContract: null,
    transactionGas: {
      gas: 0,
      gasPrice: 0,
      maxFeePerGas: 0,
      maxPriorityFeePerGas: 0
    },
    activeRequest: null,
    lastBlock: 0,
    withdrawalRequests: [],
    vaultAddress: '',
    blocksOffset: 5000,
    completedWithdrawals: [],
    cancelledWithdrawals: [],
    daysOffset: TODAY_TIME,
    thresholdPrompt: '',
    rpc: {
      name: '',
      url: ''
    },
    currencyToken: '',
    tokens: [],
    activeChain: null,
    contractIndex: 0,
    availableVaults: [],
    timeList: [
      {
        text: 'Last hour',
        value: 1 / 24
      },
      {
        text: 'Today',
        value: TODAY_TIME
      },
      {
        text: '5 days',
        value: 5
      },
      {
        text: '10 days',
        value: 10
      },
      {
        text: 'This month',
        value: new Date().getDate()
      },
      {
        text: 'This year',
        value: THIS_YEAR_DAYS + TODAY_TIME
      }
    ]
  }),
  getters: {
    amountDecimals: (state): string => {
      return `0.${'0'.repeat(state.amountDecimalPoints - 1)}1`;
    },
    activeNetwork: (state): IActiveNetwork => {
      if (!state.activeChain) {
        return {
          name: 'Unknown Chain',
          icon: './img/icons/bitcoin-btc-logo.png',
          id: '/',
          symbol: ''
        };
      }

      return {
        name:
          NETWORKS[state.activeChain.id as keyof typeof NETWORKS].name ||
          `Unknown Chain (ID: ${state.activeChain.id})`,
        icon:
          NETWORKS[state.activeChain.id as keyof typeof NETWORKS].icon ||
          './img/icons/bitcoin-btc-logo.png',
        id: NETWORKS[state.activeChain.id as keyof typeof NETWORKS].id || '/',
        symbol:
          NETWORKS[state.activeChain.id as keyof typeof NETWORKS].symbol || ''
      };
    },
    selectedCurrency: (state) => {
      if (!state.activeChain) {
        return;
      }

      return (
        state.activeChain.currencies.find(
          (item) => item.value === state.currencyToken
        )?.name || state.activeChain.currencies[0].name
      );
    },
    /** Available balance of the selected currency token; null when not loaded or the read failed */
    selectedBalance: (state): number | null => {
      if (!state.currencyToken) {
        return null;
      }

      return state.balances[tokenKey(state.currencyToken)] ?? null;
    },
    /** True when the selected token's balance read failed (as opposed to not loaded yet) */
    selectedBalanceFailed: (state): boolean => {
      if (!state.currencyToken) {
        return false;
      }

      return state.balances[tokenKey(state.currencyToken)] === null;
    }
  },
  actions: {
    async initializeWeb3(provider?: any) {
      /** Initialize provider either from the browser (on desktop) or Metamask SDK (on mobile) */
      this.provider = markRaw(provider || window.ethereum);
      this.web3 = markRaw(new Web3(this.provider));

      /** Listen to account and network changes */
      this.updateNetwork();
      this.onAccountsChanged();

      /** Set initial chain */
      const chainId = await this.web3.eth.getChainId();
      const parsedId = Number(chainId);
      const currentChain = CHAINS.find((item) => item.id === parsedId);

      if (!currentChain) {
        return;
      }

      this.activeChain = currentChain;

      /** Set initial currency token */
      this.tokens = [this.activeChain.currencies[0]];
      this.currencyToken = this.activeChain.currencies[0].value;

      /** Set initial rpc list */
      this.rpc = this.activeChain.rpcs[0];
    },

    addRpc(rpc: IRpc) {
      if (!this.activeChain) {
        return;
      }

      this.activeChain = {
        ...this.activeChain,
        rpcs: [...this.activeChain.rpcs, rpc]
      };
      this.rpc = rpc;
    },

    updateLoading(loader: Partial<IContractsLoading>) {
      this.loading = {
        ...this.loading,
        ...loader
      };
    },

    updateFirstSign(signed: boolean) {
      this.firstSign = signed;
    },

    updateModal(modal: Partial<IContractsModal>) {
      this.modal = {
        ...this.modal,
        ...modal
      };
    },

    updateForm(form: Partial<IContractsForms>) {
      this.form = {
        ...this.form,
        ...form
      };
    },

    updateError(error: Partial<IContractsErrors>) {
      this.error = {
        ...this.error,
        ...error
      };
    },

    updateOffsetDays(days: number) {
      this.daysOffset = days;
    },

    updateWallet(
      wallet: keyof IContractsWallets,
      walletData: Partial<IWallet>
    ) {
      this.wallets = {
        ...this.wallets,
        [wallet]: {
          ...this.wallets[wallet],
          ...walletData
        }
      };
    },

    resetWithdrawalsList() {
      this.activeRequest = null;
      this.cancelledWithdrawals = [];
      this.completedWithdrawals = [];
      this.withdrawals = [];
      this.withdrawalRequests = [];
    },

    resetConnectedForm() {
      if (this.wallets.connected.step === 2) {
        this.resetWithdrawalsList();
        this.getWithdrawalHistory();
      }

      this.updateError({connected: false});
      this.updateWallet('connected', {step: 1});
      this.updateFormField(null, 'connected', 'amount');
      this.updateLoading({withdrawConnected: false});
    },

    updateHistoryList() {
      if (this.loading.history) {
        return;
      }
      this.resetWithdrawalsList();
      this.getWithdrawalHistory();
    },

    resetExternalForm() {
      if (this.wallets.external.step === 3) {
        this.resetWithdrawalsList();
        this.getWithdrawalHistory();
      }

      this.updateError({external: false});
      this.updateWallet('external', {step: 1});
      this.updateFormField(null, 'external', 'amount');
      this.updateFormField('', 'external', 'address');
      this.updateLoading({withdrawExternal: false});
    },

    updateFormField(
      value: unknown,
      form: keyof IContractsForms,
      formKey: keyof (IConnectedForm & IExternalForm),
      nestedKey?: any
    ) {
      if (nestedKey) {
        this.updateForm({
          [form]: {
            ...this.form[form],
            [formKey]: {
              ...(this.form[form] as any)[formKey],
              [nestedKey]: {
                ...(this.form[form] as any)[formKey][nestedKey],
                value: value
              }
            }
          }
        });
        return;
      }

      this.updateForm({
        [form]: {
          ...this.form[form],
          [formKey]: {
            ...(this.form[form] as any)[formKey],
            value: value
          }
        }
      });
    },

    updateChain(chainId: string) {
      const currentChain = CHAINS.find((item) => item.hexId === chainId);

      if (!currentChain) {
        return;
      }

      this.activeChain = currentChain;

      /** Set active chain's currency token */
      this.tokens = [this.activeChain.currencies[0]];
      this.currencyToken = this.activeChain.currencies[0].value;

      /** Set active chain's rpc list */
      this.rpc = this.activeChain.rpcs[0];
    },

    async getBalance() {
      if (!this.web3) {
        return;
      }

      /** Init loading */
      this.updateLoading({balance: true});

      try {
        /** Connect to metamask and extract balance in ETH or its derivation */
        const balance = await this.web3.eth.getBalance(this.connectedAccount);
        const balanceEth = this.web3.utils.fromWei(balance, 'ether');
        this.balance = parseFloat(balanceEth).toFixed(5);
      } catch (error) {
        console.error(error);
      } finally {
        this.updateLoading({balance: false});
      }
    },

    async connectMetamask() {
      if (!this.web3) {
        toast.info('no Web3 provided');
        return;
      }

      /** Notify the user to install Metamask in case the ethereum constructor does not exist */
      if (!this.provider) {
        toast.error('Please install MetaMask!');
        return;
      }

      /** Stop propagation if the loading is already in process */
      if (this.loading.connect) {
        return;
      }

      /** Switch to Avalanche chain if the selected chain is neither Polygon nor Avalanche */
      await this.setAvaxChain();

      /** If the user has already connected their MetaMask, signed the wallet and created a Vault contract, end propagation */
      if (this.vaultContract && !this.loading.connect) {
        this.updateModal({connect: true});
        return;
      }

      /** Init loading */
      this.updateLoading({connect: true});

      try {
        /** Extract the metamask account's address and display it */
        await this.provider.request({method: 'eth_requestAccounts'});
        const accounts = await this.web3.eth.getAccounts();

        if (!accounts.length) {
          throw new Error('No accounts found.');
        }

        /** Extract the chain id of the current account from the MetaMask if none is set */
        if (!this.activeChain) {
          const chainId = await this.web3.eth.getChainId();
          const currentChain = CHAINS.find(
            (item) => Number(chainId) === item.id
          );
          if (!currentChain) {
            return;
          }
          this.activeChain = currentChain;
        }

        /** Switch the chain to Polygon mainnet - it is the chain of the Vault SC. The call to the chain change is conditioned on two things -> #1 If the user has never connected the dApp to the MetaMask and they're not on mobile device outside Metamask or the user is on desktop device the polygon chain will be switched in metamask app/extension. #2 If the user has already connected the app to the metamask the chain switcher will commence. In any other case this step will be skipped. */
        if ((!this.firstSign && !isMobileChrome()) || this.firstSign) {
          await this.provider.request({
            method: 'wallet_switchEthereumChain',
            params: [{chainId: this.activeChain.hexId}]
          });
        }

        /** Set the state of the metamask account connected to the network */
        this.allAccounts = accounts;
        this.connectedAccount = accounts[0];

        /** Send the fist sign action to session storage */
        sessionStorage.setItem('firstSign', 'true');

        /** Extract the balance of the current chain in USDT */
        await this.getBalance();

        /** Make a connection to the Vault Smart Contract - Check if the metamask address has already made a contract. In case it hasn't, create a new Vault contract. Finally, save the contract to the global state */
        await this.connectContract();
      } catch (error) {
        if ((error as any).code !== 4902) {
          toast.error(`${(error as Error).message}`);
          return;
        }

        try {
          await this.provider.request({
            method: 'wallet_addEthereumChain',
            params: [polygonMainnet]
          });
          await this.provider.request({
            method: 'wallet_addEthereumChain',
            params: [avalancheMainnet]
          });
        } catch (addError) {
          console.error('Failed to add new chain:', addError);
        }
      } finally {
        this.updateLoading({connect: false});
      }
    },

    /** Clear the vault's token balances and drop any read still in flight */
    resetVaultBalances() {
      balanceRequestSeq++;
      this.balances = {};
      this.vaultBalance = {};
      this.updateLoading({vaultBalance: false});
    },

    resetBalance() {
      this.balance = '';
      this.resetVaultBalances();
    },

    disconnectMetamask() {
      this.contractIndex = 0;
      this.connectedAccount = '';
      this.vaultAddress = '';
      this.resetBalance();
      this.vaultContract = null;
      this.factoryContracts = [];
      this.activeFactory = null;
      this.daysOffset = TODAY_TIME;
      sessionStorage.removeItem('firstSign');
      this.resetWithdrawalsList();
    },

    updateNetwork() {
      /** If the metamask doesn't exist end propagation and prompt the user to install it */
      if (!this.provider) {
        return;
      }

      this.provider.on('chainChanged', async (chainId: string) => {
        this.contractIndex = 0;
        /** Init loading history */
        this.updateLoading({history: true});

        /** Reset balance data */
        this.resetBalance();

        /** Close all modals and reset forms */
        this.updateModal({
          connect: false,
          withdrawConnected: false,
          withdrawExternal: false,
          cancelWithdraw: false,
          completeWithdraw: false,
          overtime: false
        });
        this.resetConnectedForm();
        this.resetExternalForm();

        /** Update chain id (network) -> The chainId that gets passed through chainChanged event is of type string and a hex format (0x...). We need to parse it to an integer in order to properly map it to its name */
        this.updateChain(chainId);

        /** Get last block */
        await this.getLastNetworkBlock();

        /** Estimate block per hour */
        await this.estimateBlocksPerHour();

        /** If the user has not made the first connection to the metamask wallet end propagation */
        if (!this.vaultContract) {
          return;
        }

        /** Fetch contract */
        await this.connectContract();

        /** Fetch balance from the current chain */
        await this.getBalance();
      });
    },

    onAccountsChanged() {
      /** If the metamask doesn't exist end propagation and prompt the user to install it */
      if (!this.provider) {
        return;
      }

      this.provider.on('accountsChanged', (accounts: string[]) => {
        /** If the accounts array is empty clear the state and show the disconnected state on app */
        this.contractIndex = 0;
        this.updateModal({connect: false});
        this.disconnectMetamask();
        this.connectMetamask();
      });
    },

    async connectMobile() {
      const ethereum = metamaskSdk.getProvider();
      const isMobileOrTablet =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );
      const isTouchDevice =
        'ontouchstart' in window || navigator.maxTouchPoints > 0;

      if (!ethereum || (!isMobileOrTablet && !isTouchDevice)) {
        return;
      }

      this.initializeWeb3(ethereum);
    },

    async checkConnection() {
      if (!this.web3) {
        return;
      }

      try {
        /** Fetch all connected account from the metamask */
        const accounts = await this.provider.request({
          method: 'eth_accounts'
        });

        /** Stop propagation if no accounts are connected to metamask */
        if (!accounts.length) {
          return;
        }

        /** Populated global state if metamask is already connected to one or more accounts */
        this.connectedAccount = accounts[0];
        this.allAccounts = accounts;
      } catch (error) {
        console.error('Error connecting to metamask', (error as Error).message);
      }
    },

    /** Resolve a token's id in the current vault's registry (Avalanche multi-token vaults) */
    async resolvePaymentTokenId(token: string): Promise<number> {
      if (!this.activeFactory) {
        throw new Error('No registry for the current vault');
      }

      const registry = String(this.activeFactory.options?.address ?? '');
      const cacheKey = `${registry.toLowerCase()}:${tokenKey(token)}`;
      const cached = paymentTokenIdCache.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }

      const tokenId = Number(
        await this.activeFactory.methods['getWhitelistedTokenId'](token).call()
      );
      paymentTokenIdCache.set(cacheKey, tokenId);
      return tokenId;
    },

    /** Read one token's balances from the source configured for it. Throws when the read fails. */
    async readVaultTokenBalance(
      currency: IToken,
      vault: Pick<Contract<ContractAbi>, 'methods'>,
      vaultAddress: string
    ): Promise<IVaultTokenBalance> {
      if (!this.activeChain || !this.web3) {
        throw new Error('No active chain');
      }

      switch (currency.balanceSource) {
        case 'protocolToken': {
          /** The Polygon contract was deployed with the "avaliableBalance" typo; VaultAbi.test.ts pins both spellings */
          const balanceKey =
            this.activeChain.id === 137
              ? 'avaliableBalance'
              : 'availableBalance';
          const raw: Record<string, unknown> = await vault.methods[
            this.activeChain.balanceCall
          ]().call();

          if (raw[balanceKey] === undefined) {
            throw new Error(
              `${this.activeChain.balanceCall}() returned no ${balanceKey}`
            );
          }

          return {
            source: 'protocolToken',
            availableBalance: toTokenUnits(raw[balanceKey])!,
            balance: toTokenUnits(raw.balance),
            withdrawalReservation: toTokenUnits(raw.withdrawalReservation),
            processPaymentReservation: toTokenUnits(
              raw.processPaymentReservation
            )
          };
        }

        case 'paymentTokenId': {
          const tokenId = await this.resolvePaymentTokenId(currency.value);
          const raw: Record<string, unknown> = await vault.methods[
            'getPaymentTokenBalancesByTokenId'
          ](tokenId).call();

          if (raw.availableBalance === undefined) {
            throw new Error(
              'getPaymentTokenBalancesByTokenId() returned no availableBalance'
            );
          }

          return {
            source: 'paymentTokenId',
            availableBalance: toTokenUnits(raw.availableBalance)!,
            balance: toTokenUnits(raw.balance),
            withdrawalReservation: toTokenUnits(raw.withdrawalReservation),
            processPaymentReservation: toTokenUnits(
              raw.processPaymentReservation
            ),
            frozenPaymentTokenAmount: toTokenUnits(raw.frozenPaymentTokenAmount)
          };
        }

        case 'erc20': {
          /** No vault-side accounting for this token: the raw token balance is all there is */
          const token = new this.web3.eth.Contract(
            ERC20_BALANCE_ABI,
            currency.value
          );
          const amount = toTokenUnits(
            await token.methods.balanceOf(vaultAddress).call()
          )!;
          return {source: 'erc20', availableBalance: amount, balance: amount};
        }
      }
    },

    async getVaultBalance() {
      const chain = this.activeChain;
      const vault = this.vaultContract;
      const vaultAddress = this.vaultAddress;

      if (!chain || !vault || !this.web3) {
        return;
      }

      /** Clear the previous numbers first, so a failed read can never leave another vault's (or an outdated) balance on screen */
      const requestId = ++balanceRequestSeq;
      this.balances = {};
      this.vaultBalance = {};
      this.updateLoading({vaultBalance: true});

      /** Read every token independently, so one failing read doesn't block the others */
      const results = await Promise.allSettled(
        chain.currencies.map((currency) =>
          this.readVaultTokenBalance(currency, vault, vaultAddress)
        )
      );

      /** A newer read or a reset started meanwhile (vault or chain switch) — drop these results */
      if (requestId !== balanceRequestSeq) {
        return;
      }

      const balances: TTokenBalances = {};
      const vaultBalance: Record<string, IVaultTokenBalance | null> = {};
      results.forEach((result, index) => {
        const currency = chain.currencies[index];

        if (result.status === 'fulfilled') {
          balances[tokenKey(currency.value)] = result.value.availableBalance;
          vaultBalance[currency.name] = result.value;
          return;
        }

        balances[tokenKey(currency.value)] = null;
        vaultBalance[currency.name] = null;
        console.error(
          `Error fetching ${currency.name} vault balance: `,
          (result.reason as Error)?.message
        );
      });

      this.balances = balances;
      this.vaultBalance = vaultBalance;

      /** Offer the first currency and alwaysListed ones, plus any other token the vault holds */
      this.tokens = chain.currencies.filter(
        (currency, index) =>
          index === 0 ||
          currency.alwaysListed ||
          (balances[tokenKey(currency.value)] ?? 0) > 0
      );

      /** If the selected token is no longer offered, fall back to the first one */
      const currencyTokenActive = this.tokens.some(
        (item) => item.value === this.currencyToken
      );
      if (!currencyTokenActive) {
        this.currencyToken = this.tokens[0].value;
      }

      this.updateLoading({vaultBalance: false});
    },

    /**
     * Recipient (2nd argument) of the withdrawal request in a transaction's input, matched by token + amount.
     * Requests come either as withdrawRequest(token, recipient, amount) — the web app — or as
     * withdrawRequestWithSignature(token, recipient, amount, signature) — signed flows; both start with the
     * same three words. The call can be wrapped (e.g. a smart-account batch), so the input is scanned.
     */
    extractWithdrawRequestRecipient(
      input: string,
      token: string,
      amount: bigint
    ): string | null {
      if (!this.web3) return null;

      const abi = this.web3.eth.abi;
      const selectors = [
        'withdrawRequest(address,address,uint256)',
        'withdrawRequestWithSignature(address,address,uint256,bytes)'
      ].map((signature) =>
        abi.encodeFunctionSignature(signature).slice(2).toLowerCase()
      );
      const data = input.toLowerCase().replace(/^0x/, '');

      for (const selector of selectors) {
        for (
          let i = data.indexOf(selector);
          i !== -1;
          i = data.indexOf(selector, i + 1)
        ) {
          if (i % 2 !== 0) continue; // must start on a byte boundary
          const args = data.slice(i + 8, i + 8 + 192); // token, recipient, amount: 3 × 32 bytes
          if (args.length !== 192) continue;
          try {
            const d = abi.decodeParameters(
              ['address', 'address', 'uint256'],
              '0x' + args
            );
            if (
              String(d[0]).toLowerCase() === token.toLowerCase() &&
              BigInt(d[2] as bigint) === BigInt(amount)
            ) {
              return String(d[1]);
            }
          } catch {
            /* not a real match, keep scanning */
          }
        }
      }
      return null;
    },

    /** Read a transaction through the wallet provider, falling back to the configured RPC */
    async getTransactionWithFallback(hash: string) {
      try {
        return await this.web3!.eth.getTransaction(hash);
      } catch {
        return await new Web3(this.rpc.url).eth.getTransaction(hash);
      }
    },

    async getEstimatedGas(
      contract: unknown,
      method: string,
      args: unknown[],
      buffer = 1.2
    ) {
      if (!this.web3 || !this.activeChain) {
        return;
      }

      try {
        /** Estimate gas needed for specific method */
        const estimatedGas = await (contract as Contract<ContractAbi>).methods[
          method
        ](...args).estimateGas({from: this.connectedAccount});

        /** Fetch the fee history of the last 5 blocks */
        const feeHistory = await this.provider.request({
          method: 'eth_feeHistory',
          params: [
            '0x5', // last 5 blocks
            'latest',
            [25, 50, 75] // percentiles for priority fee
          ]
        });

        function percentile(values: bigint[], p: number): bigint {
          if (values.length === 0) return 0n;
          const idx = Math.floor(values.length * (p / 100));
          return values[Math.min(idx, values.length - 1)];
        }

        const rewards = feeHistory.reward
          .flat()
          .map((hex: number) => BigInt(hex))
          .filter((v: any) => v > 0n);

        rewards.sort((a: number, b: number) => (a < b ? -1 : 1));

        const maxPriorityFeePerGasCalc = percentile(rewards, 50); // p50

        const pendingBlock = await this.provider.request({
          method: 'eth_getBlockByNumber',
          params: ['pending', false]
        });

        const baseFeeCalc = BigInt(pendingBlock.baseFeePerGas);

        /** Get the rest of the gas data */
        const gasData =
          this.activeChain.hexId === polygonMainnet.chainId
            ? await (await fetch(this.activeChain.gas)).json()
            : null;
        const maxFeePerGas =
          this.activeChain.hexId === polygonMainnet.chainId
            ? Math.floor(gasData.fast.maxFee * 1e9) // convert gwei → wei
            : Number(baseFeeCalc * 2n + maxPriorityFeePerGasCalc) * 10;
        const maxPriorityFeePerGas =
          this.activeChain.hexId === polygonMainnet.chainId
            ? Math.floor(gasData.fast.maxPriorityFee * 1e9)
            : Number(maxPriorityFeePerGasCalc);

        /** Add buffer to the estimated gas */
        this.transactionGas = {
          gas: Math.floor(Number(estimatedGas) * buffer),
          maxFeePerGas: maxFeePerGas,
          maxPriorityFeePerGas: maxPriorityFeePerGas
        };
      } catch (error) {
        console.error('Error estimating gas: ', (error as Error).message);
      }
    },

    async submitConnectedForm() {
      if (
        this.loading.withdrawConnected ||
        !this.form.connected.amount.value ||
        !this.vaultContract
      ) {
        return;
      }

      if (!this.activeChain) {
        return;
      }

      /** Check against the selected token's balance; an unknown balance blocks the request */
      const available = this.selectedBalance;
      if (available === null || available < this.form.connected.amount.value) {
        return;
      }

      /** If the request for withdrawal failed, the user has been sent to the retry screen. The retry function takes the user back to the beginning of the form and resets the state */
      if (this.error.connected) {
        this.resetConnectedForm();
        return;
      }

      /** Update method based on the current chain and token used. In case of AVAX with USDC call withdraw directly */
      const currentTokenName = this.activeChain.currencies.find(
        (currency) => currency.value === this.currencyToken
      )?.name;
      let method = 'withdrawRequest';

      if (
        this.activeChain.hexId === avalancheMainnet.chainId &&
        currentTokenName === 'USDC'
      ) {
        method = 'withdraw';
      }

      /** Init loading */
      this.updateLoading({withdrawConnected: true});

      try {
        /** On amount screen call the "withdrawRequest" method from the Vault SC. On success the withdraw request is pending for an hour before the user can complete it */
        if (this.wallets.connected.step === 1) {
          /** Never send a new request while one is open: the contract would silently replace it */
          if (
            method === 'withdrawRequest' &&
            !(await this.ensureNoOpenReservation())
          ) {
            return;
          }

          /** Fetch estimated gas */
          await this.getEstimatedGas(this.vaultContract, method, [
            this.currencyToken,
            this.connectedAccount,
            formatNumberToUint256(this.form.connected.amount.value)
          ]);

          /** Make a withdrawal request to Vault SC */
          await this.vaultContract.methods[method](
            this.currencyToken,
            this.connectedAccount,
            formatNumberToUint256(this.form.connected.amount.value)
          ).send({
            from: this.connectedAccount,
            gas: `${this.transactionGas.gas}`,
            maxFeePerGas: `${this.transactionGas.maxFeePerGas}`,
            maxPriorityFeePerGas: `${this.transactionGas.maxPriorityFeePerGas}`
          });

          /** Proceed to the next step */
          if (method === 'withdrawRequest') {
            this.updateWallet('connected', {step: 2});
          }

          /** Update global state for Vault balance */
          await this.getVaultBalance();

          if (method === 'withdrawRequest') {
            return;
          }
        }

        /** Close the modal and reset the form  */
        this.updateModal({withdrawConnected: false});
        this.updateFormField(null, 'connected', 'amount');
        this.updateWallet('connected', {step: 1});

        if (method === 'withdraw') {
          bottomToast(
            `Withdraw to: ${this.connectedAccount.substring(
              0,
              4
            )}...${this.connectedAccount.slice(
              -4
            )} has been successfully completed.`,
            3000,
            'toast__wide toast__withdrawal'
          );
          this.resetWithdrawalsList();
        }

        await this.getWithdrawalHistory();
      } catch (error) {
        console.error('Error submitting form: ', (error as Error).message);
        toast.error(`${(error as Error).message}`);
        this.updateError({connected: true});
        this.updateLoading({withdrawConnected: false});
      } finally {
        this.updateLoading({withdrawConnected: false});
      }
    },

    async submitExternalForm() {
      if (
        this.loading.withdrawExternal ||
        !this.form.external.amount.value ||
        !this.vaultContract ||
        !this.form.external.amount.value ||
        !this.web3
      ) {
        return;
      }

      if (!this.activeChain) {
        return;
      }

      /** Check against the selected token's balance; an unknown balance blocks the request */
      const available = this.selectedBalance;
      if (available === null || available < this.form.external.amount.value) {
        return;
      }

      /** If the request for withdrawal failed, the user has been sent to the retry screen. The retry function takes the user back to the beginning of the form and resets the state */
      if (this.error.external) {
        this.resetExternalForm();
        return;
      }

      /** Update method based on the current chain and token used. In case of AVAX with USDC call withdraw directly */
      const currentTokenName = this.activeChain.currencies.find(
        (currency) => currency.value === this.currencyToken
      )?.name;
      let method = 'withdrawRequest';

      if (
        this.activeChain.hexId === avalancheMainnet.chainId &&
        currentTokenName === 'USDC'
      ) {
        method = 'withdraw';
      }

      /** Init loading */
      this.updateLoading({withdrawExternal: true});

      try {
        /** On amount screen call the "withdrawRequest" method from the Vault SC. On success the withdraw request is pending for an hour before the user can complete it */
        if (this.wallets.external.step === 1) {
          /** Proceed to the next step */
          this.updateWallet('external', {step: 2});
          return;
        }

        if (this.wallets.external.step === 2) {
          /** Never send a new request while one is open: the contract would silently replace it */
          if (
            method === 'withdrawRequest' &&
            !(await this.ensureNoOpenReservation())
          ) {
            return;
          }

          /** Fetch estimated gas */
          await this.getEstimatedGas(this.vaultContract, method, [
            this.currencyToken,
            this.web3.utils.toChecksumAddress(this.form.external.address.value),
            formatNumberToUint256(this.form.external.amount.value)
          ]);

          /** Make a withdrawal request to Vault SC */
          await this.vaultContract.methods[method](
            this.currencyToken,
            this.web3.utils.toChecksumAddress(this.form.external.address.value),
            formatNumberToUint256(this.form.external.amount.value)
          ).send({
            from: this.connectedAccount,
            gas: `${this.transactionGas.gas}`,
            maxFeePerGas: `${this.transactionGas.maxFeePerGas}`,
            maxPriorityFeePerGas: `${this.transactionGas.maxPriorityFeePerGas}`
          });

          /** Proceed to the next step */
          if (method === 'withdrawRequest') {
            this.updateWallet('external', {step: 3});
          }

          /** Update global state for Vault balance */
          await this.getVaultBalance();

          if (method === 'withdrawRequest') {
            return;
          }
        }

        /** Close the modal and reset the form  */
        this.updateModal({withdrawExternal: false});
        this.updateFormField(null, 'external', 'amount');
        this.updateFormField('', 'external', 'address');
        this.updateWallet('external', {step: 1});

        if (method === 'withdraw') {
          bottomToast(
            `Withdraw to: ${this.connectedAccount.substring(
              0,
              4
            )}...${this.connectedAccount.slice(
              -4
            )} has been successfully completed.`,
            3000,
            'toast__wide toast__withdrawal'
          );
          this.resetWithdrawalsList();
        }

        await this.getWithdrawalHistory();
      } catch (error) {
        console.error('Error submitting form: ', (error as Error).message);
        toast.error(`${(error as Error).message}`);
        this.updateError({external: true});
        this.updateLoading({withdrawExternal: false});
      } finally {
        this.updateLoading({withdrawExternal: false});
      }
    },

    async estimateBlocksPerHour(sampleSize = 20) {
      if (!this.web3) {
        return;
      }

      try {
        /** Get the latest block number */
        const latestBlock = await this.web3.eth.getBlockNumber();

        /** Fetch the latest block and a block sampleSize blocks behind */
        const blockLatest = await this.web3.eth.getBlock(latestBlock);
        const blockPast = await this.web3.eth.getBlock(
          Number(latestBlock) - sampleSize
        );

        /** Compute average block time */
        const timeDiff =
          Number(blockLatest.timestamp) - Number(blockPast.timestamp);
        const avgBlockTime = timeDiff / sampleSize; // in seconds

        /** Estimate blocks per specified time (1 day) */
        this.blocksOffset = Math.ceil((3600 * 24) / avgBlockTime);
      } catch (error) {
        console.error(
          'Error estimating block offset: ',
          (error as Error).message
        );
      }
    },

    async getWithdrawRequests() {
      if (!this.vaultContract || !this.activeChain) {
        return;
      }

      /** Connect to another RPC - the default RPC for the Polygon mainnet isn't indexing properly in certain timezones */
      const web3Instance = new Web3(this.rpc.url);
      const vaultContract = new web3Instance.eth.Contract(
        this.activeChain.vaultAbi,
        this.vaultAddress
      );

      /** Don't keep a previous vault's or time window's events if this fetch fails */
      this.withdrawalRequests = [];

      try {
        /** Get all events from the requests made with withdrawRequest methods. The event contains an unclock time and an amount requested to withdraw but no recipient address */
        const fromBlock =
          this.blocksOffset * this.daysOffset <= this.lastBlock
            ? Math.ceil(this.lastBlock - this.blocksOffset * this.daysOffset)
            : 0;

        this.withdrawalRequests = (await (vaultContract as any).getPastEvents(
          'WithdrawRequest',
          {
            fromBlock: fromBlock,
            toBlock: 'latest'
          }
        )) as IVaultEvent<IWithdrawRequestData>[];
      } catch (error) {
        console.error(
          'Error fetching withdraw requests; ',
          (error as Error).message
        );
      }
    },

    /**
     * Open withdrawal reservation of the current vault, read from contract state (not from events, so it doesn't depend on the history time filter).
     * Polygon vaults only expose the protocol token's reservation; Avalanche vaults one per whitelisted token. Throws when a read fails.
     */
    async findOpenReservation(): Promise<IOpenReservation | null> {
      const chain = this.activeChain;
      const vault = this.vaultContract;

      if (!chain || !vault) {
        return null;
      }

      const open: IOpenReservation[] = [];

      for (const currency of chain.currencies) {
        let reservation: IReservation | null = null;

        if (currency.balanceSource === 'protocolToken') {
          reservation = await vault.methods[chain.reservationCall]().call();
        } else if (currency.balanceSource === 'paymentTokenId') {
          const tokenId = await this.resolvePaymentTokenId(currency.value);
          reservation = await vault.methods[
            'getWithdrawPaymentTokenReservationByTokenId'
          ](tokenId).call();
        }

        if (reservation && BigInt(reservation.amount) > 0n) {
          open.push({
            token: currency.value,
            amount: BigInt(reservation.amount),
            unlockTime: BigInt(reservation.unlockTime)
          });
        }
      }

      if (open.length > 1) {
        console.warn('Multiple open withdrawal reservations', open);
      }

      /** The UI handles one request at a time: show the most recent one first */
      return (
        open.sort((a, b) => (a.unlockTime > b.unlockTime ? -1 : 1))[0] ?? null
      );
    },

    /**
     * The WithdrawRequest event that created a reservation. The request was made at unlockTime - lockDuration, so only a narrow block range around
     * that time is searched. Returns null if it isn't found (e.g. the lock duration changed since the request).
     */
    async findWithdrawRequestEvent(
      reservation: IOpenReservation,
      requestTime: number
    ): Promise<IVaultEvent<IWithdrawRequestData> | null> {
      if (!this.activeChain) {
        return null;
      }

      /** Connect to another RPC - the default RPC for the Polygon mainnet isn't indexing properly in certain timezones */
      const web3Instance = new Web3(this.rpc.url);
      const vaultContract = new web3Instance.eth.Contract(
        this.activeChain.vaultAbi,
        this.vaultAddress
      );

      /** Narrow to ~30 blocks: some RPCs reject log queries over 100 blocks */
      const latestBlock = Number(await web3Instance.eth.getBlockNumber());
      const {from, to} = await findBlockRangeForTimestamp(
        async (block) =>
          Number((await web3Instance.eth.getBlock(block)).timestamp),
        latestBlock,
        requestTime,
        this.blocksOffset,
        16
      );

      const events = (await (vaultContract as any).getPastEvents(
        'WithdrawRequest',
        {fromBlock: from, toBlock: to}
      )) as IVaultEvent<IWithdrawRequestData>[];

      return (
        events
          .filter(
            (event) =>
              tokenKey(event.returnValues.token) ===
                tokenKey(reservation.token) &&
              BigInt(event.returnValues.amount) === reservation.amount &&
              BigInt(event.returnValues.unlockTime) === reservation.unlockTime
          )
          .at(-1) ?? null
      );
    },

    /** Re-read the vault right before sending a new withdrawRequest. Returns false (and tells the user) when one is already open or the check fails. */
    async ensureNoOpenReservation(): Promise<boolean> {
      try {
        if (!(await this.findOpenReservation())) {
          return true;
        }
      } catch (error) {
        console.error(
          'Error checking open withdrawal requests: ',
          (error as Error).message
        );
        toast.error(
          'Could not check for pending withdrawal requests. Please try again.'
        );
        return false;
      }

      toast.error(
        'You already have a pending withdrawal request. Complete or cancel it before creating a new one.'
      );

      /** Refresh the list so the pending request shows up and blocks new requests */
      this.resetWithdrawalsList();
      await this.getWithdrawalHistory();
      return false;
    },

    async getActiveRequest() {
      if (
        !this.vaultContract ||
        !this.web3 ||
        !this.activeChain ||
        !this.activeFactory
      ) {
        return;
      }

      try {
        this.activeRequest = null;

        /** The pending request comes from the vault's reservation state, independent of the history time filter */
        const reservation = await this.findOpenReservation();

        if (!reservation) {
          return;
        }

        /** Fetch a lock duration of the withdrawal request from the vault's own registry */
        const lockDuration = BigInt(
          await this.activeFactory.methods[
            this.activeChain.reservationLockCall
          ]().call()
        );
        const requestTime = Number(reservation.unlockTime - lockDuration);

        /** The recipient (second withdrawRequest argument) is only in the request transaction, found via its WithdrawRequest event */
        let recipient: string | null = null;
        let requestEvent: IVaultEvent<IWithdrawRequestData> | null = null;

        try {
          requestEvent = await this.findWithdrawRequestEvent(
            reservation,
            requestTime
          );

          if (requestEvent) {
            const blockRequest = (await this.web3.eth.getBlock(
              requestEvent.blockNumber,
              true
            )) as IBlock;

            const requestTransaction = blockRequest.transactions.find(
              (item) => item.hash === requestEvent?.transactionHash
            );

            if (requestTransaction) {
              recipient = this.extractWithdrawRequestRecipient(
                requestTransaction.input,
                reservation.token,
                reservation.amount
              );
            }
          }
        } catch (error) {
          console.error(
            'Error fetching withdraw request event: ',
            (error as Error).message
          );
        }

        /** Keep the request (so it can be cancelled) but block completing without a verified recipient */
        if (!recipient) {
          console.error(
            'Could not find recipient for withdraw request',
            requestEvent?.transactionHash ?? '(request event not found)'
          );
        }

        /** unlockTime is in seconds; multiply by 1000 for Date */
        this.activeRequest = {
          address: recipient ?? '',
          amount: formatUint256toNumber(reservation.amount),
          date: new Date(requestTime * 1000),
          status:
            Number(reservation.unlockTime) * 1000 < Date.now()
              ? 'ready'
              : 'pending',
          token: reservation.token
        };

        /** If more than ten days have passed since making withdrawal request, prompt the user to either cancel or complete withdrawal request */
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        if (tenDaysAgo.getTime() < this.activeRequest.date.getTime()) {
          return;
        }
        this.thresholdPrompt =
          'It has been more than 10 days since your requested your withdrawal. Please cancel or complete your withdrawal request. Please note that a small gas fee is required to complete your withdrawal.';
        this.updateModal({overtime: true});
      } catch (error) {
        console.error(
          'Error fetching active request: ',
          (error as Error).message
        );
      }
    },

    /**
     * Recipient of a cancelled request. The CanceledWithdrawReservation event already carries token + amount;
     * the request it cancelled is the latest WithdrawRequest event (loaded for this time window) with the same
     * token + amount at or before it. Returns undefined when no request matches; throws when a lookup fails.
     */
    async findRecipientForCancellation(
      cancellation: IVaultEvent<ICancelledWithdrawReservationData>
    ) {
      if (!this.web3) {
        return;
      }

      const token = String(cancellation.returnValues.token);
      const amount = BigInt(cancellation.returnValues.amount);

      const cancelledRequest = this.withdrawalRequests
        .filter(
          (item) =>
            BigInt(item.blockNumber) <= BigInt(cancellation.blockNumber) &&
            amount === BigInt(item.returnValues.amount) &&
            token.toLowerCase() === item.returnValues.token.toLowerCase()
        )
        .at(-1);

      if (!cancelledRequest) {
        return;
      }

      const transaction = await this.getTransactionWithFallback(
        cancelledRequest.transactionHash
      );

      const recipient = this.extractWithdrawRequestRecipient(
        transaction.input,
        token,
        amount
      );

      if (!recipient) {
        return;
      }

      return {
        recipient,
        withdrawTxHash: cancelledRequest.transactionHash
      };
    },

    async getCancelledWithdrawals() {
      if (!this.activeChain || !this.web3) {
        return;
      }

      /** Connect to another RPC - the default RPC for the Polygon mainnet isn't indexing properly in certain timezones */
      const web3Instance = new Web3(this.rpc.url);
      const vaultContract = new web3Instance.eth.Contract(
        this.activeChain.vaultAbi,
        this.vaultAddress
      );

      try {
        /** Fetch all cancelled withdrawals events that manifest after successful "withdraw" method requests from the Vault contract */
        const cancelledWithdrawals = (await (
          vaultContract as any
        ).getPastEvents('CanceledWithdrawReservation', {
          fromBlock: Math.ceil(
            this.lastBlock - this.blocksOffset * this.daysOffset
          ),
          toBlock: 'latest'
        })) as IVaultEvent<ICancelledWithdrawReservationData>[];

        /** Header only (no transactions), each block fetched once */
        const web3 = this.web3;
        const blockTime = makeBlockTimeLoader((blockNumber) =>
          web3.eth.getBlock(blockNumber)
        );

        /** Each row stands on its own: a failed recipient lookup shows "Unknown recipient" instead of dropping the whole list */
        const rows = await Promise.allSettled(
          cancelledWithdrawals.map(async (cancellation) => {
            const [timestamp, cancelledTx] = await Promise.all([
              blockTime(cancellation.blockNumber),
              this.findRecipientForCancellation(cancellation).catch(
                (error) => {
                  console.error(
                    'Could not find the recipient of a cancelled request: ',
                    cancellation.transactionHash,
                    (error as Error)?.message
                  );
                  return undefined;
                }
              )
            ]);

            return {
              address: cancelledTx?.recipient ?? '',
              amount: formatUint256toNumber(cancellation.returnValues.amount),
              date: new Date(timestamp * 1000),
              status: 'cancelled',
              token: cancellation.returnValues.token
            } as IWithdrawal;
          })
        );

        this.cancelledWithdrawals = rows.flatMap((row, index) => {
          if (row.status === 'fulfilled') {
            return [row.value];
          }

          /** Without its block time a row can't be dated or sorted */
          console.error(
            'Error loading a cancelled withdrawal: ',
            cancelledWithdrawals[index].transactionHash,
            (row.reason as Error)?.message
          );
          return [];
        });
      } catch (error) {
        console.error(
          'Error fetching cancelled withdrawals: ',
          (error as Error).message
        );
      }
    },

    async getCompletedWithdrawals() {
      if (!this.activeChain || !this.web3) {
        return;
      }

      /** Connect to another RPC - the default RPC for the Polygon mainnet isn't indexing properly in certain timezones */
      const web3Instance = new Web3(this.rpc.url);
      const vaultContract = new web3Instance.eth.Contract(
        this.activeChain.vaultAbi,
        this.vaultAddress
      );

      try {
        /** Fetch all "Withdrawal" events that manifest after successful "withdraw" method requests from the Vault contract */
        const withdrawals = await (vaultContract as any).getPastEvents(
          'Withdrawal',
          {
            fromBlock: Math.ceil(
              this.lastBlock - this.blocksOffset * this.daysOffset
            ),
            toBlock: 'latest'
          }
        );

        /** Header only (no transactions), each block fetched once */
        const web3 = this.web3;
        const blockTime = makeBlockTimeLoader((blockNumber) =>
          web3.eth.getBlock(blockNumber)
        );

        /** Each row stands on its own: one failed block lookup drops that row, not the whole list */
        const rows = await Promise.allSettled(
          withdrawals.map(
            async (withdrawal: any) =>
              ({
                address: withdrawal.returnValues.recipient, //Recipients address
                amount: formatUint256toNumber(withdrawal.returnValues.amount),
                date: new Date(
                  (await blockTime(withdrawal.blockNumber)) * 1000
                ),
                status: 'complete',
                token: withdrawal.returnValues.token
              }) as IWithdrawal
          )
        );

        this.completedWithdrawals = rows.flatMap((row, index) => {
          if (row.status === 'fulfilled') {
            return [row.value];
          }

          console.error(
            'Error loading a completed withdrawal: ',
            withdrawals[index].transactionHash,
            (row.reason as Error)?.message
          );
          return [];
        });
      } catch (error) {
        console.error(
          'Error fetching completed withdrawals',
          (error as Error).message
        );

        /*const errorMessage = (error as any).data?.message;
        if (errorMessage) {
          toast.error(errorMessage);
          return;
        }

        toast.error((error as Error).message);*/
      }
    },

    async getWithdrawalHistory() {
      if (!this.vaultContract || !this.factoryContracts.length || !this.web3) {
        return;
      }

      /** Init loading */
      this.updateLoading({history: true});

      try {
        /** Fetch the WithdrawRequest events once for this vault and time window; cancellations use them to find recipients */
        await this.getWithdrawRequests();

        /** Fetch cancelled withdrawals */
        await this.getCancelledWithdrawals();

        /** Fetch completed withdrawals */
        await this.getCompletedWithdrawals();

        /** Fetch active withdrawal request */
        await this.getActiveRequest();

        /** Save the cancelled and completed withdrawals to one list and sort them by date */
        const withdrawalList = [
          ...this.cancelledWithdrawals,
          ...this.completedWithdrawals
        ].sort((a, b) => +b.date - +a.date);

        /** Save the withdrawal requests, completed withdrawals and cancelled withdrawals in global state and sort them by date */
        this.withdrawals = this.activeRequest
          ? [this.activeRequest, ...withdrawalList]
          : withdrawalList;
      } catch (error) {
        console.error(
          'Error fetching withdrawal history: ',
          (error as Error).message
        );
      } finally {
        this.updateLoading({history: false});
      }
    },

    async setVaultContract(address: string) {
      if (!this.web3) {
        return;
      }

      if (!this.activeChain) {
        return;
      }

      try {
        /** Set the vault contract state from vault abi and vault address fetched from Vault SC */
        this.vaultContract = new this.web3.eth.Contract(
          this.activeChain.vaultAbi,
          address
        );

        /** Get the list of all withdrawals */
        await this.getWithdrawalHistory();

        /** Fetch Vault balance */
        await this.getVaultBalance();
      } catch (error) {
        console.error(
          'Error setting vault contract: ',
          (error as Error).message
        );
      }
    },

    async connectContract() {
      if (!this.web3) {
        return;
      }

      if (!this.activeChain) {
        return;
      }

      /** Prevent propagation if chain is not Polygon or Avalanche */
      if (
        ![polygonMainnet.chainId, avalancheMainnet.chainId].includes(
          this.activeChain.hexId
        )
      ) {
        toast.error('Switch to either Polygon and Avalanche chain');
        return;
      }

      /** Initialize factory contract by providing the registry ABI and the factory contract's address to the contract class then save it to the global state */
      this.factoryContracts = this.activeChain.contracts.map((factory) => {
        return new this.web3!.eth.Contract(
          this.activeChain!.registryAbi,
          factory
        );
      });

      const loadingToast = toast.loading('Connecting to the contract...');

      try {
        /** Check if the currently connected wallet address already created a Vault smart contract. Stop propagation if so, otherwise create a new Vault smart contract. */
        const available = (await Promise.all(
          this.factoryContracts.map(async (factory) => ({
            factory: factory,
            vaultAddress: await factory.methods
              .getVaultAddressByOwner(this.connectedAccount)
              .call()
          }))
        )) as unknown as {factory: any; vaultAddress: string}[];

        /** Check if there are multiple contracts on several factory contracts on the same chain and output the available vault addresses */
        const availableVaults = available.filter(
          (avC) =>
            validateAddress(avC.vaultAddress) && parseInt(avC.vaultAddress, 16)
        );

        this.availableVaults = availableVaults.map((item) => item.vaultAddress);
        const availableFactories = availableVaults.map((item) => item.factory);

        /** Set the vault address of the current address (if there are multiple there is a selector in UI) */
        if (availableFactories.length > 0) {
          this.vaultAddress = await availableFactories[
            this.contractIndex
          ].methods
            .getVaultAddressByOwner(this.connectedAccount)
            .call();
        }

        const vaultExists =
          validateAddress(this.vaultAddress) && parseInt(this.vaultAddress, 16);

        /** If the Vault contract has already been created stop propagation otherwise proceed to Vault creation */
        if (vaultExists) {
          /** contractIndex indexes the vaults the user owns, not factoryContracts — keep the registry this vault belongs to */
          this.activeFactory = availableFactories[this.contractIndex] ?? null;
          await this.setVaultContract(this.vaultAddress);
          toast.remove(loadingToast);
          return;
        }

        /** Fetch estimated gas */
        await this.getEstimatedGas(
          this.factoryContracts[this.contractIndex],
          'createVault',
          [this.connectedAccount]
        );

        /** Make a request to "createVault" method on the factory contract to create a new Vault contract that will connect to the wallet address and the user will be able to withdraw funds from */
        const factoryTransaction = await this.factoryContracts[
          this.contractIndex
        ].methods
          .createVault(this.connectedAccount)
          .send({
            from: this.connectedAccount,
            gas: `${this.transactionGas.gas}`,
            maxFeePerGas: `${this.transactionGas.maxFeePerGas}`,
            maxPriorityFeePerGas: `${this.transactionGas.maxPriorityFeePerGas}`
          });

        if (!factoryTransaction.events) {
          throw new Error(
            'Something went wrong while creating the Vault contract. Try again.'
          );
        }

        /** The new vault is now the user's only one: record it so it's listed and its address is used for balance reads */
        const createdVault = String(
          factoryTransaction.events.ContractInitialized.address
        );
        this.activeFactory = this.factoryContracts[this.contractIndex];
        this.vaultAddress = createdVault;
        this.availableVaults = [createdVault];
        this.contractIndex = 0;
        await this.setVaultContract(createdVault);

        toast.remove(loadingToast);
        toast.success(`Vault contract successfully created`);
      } catch (error) {
        toast.remove(loadingToast);
        this.disconnectMetamask();

        if ((error as any).cause?.code === -32603) {
          toast.error("Couldn't connect to the contract.");
          return;
        }

        if ((error as any).code === 205) {
          toast.error(
            'NAKA Fund Withdrawal is only supported on Polygon and Avalanche'
          );
          return;
        }

        toast.error(
          (error as Error).message?.replace(
            'Returned error: MetaMask Tx Signature: ',
            ''
          )
        );
      } finally {
        toast.remove(loadingToast);
      }
    },

    async updateActiveVault(vaultId: number) {
      this.contractIndex = vaultId;

      /** Clear the previous vault's balances and requests, so they're never shown for the new one */
      this.resetVaultBalances();
      this.resetWithdrawalsList();

      await this.connectContract();
    },

    async completeWithdraw() {
      if (!this.vaultContract || this.loading.withdraw || !this.activeRequest) {
        return;
      }

      if (!this.activeRequest.address) {
        toast.error(
          'Could not verify the recipient of this request. Please cancel it and create a new one.'
        );
        return;
      }

      /** Set currency token */
      this.currencyToken = this.activeRequest.token;

      /** Init loading */
      this.updateLoading({withdraw: true});

      try {
        /** Fetch estimated gas */
        await this.getEstimatedGas(this.vaultContract, 'withdraw', [
          this.currencyToken,
          this.activeRequest.address,
          formatNumberToUint256(this.activeRequest.amount)
        ]);

        /** Make withdraw request */
        await this.vaultContract.methods
          .withdraw(
            this.currencyToken,
            this.activeRequest.address,
            formatNumberToUint256(this.activeRequest.amount)
          )
          .send({
            from: this.connectedAccount,
            gas: `${this.transactionGas.gas}`,
            maxFeePerGas: `${this.transactionGas.maxFeePerGas}`,
            maxPriorityFeePerGas: `${this.transactionGas.maxPriorityFeePerGas}`
          });

        /** Re-fetch contract balance */
        await this.getVaultBalance();

        /** Close the modal and re-fetch withdrawal list */
        this.updateModal({completeWithdraw: false});
        this.updateModal({overtime: false});
        bottomToast(
          `Withdraw to: ${this.activeRequest.address.substring(
            0,
            4
          )}...${this.activeRequest.address.slice(
            -4
          )} has been successfully completed.`,
          3000,
          'toast__wide toast__withdrawal'
        );

        this.resetWithdrawalsList();
        await this.getWithdrawalHistory();
      } catch (error) {
        console.error('Error withdrawing funds: ', (error as Error).message);
        toast.error(`Error withdrawing funds: ${(error as Error).message}`);
        this.updateLoading({withdraw: false});
      } finally {
        this.updateLoading({withdraw: false});
      }
    },

    async cancelWithdrawRequest() {
      /*TODO: Reset history*/
      if (
        this.loading.cancelWithdraw ||
        !this.vaultContract ||
        !this.transactionGas ||
        !this.activeRequest
      ) {
        return;
      }

      /** Set currency token */
      this.currencyToken = this.activeRequest.token;

      /** Init loading */
      this.updateLoading({cancelWithdraw: true});

      try {
        /** Fetch estimated gas */
        await this.getEstimatedGas(
          this.vaultContract,
          'cancelWithdrawRequest',
          [this.currencyToken]
        );

        /** Make a request to the Vault smart contract to cancel the active withdraw request. It takes in one argument - currency token address */
        await this.vaultContract.methods
          .cancelWithdrawRequest(this.currencyToken)
          .send({
            from: this.connectedAccount,
            gas: `${this.transactionGas.gas}`,
            maxFeePerGas: `${this.transactionGas.maxFeePerGas}`,
            maxPriorityFeePerGas: `${this.transactionGas.maxPriorityFeePerGas}`
          });

        /** On successful cancel of withdraw request close the modal and re-fetch the list of withdrawals */
        this.updateModal({cancelWithdraw: false});
        this.updateModal({overtime: false});
        await this.getVaultBalance();

        this.resetWithdrawalsList();
        await this.getWithdrawalHistory();

        toast.success('Withdrawal request canceled');
      } catch (error) {
        toast.error(`${(error as Error).message}`);
        this.updateLoading({cancelWithdraw: false});
      } finally {
        this.updateLoading({cancelWithdraw: false});
      }
    },

    async getLastNetworkBlock() {
      if (!this.web3) {
        return;
      }

      try {
        const latestBlock = await this.web3.eth.getBlockNumber();
        this.lastBlock = Number(latestBlock);
      } catch (error) {
        console.error(
          'Error fetching the last block: ',
          (error as Error).message
        );
      }
    },

    async setAvaxChain() {
      /** If the active chain is either Polygon or Avalanche stop propagation */
      if (
        this.activeChain &&
        [polygonMainnet.chainId, avalancheMainnet.chainId].includes(
          this.activeChain.hexId
        )
      ) {
        return;
      }

      /** Notify the user of the switch */
      toast.info('Switching to Avalanche chain...', {autoClose: 5000});

      try {
        /** Set the Metamask chain to Polygon mainnet and update chain id in global state */
        await this.provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{chainId: avalancheMainnet.chainId}]
        });
        this.updateChain(avalancheMainnet.chainId);

        /** Retrieve the balance from the wallet and populate the global state */
        await this.getBalance();
      } catch (error) {
        toast.error((error as Error).message);
      }
    }
  }
});
