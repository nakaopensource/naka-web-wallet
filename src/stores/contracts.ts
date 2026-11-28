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
  IRpc,
  IWallet,
  IWithdrawal
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
import usdcABI from '@/assets/abi/USDC.json';
import xautABI from '@/assets/abi/XAUT.json';
import type {
  ICancelledWithdrawReservationData,
  IOpenReservation,
  IReservation,
  IVaultEvent,
  IWhitelistedToken,
  IWithdrawRequestData
} from '@/types/vault.ts';
import {
  bottomToast,
  formatNumberToUint256,
  formatUint256toNumber,
  isMobileChrome,
  shortenAddress,
  validateAddress
} from '@/utils/helpers.ts';
import {markRaw} from 'vue';

export const useContractsStore = defineStore('contracts', {
  state: (): IContractsStore => ({
    web3: null,
    firstSign: false,
    connectedAccount: '',
    balance: '',
    vaultBalance: null,
    amountDecimalPoints: 6,
    contractBalance: {
      eth: 0,
      usdt: 0
    },
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
      completeWithdraw: false
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
    vaultMissing: false,
    blocksOffset: 5000,
    completedWithdrawals: [],
    cancelledWithdrawals: [],
    daysOffset: TODAY_TIME,
    thresholdPrompt: '',
    rpc: {
      name: '',
      url: ''
    },
    usdc: {
      contract: null,
      balance: 0
    },
    xaut: {
      contract: null,
      balance: 0
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
          (item) =>
            item.value.toLowerCase() === state.currencyToken.toLowerCase()
        )?.name || state.activeChain.currencies[0].name
      );
    },
    selectedBalance: (state) => {
      if (!state.activeChain) {
        return 0;
      }

      const name = state.activeChain.currencies.find(
        (item) => item.value.toLowerCase() === state.currencyToken.toLowerCase()
      )?.name;

      if (name === 'USDC') {
        return state.usdc.balance;
      }

      if (name === 'XAUT0') {
        return state.xaut.balance;
      }

      return state.contractBalance.usdt;
    },
    /** Avalanche always has XAUT0 in the list, Polygon only tokens with balance */
    showCurrencySwitch: (state): boolean => state.tokens.length > 1
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

    async connectMetamask(pickAccount = false) {
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
        /** When the user clicks Connect always open the MetaMask account picker. eth_requestAccounts alone skips it once the site has been permitted */
        if (pickAccount) {
          try {
            await this.provider.request({
              method: 'wallet_requestPermissions',
              params: [{eth_accounts: {}}]
            });
          } catch (error) {
            /** The user closed the account picker */
            if ((error as any).code === 4001) {
              throw error;
            }

            /** Wallets that don't support the permissions request continue with eth_requestAccounts */
          }
        }

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

        /** Make a connection to the Vault Smart Contract - Check if the metamask address owns a Vault contract. If it does save the contract to the global state, otherwise show the "No vault found" screen */
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

    resetBalance() {
      this.balance = '';
      this.contractBalance = {
        eth: 0,
        usdt: 0
      };
      this.vaultBalance = null;
    },

    disconnectMetamask() {
      /** Account and vault */
      this.contractIndex = 0;
      this.connectedAccount = '';
      this.allAccounts = [];
      this.vaultAddress = '';
      this.availableVaults = [];
      this.vaultContract = null;
      this.vaultMissing = false;
      this.factoryContracts = [];
      sessionStorage.removeItem('firstSign');

      /** Balances and currencies */
      this.resetBalance();
      this.usdc = {contract: null, balance: 0};
      this.xaut = {contract: null, balance: 0};
      this.tokens = this.activeChain ? [this.activeChain.currencies[0]] : [];
      this.currencyToken = this.activeChain?.currencies[0].value ?? '';

      /** Withdrawals */
      this.daysOffset = TODAY_TIME;
      this.withdrawalRequests = [];
      this.thresholdPrompt = '';
      this.resetWithdrawalsList();

      /** Modals and forms */
      this.updateModal({
        connect: false,
        withdrawConnected: false,
        withdrawExternal: false,
        cancelWithdraw: false,
        completeWithdraw: false,
        overtime: false
      });
      this.updateError({
        external: false,
        connected: false,
        externalAddress: false
      });
      this.updateWallet('connected', {step: 1});
      this.updateWallet('external', {step: 1});
      this.updateFormField(null, 'connected', 'amount');
      this.updateFormField(null, 'external', 'amount');
      this.updateFormField('', 'external', 'address');
      this.updateLoading({
        balance: false,
        history: false,
        withdrawConnected: false,
        withdrawExternal: false,
        withdraw: false,
        cancelWithdraw: false,
        completeWithdraw: false
      });
    },

    async disconnectWallet() {
      /** Clear the local state first so the app shows the disconnected screen right away */
      this.disconnectMetamask();
      this.firstSign = false;

      if (!this.provider) {
        return;
      }

      try {
        /** Remove the site's access to the accounts in MetaMask. MetaMask then emits accountsChanged with an empty list, which keeps the disconnected screen and doesn't prompt again */
        await this.provider.request({
          method: 'wallet_revokePermissions',
          params: [{eth_accounts: {}}]
        });
      } catch (error) {
        console.error(
          'Error revoking MetaMask permissions: ',
          (error as Error).message
        );
      }
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
        if (!this.vaultContract && !this.vaultMissing) {
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
        /** The connect flow reads the selected account itself once the MetaMask account picker is closed */
        if (this.loading.connect) {
          return;
        }

        this.contractIndex = 0;
        this.updateModal({connect: false});
        this.disconnectMetamask();

        /** If the accounts array is empty the wallet was disconnected in MetaMask, show the disconnected state on app */
        if (!accounts.length) {
          return;
        }

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

    async getVaultBalance() {
      if (!this.vaultContract) {
        return;
      }

      if (!this.activeChain) {
        return;
      }

      try {
        /** Set the balance (in USDT) by calling the "getProtocolTokenBalances" from the Vault SC */
        const balanceMethod = this.activeChain.balanceCall;
        this.vaultBalance =
          await this.vaultContract.methods[balanceMethod]().call();

        this.tokens = [this.activeChain.currencies[0]];

        /** Set USDC balance */
        const usdcBalance = (await this.usdc.contract?.methods
          .balanceOf(this.vaultAddress)
          .call()) as bigint;
        this.usdc.balance = formatUint256toNumber(usdcBalance);

        if (this.usdc.balance) {
          this.tokens = [
            ...this.tokens,
            {
              name: 'USDC',
              value:
                this.activeChain.currencies.find((item) => item.name === 'USDC')
                  ?.value || '',
              id:
                this.activeChain.currencies.find(
                  (currency) => currency.name === 'USDC'
                )?.id ?? 0
            }
          ];
        }

        /** Set XAUT balance */
        const xautBalance = (await this.xaut.contract?.methods
          .balanceOf(this.vaultAddress)
          .call()) as bigint;
        this.xaut.balance = formatUint256toNumber(xautBalance);

        /** XAUT0 is always offered on Avalanche */
        if (this.xaut.balance || this.activeChain.id === 43114) {
          this.tokens = [
            ...this.tokens,
            {
              name: 'XAUT0',
              value:
                this.activeChain.currencies.find(
                  (item) => item.name === 'XAUT0'
                )?.value || '',
              id:
                this.activeChain.currencies.find(
                  (currency) => currency.name === 'XAUT0'
                )?.id ?? 0
            }
          ];
        }

        /** Check if the currency token currently active still has balance in the vault. If not reset the selection to the first item in the currency array */
        const currencyTokenActive = this.tokens.some(
          (item) =>
            item.value.toLowerCase() === this.currencyToken.toLowerCase()
        );
        if (!currencyTokenActive) {
          this.currencyToken = this.tokens[0].value;
        }

        if (!this.vaultBalance) {
          return;
        }

        const balanceKey: 'avaliableBalance' | 'availableBalance' =
          this.activeChain.id === 137 ? 'avaliableBalance' : 'availableBalance';
        const converted = formatUint256toNumber(
          (
            this.vaultBalance as unknown as Record<
              typeof balanceKey,
              bigint | undefined
            >
          )[balanceKey] ?? 0n
        );

        this.contractBalance = {
          ...this.contractBalance,
          usdt: converted
        };
      } catch (error) {
        console.error(
          'Error fetching vault balance: ',
          (error as Error).message
        );
      }
    },

    extractWithdrawRequestRecipient(
      input: string,
      token: string,
      amount: bigint
    ): string | null {
      if (!this.web3) return null;

      const selector = this.web3.eth.abi
        .encodeFunctionSignature('withdrawRequest(address,address,uint256)')
        .slice(2)
        .toLowerCase();
      const data = input.toLowerCase().replace(/^0x/, '');

      for (
        let i = data.indexOf(selector);
        i !== -1;
        i = data.indexOf(selector, i + 1)
      ) {
        if (i % 2 !== 0) continue; // must start on a byte boundary
        const args = data.slice(i + 8, i + 8 + 192); // 3 × 32 bytes
        if (args.length !== 192) continue;
        try {
          const d = this.web3.eth.abi.decodeParameters(
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
      return null;
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

      if (this.selectedBalance < this.form.connected.amount.value) {
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
          /** Check in the Vault SC that no withdrawal request is open right before making a new one */
          if (await this.getOpenReservation()) {
            this.updateModal({withdrawConnected: false});
            this.resetConnectedForm();
            bottomToast(
              'You can not create multiple withdrawal requests. Confirm or cancel the existing withdrawal to create a new one.',
              5000,
              'toast__wide toast__withdrawal'
            );
            this.updateHistoryList();
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
            `Withdraw to: ${shortenAddress(
              this.connectedAccount
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

      if (this.selectedBalance < this.form.external.amount.value) {
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
          /** Check in the Vault SC that no withdrawal request is open right before making a new one */
          if (await this.getOpenReservation()) {
            this.updateModal({withdrawExternal: false});
            this.resetExternalForm();
            bottomToast(
              'You can not create multiple withdrawal requests. Confirm or cancel the existing withdrawal to create a new one.',
              5000,
              'toast__wide toast__withdrawal'
            );
            this.updateHistoryList();
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

        /** Init the recipient before the form gets reset, it is used in the success toast */
        const recipient = this.form.external.address.value;

        /** Close the modal and reset the form  */
        this.updateModal({withdrawExternal: false});
        this.updateFormField(null, 'external', 'amount');
        this.updateFormField('', 'external', 'address');
        this.updateWallet('external', {step: 1});

        if (method === 'withdraw') {
          bottomToast(
            `Withdraw to: ${shortenAddress(
              recipient
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

    async getOpenReservation(): Promise<IOpenReservation | null> {
      if (
        !this.vaultContract ||
        !this.activeChain ||
        !this.factoryContracts.length
      ) {
        return null;
      }

      const factory = this.factoryContracts[this.contractIndex];

      /** Single-token vaults (Polygon): the vault keeps one reservation, for the protocol token */
      if (!factory.methods['getAllAvailableWhitelistedTokens']) {
        const reservation: IReservation =
          await this.vaultContract.methods[
            this.activeChain.reservationCall
          ]().call();

        if (BigInt(reservation.amount) <= 0n) {
          return null;
        }

        return {
          token: this.activeChain.currencies[0].value,
          amount: BigInt(reservation.amount),
          unlockTime: BigInt(reservation.unlockTime)
        };
      }

      /** Multi-token vaults (Avalanche): check the reservation of every whitelisted token */
      const whitelistedTokens: string[] =
        await factory.methods['getAllAvailableWhitelistedTokens']().call();

      for (let index = 0; index < whitelistedTokens.length; index++) {
        const whitelistedToken: IWhitelistedToken =
          await factory.methods['getAvailableWhitelistedTokenByIndex'](
            index
          ).call();

        const reservation: IReservation = await this.vaultContract.methods[
          'getWithdrawPaymentTokenReservationByTokenId'
        ](Number(whitelistedToken.tokenId)).call();

        if (BigInt(reservation.amount) > 0n) {
          return {
            token: whitelistedToken.tokenAddress,
            amount: BigInt(reservation.amount),
            unlockTime: BigInt(reservation.unlockTime)
          };
        }
      }

      return null;
    },

    async findBlockByTimestamp(timestamp: number) {
      if (!this.web3) {
        return 0;
      }

      /** Binary search for the first block with a timestamp equal or higher than the provided one */
      let low = 0;
      let high = this.lastBlock || Number(await this.web3.eth.getBlockNumber());

      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        const block = await this.web3.eth.getBlock(middle);

        if (Number(block.timestamp) < timestamp) {
          low = middle + 1;
        } else {
          high = middle;
        }
      }

      return low;
    },

    async findWithdrawRequestEvent(
      reservation: IOpenReservation,
      lockDuration: bigint
    ) {
      if (!this.activeChain) {
        return;
      }

      const matchesReservation = (item: IVaultEvent<IWithdrawRequestData>) =>
        item.returnValues.token.toLowerCase() ===
          reservation.token.toLowerCase() &&
        BigInt(item.returnValues.unlockTime) === reservation.unlockTime;

      /** First look in the events of the selected history period */
      await this.getWithdrawRequests();
      const recentRequest = this.withdrawalRequests
        .filter(matchesReservation)
        .at(-1);

      if (recentRequest) {
        return recentRequest;
      }

      /** Older request: find the block it was made in from its unlock time and search one day of blocks around it */
      const requestBlock = await this.findBlockByTimestamp(
        Number(reservation.unlockTime) - Number(lockDuration)
      );
      const web3Instance = new Web3(this.rpc.url);
      const vaultContract = new web3Instance.eth.Contract(
        this.activeChain.vaultAbi,
        this.vaultAddress
      );
      const toBlock = requestBlock + this.blocksOffset;

      const requests = (await (vaultContract as any).getPastEvents(
        'WithdrawRequest',
        {
          fromBlock: Math.max(requestBlock - this.blocksOffset, 0),
          toBlock:
            this.lastBlock && toBlock < this.lastBlock ? toBlock : 'latest'
        }
      )) as IVaultEvent<IWithdrawRequestData>[];

      return requests.filter(matchesReservation).at(-1);
    },

    async getActiveRequest() {
      if (
        !this.factoryContracts.length ||
        !this.vaultContract ||
        !this.web3 ||
        !this.activeChain
      ) {
        return;
      }

      try {
        this.activeRequest = null;

        /** The reservation saved in the Vault SC is the source of truth. Events are only fetched for the selected history period, so an older open request would be missed */
        const reservation = await this.getOpenReservation();

        /** Stop propagation if no amount is reserved */
        if (!reservation) {
          return;
        }

        /** Fetch a lock duration of the withdrawal request from the factory contract */
        const lockDuration: bigint =
          await this.factoryContracts[this.contractIndex].methods[
            this.activeChain.reservationLockCall
          ]().call();

        /** The reservation doesn't hold the recipient address. It is read from the transaction of the WithdrawRequest event. If it can't be found the request is still kept (so it blocks new requests and can be cancelled) but it can't be completed */
        let recipient: string | null = null;

        try {
          const request = await this.findWithdrawRequestEvent(
            reservation,
            lockDuration
          );

          if (request) {
            const transaction = await this.web3.eth.getTransaction(
              request.transactionHash
            );

            recipient = this.extractWithdrawRequestRecipient(
              transaction.input,
              request.returnValues.token,
              request.returnValues.amount
            );
          }
        } catch (error) {
          console.error(
            'Could not find recipient for withdraw request: ',
            (error as Error).message
          );
        }

        /** The unlockTime fetched from the SC is in seconds. First we need to multiply it with 1000 to convert it to milliseconds, then we can use Date to mutate it */
        this.activeRequest = {
          address: recipient ?? '',
          amount: formatUint256toNumber(reservation.amount),
          date: new Date(
            (Number(reservation.unlockTime) - Number(lockDuration)) * 1000
          ),
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

    async findRecipientForCancellation(cancelTxHash: string) {
      if (!this.web3 || !this.vaultContract) {
        return;
      }

      try {
        /** Get the cancel transaction receipt */
        const transactionReceipt =
          await this.web3.eth.getTransactionReceipt(cancelTxHash);

        /** Stop propagation if there is no transaction with provided hash */
        if (!transactionReceipt) {
          return;
        }

        /** Get token address from the CanceledWithdrawReservation event */
        const event = transactionReceipt.logs.find(
          (log) =>
            log.address?.toLowerCase() === this.vaultAddress.toLowerCase()
        );

        /** Stop propagation if no cancelled requests are found */
        if (!event || !event.data || !event.topics) {
          return;
        }

        /** Decode the log by providing data from the cancelled receipt */
        const decodedEvent = this.web3.eth.abi.decodeLog(
          [
            {indexed: true, name: 'token', type: 'address'},
            {indexed: false, name: 'amount', type: 'uint256'}
          ],
          event.data,
          event.topics
        );

        /** Set currency token and amount requested */
        const token = String(decodedEvent.token);
        const amount = BigInt(decodedEvent.amount as bigint);

        /** Search backwards for the withdrawRequest with the same token + amount (requires scanning past logs for WithdrawRequest events) */
        if (!this.withdrawalRequests.length) {
          await this.getWithdrawRequests();
        }

        const cancelledRequest = this.withdrawalRequests
          .filter(
            (item) =>
              BigInt(item.blockNumber) <=
                BigInt(transactionReceipt.blockNumber) &&
              amount === BigInt(item.returnValues.amount) &&
              token.toLowerCase() === item.returnValues.token.toLowerCase()
          )
          .at(-1);

        /** Throw an error if no compatible request is found */
        if (!cancelledRequest) {
          return;
        }

        /** Find the transaction of the log */
        const cancelledTransaction = await this.web3.eth.getTransaction(
          cancelledRequest.transactionHash
        );

        const recipient = this.extractWithdrawRequestRecipient(
          cancelledTransaction.input,
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
      } catch (error) {
        throw new Error('Matching withdrawRequest not found');
      }
    },

    async getCancelledWithdrawals() {
      if (!this.activeChain) {
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

        /** Map the cancellations by adding a timestamp to the object from cancellation block */
        const constructedCancellations = cancelledWithdrawals.map(
          async (cancellation) => {
            if (!this.web3) {
              return;
            }

            const block = await this.web3.eth.getBlock(
              cancellation.blockNumber,
              true
            );
            const timestamp = block.timestamp;
            const cancelledTx = await this.findRecipientForCancellation(
              cancellation.transactionHash
            );

            return {
              address: cancelledTx ? cancelledTx.recipient : '',
              amount: formatUint256toNumber(cancellation.returnValues.amount),
              date: new Date(Number(timestamp) * 1000),
              status: 'cancelled',
              token: cancellation.returnValues.token
            };
          }
        );

        /** Resolve mapping promises */
        this.cancelledWithdrawals = (
          await Promise.all(constructedCancellations)
        ).filter((item) => item?.address) as IWithdrawal[];
      } catch (error) {
        console.error(
          'Error fetching cancelled withdrawals: ',
          (error as Error).message
        );
      }
    },

    async getCompletedWithdrawals() {
      if (!this.activeChain) {
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

        /** Map the withdrawals by adding a timestamp to the object from withdrawal block */
        const constructedWithdrawals = withdrawals.map(
          async (withdrawal: any) => {
            if (!this.web3) {
              return;
            }

            const block = await this.web3.eth.getBlock(withdrawal.blockNumber);
            const timestamp = block.timestamp;

            return {
              address: withdrawal.returnValues.recipient, //Recipients address
              amount: formatUint256toNumber(withdrawal.returnValues.amount),
              date: new Date(Number(timestamp) * 1000),
              status: 'complete',
              token: withdrawal.returnValues.token
            };
          }
        );

        /** Resolve mapping promises */
        this.completedWithdrawals = await Promise.all(constructedWithdrawals);
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

        /** Set USDC contract */
        this.usdc.contract = new this.web3.eth.Contract(
          usdcABI,
          this.activeChain.currencies.find((item) => item.name === 'USDC')
            ?.value || ''
        );

        /** Set XAUT contract */
        this.xaut.contract = new this.web3.eth.Contract(
          xautABI,
          this.activeChain.currencies.find((item) => item.name === 'XAUT0')
            ?.value || ''
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
        /** Check on every factory contract of the chain if the connected wallet address owns a Vault smart contract */
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

        /** Set the vault address of the current address (if there are multiple there is a selector in UI) */
        this.vaultAddress = this.availableVaults[this.contractIndex] ?? '';

        /** The app never creates a vault. If the connected wallet doesn't own one on this chain show the "No vault found" screen */
        if (!this.vaultAddress) {
          this.vaultContract = null;
          this.resetBalance();
          this.resetWithdrawalsList();
          this.updateLoading({history: false});
          this.vaultMissing = true;
          return;
        }

        this.vaultMissing = false;
        await this.setVaultContract(this.vaultAddress);
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
          `Withdraw to: ${shortenAddress(
            this.activeRequest.address
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
