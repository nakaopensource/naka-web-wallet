import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {createPinia, setActivePinia} from 'pinia';
import {toast} from 'vue3-toastify';
import {
  findBlockRangeForTimestamp,
  useContractsStore
} from '@/stores/contracts.ts';
import {avalancheMainnet, CHAINS, polygonMainnet} from '@/utils/constants.ts';

/** vue3-toastify — the store fires toasts on most error paths */
vi.mock('vue3-toastify', () => {
  const toastFn = Object.assign(vi.fn(), {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(() => 'toast-id'),
    remove: vi.fn()
  });
  return {toast: toastFn};
});

/** MetaMask SDK instantiates transports at import time — stub it out */
vi.mock('@/utils/metamask.ts', () => ({
  metamaskSdk: {getProvider: vi.fn(() => null)},
  provider: null
}));

/** Web3 constructor mock — instances expose what initializeWeb3 and the history readers touch */
const mockGetChainId = vi.fn();
const mockGetPastEvents = vi.fn();
const mockRpcGetTransaction = vi.fn();
vi.mock('web3', () => {
  class MockWeb3 {
    provider: unknown;
    eth = {
      getChainId: mockGetChainId,
      getBalance: vi.fn(),
      getTransaction: mockRpcGetTransaction,
      Contract: class {
        getPastEvents = mockGetPastEvents;
      }
    };
    utils = {fromWei: vi.fn()};
    constructor(provider: unknown) {
      this.provider = provider;
    }
  }
  return {Web3: MockWeb3, Contract: class {}};
});

const polygonChain = CHAINS.find((chain) => chain.id === 137)!;
const avaxChain = CHAINS.find((chain) => chain.id === 43114)!;

/** Lowercase token addresses — the keys of store.balances */
const tokenAddress = (chain: typeof polygonChain, name: string) =>
  chain.currencies.find((c) => c.name === name)!.value.toLowerCase();
const USDT0 = tokenAddress(polygonChain, 'USDT0');
const POLY_USDC = tokenAddress(polygonChain, 'USDC');
const POLY_XAUT0 = tokenAddress(polygonChain, 'XAUT0');
const AVAX_USDT = tokenAddress(avaxChain, 'USDT');
const AVAX_USDC = tokenAddress(avaxChain, 'USDC');
const AVAX_XAUT0 = tokenAddress(avaxChain, 'XAUT0');

/** web3 contract-method mocks: method(...args).call() */
const resolves = (value: unknown) => ({
  call: vi.fn().mockResolvedValue(value)
});
const rejects = (message: string) => ({
  call: vi.fn().mockRejectedValue(new Error(message))
});

/** Fake web3 whose ERC-20 contracts answer balanceOf from a map (Error = the read fails) */
const makeWeb3 = (erc20Balances: Record<string, bigint | Error> = {}) => ({
  eth: {
    Contract: class {
      methods: unknown;
      constructor(_abi: unknown, address: string) {
        const value = erc20Balances[address.toLowerCase()] ?? 0n;
        this.methods = {
          balanceOf: vi.fn(() =>
            value instanceof Error ? rejects(value.message) : resolves(value)
          )
        };
      }
    },
    getBlock: vi.fn()
  }
});

/** Avalanche registry: USDT = token id 1, XAUT0 = 2, USDC is not whitelisted (reverts) */
const makeAvaxRegistry = () => ({
  options: {address: '0xavaxregistry'},
  methods: {
    getWhitelistedTokenId: vi.fn((token: string) => {
      const id = {[AVAX_USDT]: 1n, [AVAX_XAUT0]: 2n}[token.toLowerCase()];
      return id === undefined ? rejects('not whitelisted') : resolves(id);
    }),
    getPaymentTokenWithdrawalReservationLockDuration: vi.fn(() =>
      resolves(3600n)
    )
  }
});

const makePolygonRegistry = () => ({
  options: {address: '0xpolygonregistry'},
  methods: {
    getProtocolTokenWithdrawalReservationLockDuration: vi.fn(() =>
      resolves(3600n)
    )
  }
});

const nowSeconds = () => Math.floor(Date.now() / 1000);

const makeProvider = () => ({
  on: vi.fn(),
  request: vi.fn()
});

describe('contracts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    sessionStorage.clear();
  });

  describe('getters', () => {
    describe('activeNetwork', () => {
      it('falls back to an unknown-chain placeholder when no chain is set', () => {
        const store = useContractsStore();
        expect(store.activeNetwork).toEqual({
          name: 'Unknown Chain',
          icon: './img/icons/bitcoin-btc-logo.png',
          id: '/',
          symbol: ''
        });
      });

      it('maps the active Polygon chain to its network metadata', () => {
        const store = useContractsStore();
        store.activeChain = polygonChain;
        expect(store.activeNetwork).toEqual({
          name: 'Polygon',
          icon: './img/icons/polygon-matic-logo.png',
          id: 'polygon',
          symbol: 'POL'
        });
      });

      it('maps the active Avalanche chain to its network metadata', () => {
        const store = useContractsStore();
        store.activeChain = avaxChain;
        expect(store.activeNetwork.name).toBe('Avalanche (C-Chain)');
        expect(store.activeNetwork.symbol).toBe('AVAX');
      });
    });

    describe('selectedCurrency', () => {
      it('is undefined when no chain is active', () => {
        const store = useContractsStore();
        expect(store.selectedCurrency).toBeUndefined();
      });

      it('resolves the name of the selected currency token', () => {
        const store = useContractsStore();
        store.activeChain = polygonChain;
        store.currencyToken = polygonChain.currencies[1].value;
        expect(store.selectedCurrency).toBe('USDC');
      });

      it('falls back to the first currency when the token is unknown', () => {
        const store = useContractsStore();
        store.activeChain = polygonChain;
        store.currencyToken = '0xdeadbeef';
        expect(store.selectedCurrency).toBe(polygonChain.currencies[0].name);
      });
    });
  });

  describe('initializeWeb3', () => {
    it('sets chain, tokens, currency and rpc from the detected chain id', async () => {
      const store = useContractsStore();
      const provider = makeProvider();
      mockGetChainId.mockResolvedValue(137n);

      await store.initializeWeb3(provider);

      expect(store.activeChain?.id).toBe(137);
      expect(store.tokens).toEqual([polygonChain.currencies[0]]);
      expect(store.currencyToken).toBe(polygonChain.currencies[0].value);
      expect(store.rpc).toEqual(polygonChain.rpcs[0]);
    });

    it('registers chainChanged and accountsChanged listeners', async () => {
      const store = useContractsStore();
      const provider = makeProvider();
      mockGetChainId.mockResolvedValue(137n);

      await store.initializeWeb3(provider);

      const events = provider.on.mock.calls.map((call) => call[0]);
      expect(events).toContain('chainChanged');
      expect(events).toContain('accountsChanged');
    });

    it('leaves chain state untouched for an unsupported chain id', async () => {
      const store = useContractsStore();
      const provider = makeProvider();
      mockGetChainId.mockResolvedValue(1n);

      await store.initializeWeb3(provider);

      expect(store.activeChain).toBeNull();
      expect(store.currencyToken).toBe('');
    });
  });

  describe('updateChain', () => {
    it('switches the chain by hex id and resets tokens and rpc', () => {
      const store = useContractsStore();
      store.updateChain(avalancheMainnet.chainId);

      expect(store.activeChain?.id).toBe(43114);
      expect(store.tokens).toEqual([avaxChain.currencies[0]]);
      expect(store.currencyToken).toBe(avaxChain.currencies[0].value);
      expect(store.rpc).toEqual(avaxChain.rpcs[0]);
    });

    it('is a no-op for an unknown hex id', () => {
      const store = useContractsStore();
      store.activeChain = polygonChain;
      store.updateChain('0x1');
      expect(store.activeChain.id).toBe(137);
    });
  });

  describe('form state', () => {
    it('updateFormField sets the connected amount', () => {
      const store = useContractsStore();
      store.updateFormField(42, 'connected', 'amount');
      expect(store.form.connected.amount.value).toBe(42);
    });

    it('updateFormField sets the external address', () => {
      const store = useContractsStore();
      store.updateFormField('0xabc', 'external', 'address');
      expect(store.form.external.address.value).toBe('0xabc');
    });

    it('updateWallet merges partial wallet data', () => {
      const store = useContractsStore();
      store.updateWallet('external', {step: 3});
      expect(store.wallets.external.step).toBe(3);
      expect(store.wallets.connected.step).toBe(1);
    });

    it('updateLoading and updateModal merge partials without clobbering', () => {
      const store = useContractsStore();
      store.updateLoading({connect: true});
      store.updateModal({withdrawExternal: true});

      expect(store.loading.connect).toBe(true);
      expect(store.loading.history).toBe(false);
      expect(store.modal.withdrawExternal).toBe(true);
      expect(store.modal.connect).toBe(false);
    });
  });

  describe('resetConnectedForm', () => {
    it('resets step, amount, error and loading', () => {
      const store = useContractsStore();
      store.updateFormField(10, 'connected', 'amount');
      store.updateError({connected: true});
      store.updateLoading({withdrawConnected: true});

      store.resetConnectedForm();

      expect(store.wallets.connected.step).toBe(1);
      expect(store.form.connected.amount.value).toBeNull();
      expect(store.error.connected).toBe(false);
      expect(store.loading.withdrawConnected).toBe(false);
    });

    it('refreshes the withdrawal list when leaving the success step', () => {
      const store = useContractsStore();
      const refreshSpy = vi
        .spyOn(store, 'getWithdrawalHistory')
        .mockResolvedValue();
      store.updateWallet('connected', {step: 2});

      store.resetConnectedForm();

      expect(refreshSpy).toHaveBeenCalledOnce();
    });

    it('does not refresh the list from step 1', () => {
      const store = useContractsStore();
      const refreshSpy = vi
        .spyOn(store, 'getWithdrawalHistory')
        .mockResolvedValue();

      store.resetConnectedForm();

      expect(refreshSpy).not.toHaveBeenCalled();
    });
  });

  describe('resetExternalForm', () => {
    it('resets step, fields, error and loading', () => {
      const store = useContractsStore();
      store.updateFormField(10, 'external', 'amount');
      store.updateFormField('0xabc', 'external', 'address');
      store.updateWallet('external', {step: 2});
      store.updateError({external: true});

      store.resetExternalForm();

      expect(store.wallets.external.step).toBe(1);
      expect(store.form.external.amount.value).toBeNull();
      expect(store.form.external.address.value).toBe('');
      expect(store.error.external).toBe(false);
    });

    it('refreshes the withdrawal list only from the success step', () => {
      const store = useContractsStore();
      const refreshSpy = vi
        .spyOn(store, 'getWithdrawalHistory')
        .mockResolvedValue();
      store.updateWallet('external', {step: 3});

      store.resetExternalForm();

      expect(refreshSpy).toHaveBeenCalledOnce();
    });
  });

  describe('resetWithdrawalsList', () => {
    it('clears the active request and all withdrawal lists', () => {
      const store = useContractsStore();
      store.activeRequest = {
        address: '0xabc',
        amount: 1,
        date: new Date(),
        status: 'pending',
        token: '0xdef'
      };
      store.withdrawals = [store.activeRequest];
      store.completedWithdrawals = [store.activeRequest];
      store.cancelledWithdrawals = [store.activeRequest];

      store.resetWithdrawalsList();

      expect(store.activeRequest).toBeNull();
      expect(store.withdrawals).toEqual([]);
      expect(store.completedWithdrawals).toEqual([]);
      expect(store.cancelledWithdrawals).toEqual([]);
    });
  });

  describe('disconnectMetamask', () => {
    it('clears the wallet session and removes the firstSign flag', () => {
      const store = useContractsStore();
      sessionStorage.setItem('firstSign', 'true');
      store.connectedAccount = '0xabc';
      store.vaultAddress = '0xdef';
      store.balance = '1.5';
      store.balances = {[USDT0]: 100};
      store.activeFactory = {} as never;

      store.disconnectMetamask();

      expect(store.connectedAccount).toBe('');
      expect(store.vaultAddress).toBe('');
      expect(store.balance).toBe('');
      expect(store.balances).toEqual({});
      expect(store.vaultContract).toBeNull();
      expect(store.factoryContracts).toEqual([]);
      expect(store.activeFactory).toBeNull();
      expect(sessionStorage.getItem('firstSign')).toBeNull();
    });
  });

  describe('getBalance', () => {
    it('formats the fetched balance to five decimals and toggles loading', async () => {
      const store = useContractsStore();
      store.connectedAccount = '0xabc';
      store.web3 = {
        eth: {getBalance: vi.fn().mockResolvedValue(1500000000000000000n)},
        utils: {fromWei: vi.fn().mockReturnValue('1.5')}
      } as never;

      await store.getBalance();

      expect(store.balance).toBe('1.50000');
      expect(store.loading.balance).toBe(false);
    });

    it('does nothing without a web3 instance', async () => {
      const store = useContractsStore();
      await store.getBalance();
      expect(store.balance).toBe('');
    });

    it('recovers loading state when the RPC call rejects', async () => {
      const store = useContractsStore();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      store.web3 = {
        eth: {getBalance: vi.fn().mockRejectedValue(new Error('rpc down'))},
        utils: {fromWei: vi.fn()}
      } as never;

      await store.getBalance();

      expect(store.balance).toBe('');
      expect(store.loading.balance).toBe(false);
    });
  });

  describe('connectMetamask guards', () => {
    it('informs the user when no web3 instance exists', async () => {
      const store = useContractsStore();
      await store.connectMetamask();
      expect(toast.info).toHaveBeenCalledWith('no Web3 provided');
    });

    it('prompts a MetaMask install when web3 exists but no provider does', async () => {
      const store = useContractsStore();
      store.web3 = {} as never;
      store.provider = null;

      await store.connectMetamask();

      expect(toast.error).toHaveBeenCalledWith('Please install MetaMask!');
    });
  });

  describe('connectContract', () => {
    it('rejects unsupported chains before touching the factory contract', async () => {
      const store = useContractsStore();
      store.web3 = {eth: {Contract: class {}}} as never;
      store.activeChain = {...polygonChain, hexId: '0x1'};

      await store.connectContract();

      expect(toast.error).toHaveBeenCalledWith(
        'Switch to either Polygon and Avalanche chain'
      );
      expect(store.factoryContracts).toEqual([]);
    });
  });

  describe('submitConnectedForm guards', () => {
    it('does nothing when the amount is empty', async () => {
      const store = useContractsStore();
      store.vaultContract = {methods: {}} as never;
      store.activeChain = polygonChain;

      await store.submitConnectedForm();

      expect(store.loading.withdrawConnected).toBe(false);
      expect(store.wallets.connected.step).toBe(1);
    });

    it('does nothing when the amount exceeds the vault balance', async () => {
      const store = useContractsStore();
      const withdrawRequest = vi.fn();
      store.vaultContract = {methods: {withdrawRequest}} as never;
      store.activeChain = polygonChain;
      store.currencyToken = polygonChain.currencies[0].value;
      store.balances = {[USDT0]: 50};
      store.updateFormField(100, 'connected', 'amount');

      await store.submitConnectedForm();

      expect(withdrawRequest).not.toHaveBeenCalled();
      expect(store.wallets.connected.step).toBe(1);
    });

    it('resets the form instead of submitting after a failed attempt', async () => {
      const store = useContractsStore();
      const resetSpy = vi.spyOn(store, 'resetConnectedForm');
      store.vaultContract = {methods: {}} as never;
      store.activeChain = polygonChain;
      store.currencyToken = polygonChain.currencies[0].value;
      store.balances = {[USDT0]: 500};
      store.updateFormField(100, 'connected', 'amount');
      store.updateError({connected: true});

      await store.submitConnectedForm();

      expect(resetSpy).toHaveBeenCalledOnce();
    });
  });

  describe('getEstimatedGas', () => {
    it('applies the buffer and derives EIP-1559 fees from fee history (non-Polygon path)', async () => {
      const store = useContractsStore();
      store.activeChain = avaxChain;
      store.connectedAccount = '0xabc';
      store.web3 = {} as never;
      store.provider = {
        request: vi.fn().mockImplementation(({method}: {method: string}) => {
          if (method === 'eth_feeHistory') {
            return Promise.resolve({
              /** 1 gwei, 1 gwei, 2 gwei priority fees */
              reward: [['0x3b9aca00'], ['0x3b9aca00'], ['0x77359400']]
            });
          }
          if (method === 'eth_getBlockByNumber') {
            /** 30 gwei base fee */
            return Promise.resolve({baseFeePerGas: '0x6fc23ac00'});
          }
          return Promise.reject(new Error(`unexpected ${method}`));
        })
      };

      const contract = {
        methods: {
          withdraw: vi.fn(() => ({
            estimateGas: vi.fn().mockResolvedValue(21000n)
          }))
        }
      };

      await store.getEstimatedGas(contract, 'withdraw', ['0xtoken'], 1.2);

      expect(store.transactionGas.gas).toBe(Math.floor(21000 * 1.2));
      /** p50 of [1, 1, 2] gwei = 1 gwei */
      expect(store.transactionGas.maxPriorityFeePerGas).toBe(1_000_000_000);
      /** (base * 2 + priority) * 10 = (60 + 1) gwei * 10 */
      expect(store.transactionGas.maxFeePerGas).toBe(610_000_000_000);
    });

    it('forwards the method arguments to estimateGas from the connected account', async () => {
      const store = useContractsStore();
      store.activeChain = avaxChain;
      store.connectedAccount = '0xabc';
      store.web3 = {} as never;
      store.provider = {
        request: vi
          .fn()
          .mockImplementation(({method}: {method: string}) =>
            method === 'eth_feeHistory'
              ? Promise.resolve({reward: [['0x3b9aca00']]})
              : Promise.resolve({baseFeePerGas: '0x3b9aca00'})
          )
      };

      const estimateGas = vi.fn().mockResolvedValue(50000n);
      const withdrawRequest = vi.fn(() => ({estimateGas}));
      const contract = {methods: {withdrawRequest}};

      await store.getEstimatedGas(contract, 'withdrawRequest', [
        '0xtoken',
        '0xrecipient',
        100n
      ]);

      expect(withdrawRequest).toHaveBeenCalledWith(
        '0xtoken',
        '0xrecipient',
        100n
      );
      expect(estimateGas).toHaveBeenCalledWith({from: '0xabc'});
    });

    it('leaves transactionGas untouched when estimation fails (documents the stale-gas bug)', async () => {
      const store = useContractsStore();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      store.activeChain = avaxChain;
      store.connectedAccount = '0xabc';
      store.web3 = {} as never;
      store.provider = {request: vi.fn()};

      const contract = {
        methods: {
          withdraw: vi.fn(() => ({
            estimateGas: vi
              .fn()
              .mockRejectedValue(new Error('estimation failed'))
          }))
        }
      };

      await store.getEstimatedGas(contract, 'withdraw', []);

      /**
       * NOTE: getEstimatedGas swallows the error, so callers proceed to
       * .send() with whatever was in transactionGas before — gas 0 on first
       * use. This test pins the current behaviour; when the store is fixed
       * to rethrow (or callers check the result), update this expectation.
       */
      expect(store.transactionGas.gas).toBe(0);
    });
  });

  describe('selectedBalance', () => {
    it('returns the selected token balance, matching addresses case-insensitively', () => {
      const store = useContractsStore();
      store.balances = {[USDT0]: 2, [POLY_USDC]: 0.5};
      /** Config value is checksummed, balances are keyed lowercase */
      store.currencyToken = polygonChain.currencies[1].value;

      expect(store.selectedBalance).toBe(0.5);
    });

    it('tells "not loaded" apart from "read failed"', () => {
      const store = useContractsStore();
      store.currencyToken = polygonChain.currencies[0].value;

      store.balances = {};
      expect(store.selectedBalance).toBeNull();
      expect(store.selectedBalanceFailed).toBe(false);

      store.balances = {[USDT0]: null};
      expect(store.selectedBalance).toBeNull();
      expect(store.selectedBalanceFailed).toBe(true);
    });
  });

  describe('getVaultBalance', () => {
    it('Polygon: USDT0 from the vault struct ("avaliableBalance"), USDC and XAUT0 from ERC-20 balanceOf', async () => {
      const store = useContractsStore();
      store.activeChain = polygonChain;
      store.currencyToken = polygonChain.currencies[0].value;
      store.vaultAddress = '0xvault';
      store.web3 = makeWeb3({[POLY_USDC]: 1_500_000n}) as never;
      store.vaultContract = {
        methods: {
          getProtocolTokenBalances: vi.fn(() =>
            resolves({
              balance: 2_509_521n,
              avaliableBalance: 2_000_000n,
              withdrawalReservation: 509_521n,
              processPaymentReservation: 0n
            })
          )
        }
      } as never;

      await store.getVaultBalance();

      expect(store.balances).toEqual({
        [USDT0]: 2,
        [POLY_USDC]: 1.5,
        [POLY_XAUT0]: 0
      });
      /** USDC is offered because the vault holds some, XAUT0 isn't */
      expect(store.tokens.map((token) => token.name)).toEqual(['USDT0', 'USDC']);
      expect(store.loading.vaultBalance).toBe(false);

      /** Full breakdown per token stays visible (e.g. in Vue devtools) */
      expect(store.vaultBalance).toEqual({
        USDT0: {
          source: 'protocolToken',
          availableBalance: 2,
          balance: 2.509521,
          withdrawalReservation: 0.509521,
          processPaymentReservation: 0
        },
        USDC: {source: 'erc20', availableBalance: 1.5, balance: 1.5},
        XAUT0: {source: 'erc20', availableBalance: 0, balance: 0}
      });
    });

    it("Avalanche: reads USDT and XAUT0 by registry token id, even when the vault's payment token is XAUT0", async () => {
      /** Mirrors vault 0x9d9E…0599: getPaymentTokenBalances() (current payment token XAUT0) says 0, but 9.979999 USDT is available */
      const store = useContractsStore();
      const getPaymentTokenBalances = vi.fn(() =>
        resolves({availableBalance: 0n})
      );
      store.activeChain = avaxChain;
      store.currencyToken = avaxChain.currencies[0].value;
      store.vaultAddress = '0xvault';
      store.activeFactory = makeAvaxRegistry() as never;
      store.web3 = makeWeb3() as never;
      store.vaultContract = {
        methods: {
          getPaymentTokenBalances,
          getPaymentTokenBalancesByTokenId: vi.fn((tokenId: number) =>
            resolves({availableBalance: tokenId === 1 ? 9_979_999n : 3_788n})
          )
        }
      } as never;

      await store.getVaultBalance();

      expect(store.balances[AVAX_USDT]).toBe(9.979999);
      expect(store.balances[AVAX_XAUT0]).toBe(0.003788);
      expect(store.selectedBalance).toBe(9.979999);
      expect(getPaymentTokenBalances).not.toHaveBeenCalled();
    });

    it('Avalanche: always offers USDT and XAUT0; USDC (not whitelisted) uses raw balanceOf and is offered only when held', async () => {
      const store = useContractsStore();
      store.activeChain = avaxChain;
      store.currencyToken = avaxChain.currencies[0].value;
      store.vaultAddress = '0xvault';
      store.activeFactory = makeAvaxRegistry() as never;
      store.vaultContract = {
        methods: {
          getPaymentTokenBalancesByTokenId: vi.fn(() =>
            resolves({availableBalance: 0n})
          )
        }
      } as never;

      store.web3 = makeWeb3() as never;
      await store.getVaultBalance();
      expect(store.tokens.map((token) => token.name)).toEqual(['USDT', 'XAUT0']);

      store.web3 = makeWeb3({[AVAX_USDC]: 199_997n}) as never;
      await store.getVaultBalance();
      expect(store.balances[AVAX_USDC]).toBe(0.199997);
      expect(store.tokens.map((token) => token.name)).toEqual([
        'USDT',
        'USDC',
        'XAUT0'
      ]);
    });

    it('keeps the other tokens when one read fails, and marks the failed one', async () => {
      const store = useContractsStore();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      store.activeChain = polygonChain;
      store.currencyToken = polygonChain.currencies[0].value;
      store.vaultAddress = '0xvault';
      store.web3 = makeWeb3({[POLY_USDC]: new Error('rate limit')}) as never;
      store.vaultContract = {
        methods: {
          getProtocolTokenBalances: vi.fn(() =>
            resolves({avaliableBalance: 2_000_000n})
          )
        }
      } as never;

      await store.getVaultBalance();

      expect(store.balances[USDT0]).toBe(2);
      expect(store.balances[POLY_USDC]).toBeNull();
      expect(store.balances[POLY_XAUT0]).toBe(0);
    });

    it('marks the balance failed, not 0, when the struct lacks the expected key', async () => {
      const store = useContractsStore();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      store.activeChain = polygonChain;
      store.currencyToken = polygonChain.currencies[0].value;
      store.web3 = makeWeb3() as never;
      store.vaultContract = {
        methods: {
          /** Wrong spelling for the Polygon ABI */
          getProtocolTokenBalances: vi.fn(() =>
            resolves({availableBalance: 2_000_000n})
          )
        }
      } as never;

      await store.getVaultBalance();

      expect(store.balances[USDT0]).toBeNull();
      expect(store.selectedBalanceFailed).toBe(true);
    });

    it('drops the results of a read superseded by a vault switch', async () => {
      const store = useContractsStore();
      let finishRead: (value: unknown) => void = () => {};
      store.activeChain = polygonChain;
      store.currencyToken = polygonChain.currencies[0].value;
      store.web3 = makeWeb3() as never;
      store.vaultContract = {
        methods: {
          getProtocolTokenBalances: vi.fn(() => ({
            call: () => new Promise((resolve) => (finishRead = resolve))
          }))
        }
      } as never;

      const read = store.getVaultBalance();
      store.resetVaultBalances();
      finishRead({avaliableBalance: 7_000_000n});
      await read;

      expect(store.balances).toEqual({});
      expect(store.loading.vaultBalance).toBe(false);
    });

    it('falls back to the first token when the selected one is no longer offered', async () => {
      const store = useContractsStore();
      store.activeChain = polygonChain;
      store.currencyToken = polygonChain.currencies[1].value;
      store.web3 = makeWeb3() as never;
      store.vaultContract = {
        methods: {
          getProtocolTokenBalances: vi.fn(() =>
            resolves({avaliableBalance: 1_000_000n})
          )
        }
      } as never;

      await store.getVaultBalance();

      expect(store.currencyToken).toBe(polygonChain.currencies[0].value);
    });
  });

  describe('getActiveRequest', () => {
    const setupPolygon = (
      store: ReturnType<typeof useContractsStore>,
      reservation: {amount: bigint; unlockTime: bigint}
    ) => {
      store.activeChain = polygonChain;
      store.vaultAddress = '0xvault';
      store.web3 = makeWeb3() as never;
      store.activeFactory = makePolygonRegistry() as never;
      store.vaultContract = {
        methods: {
          getWithdrawProtocolTokenReservation: vi.fn(() =>
            resolves(reservation)
          )
        }
      } as never;
    };

    it('finds a reservation older than the history window from vault state', async () => {
      /** Mirrors the 2026-07-22 case: no WithdrawRequest event in "Today", 0.509521 still reserved */
      const store = useContractsStore();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const unlockTime = BigInt(nowSeconds() - 5 * 24 * 3600);
      setupPolygon(store, {amount: 509_521n, unlockTime});
      store.withdrawalRequests = [];
      vi.spyOn(store, 'findWithdrawRequestEvent').mockResolvedValue(null);

      await store.getActiveRequest();

      /** Without the event the recipient is unknown: the request can be cancelled, not completed */
      expect(store.activeRequest).toEqual({
        address: '',
        amount: 0.509521,
        date: new Date((Number(unlockTime) - 3600) * 1000),
        status: 'ready',
        token: polygonChain.currencies[0].value
      });
    });

    it('looks the request event up at unlockTime - lockDuration and reads the recipient from its transaction', async () => {
      const store = useContractsStore();
      const unlockTime = BigInt(nowSeconds() + 1800);
      const token = polygonChain.currencies[0].value;
      setupPolygon(store, {amount: 2_000_000n, unlockTime});
      const findEvent = vi
        .spyOn(store, 'findWithdrawRequestEvent')
        .mockResolvedValue({
          returnValues: {token, amount: 2_000_000n, unlockTime},
          transactionHash: '0xtx',
          blockNumber: 123n,
          address: '0xvault'
        });
      (store.web3 as any).eth.getBlock.mockResolvedValue({
        transactions: [
          {hash: '0xother', input: '0x'},
          {hash: '0xtx', input: '0xinput'}
        ]
      });
      const extract = vi
        .spyOn(store, 'extractWithdrawRequestRecipient')
        .mockReturnValue('0xrecipient');

      await store.getActiveRequest();

      expect(findEvent).toHaveBeenCalledWith(
        {token, amount: 2_000_000n, unlockTime},
        Number(unlockTime) - 3600
      );
      expect(extract).toHaveBeenCalledWith('0xinput', token, 2_000_000n);
      expect(store.activeRequest?.address).toBe('0xrecipient');
      expect(store.activeRequest?.status).toBe('pending');
    });

    it('Avalanche: finds an XAUT0 reservation by registry token id', async () => {
      const store = useContractsStore();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const unlockTime = BigInt(nowSeconds() + 600);
      store.activeChain = avaxChain;
      store.vaultAddress = '0xvault';
      store.web3 = makeWeb3() as never;
      store.activeFactory = makeAvaxRegistry() as never;
      store.vaultContract = {
        methods: {
          getWithdrawPaymentTokenReservationByTokenId: vi.fn((tokenId: number) =>
            resolves(
              tokenId === 2
                ? {amount: 3_788n, unlockTime}
                : {amount: 0n, unlockTime: 0n}
            )
          )
        }
      } as never;
      vi.spyOn(store, 'findWithdrawRequestEvent').mockResolvedValue(null);

      await store.getActiveRequest();

      expect(store.activeRequest?.token).toBe(avaxChain.currencies[2].value);
      expect(store.activeRequest?.amount).toBe(0.003788);
      expect(store.activeRequest?.status).toBe('pending');
    });

    it('leaves activeRequest empty when nothing is reserved', async () => {
      const store = useContractsStore();
      setupPolygon(store, {amount: 0n, unlockTime: 0n});
      const findEvent = vi.spyOn(store, 'findWithdrawRequestEvent');

      await store.getActiveRequest();

      expect(store.activeRequest).toBeNull();
      expect(findEvent).not.toHaveBeenCalled();
    });

    it('prompts to cancel or complete a request older than 10 days', async () => {
      const store = useContractsStore();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      setupPolygon(store, {
        amount: 509_521n,
        unlockTime: BigInt(nowSeconds() - 30 * 24 * 3600)
      });
      vi.spyOn(store, 'findWithdrawRequestEvent').mockResolvedValue(null);

      await store.getActiveRequest();

      expect(store.modal.overtime).toBe(true);
      expect(store.thresholdPrompt).toContain('more than 10 days');
    });
  });

  describe('new withdraw request guard', () => {
    const setup = (
      store: ReturnType<typeof useContractsStore>,
      reservation: ReturnType<typeof resolves> | ReturnType<typeof rejects>
    ) => {
      const send = vi.fn().mockResolvedValue({});
      const withdrawRequest = vi.fn(() => ({send}));
      store.activeChain = polygonChain;
      store.connectedAccount = '0xowner';
      store.currencyToken = polygonChain.currencies[0].value;
      store.balances = {[USDT0]: 2};
      store.web3 = {utils: {toChecksumAddress: (address: string) => address}} as never;
      store.vaultContract = {
        methods: {
          withdrawRequest,
          getWithdrawProtocolTokenReservation: vi.fn(() => reservation)
        }
      } as never;
      vi.spyOn(store, 'getEstimatedGas').mockResolvedValue();
      vi.spyOn(store, 'getVaultBalance').mockResolvedValue();
      vi.spyOn(store, 'getWithdrawalHistory').mockResolvedValue();
      return withdrawRequest;
    };

    it('connected form: refuses while a reservation is open and shows it', async () => {
      const store = useContractsStore();
      const withdrawRequest = setup(
        store,
        resolves({amount: 509_521n, unlockTime: 1n})
      );
      store.updateFormField(2, 'connected', 'amount');

      await store.submitConnectedForm();

      expect(withdrawRequest).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('already have a pending withdrawal request')
      );
      expect(store.getWithdrawalHistory).toHaveBeenCalled();
      expect(store.wallets.connected.step).toBe(1);
      expect(store.loading.withdrawConnected).toBe(false);
    });

    it('connected form: refuses when the reservation check fails', async () => {
      const store = useContractsStore();
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const withdrawRequest = setup(store, rejects('rate limit'));
      store.updateFormField(2, 'connected', 'amount');

      await store.submitConnectedForm();

      expect(withdrawRequest).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringContaining('Could not check for pending withdrawal requests')
      );
    });

    it('connected form: sends the request when nothing is reserved', async () => {
      const store = useContractsStore();
      const withdrawRequest = setup(store, resolves({amount: 0n, unlockTime: 0n}));
      store.updateFormField(2, 'connected', 'amount');

      await store.submitConnectedForm();

      expect(withdrawRequest).toHaveBeenCalledWith(
        polygonChain.currencies[0].value,
        '0xowner',
        2_000_000n
      );
      expect(store.wallets.connected.step).toBe(2);
    });

    it('external form: refuses at the confirm step while a reservation is open', async () => {
      const store = useContractsStore();
      const withdrawRequest = setup(
        store,
        resolves({amount: 509_521n, unlockTime: 1n})
      );
      store.updateFormField(2, 'external', 'amount');
      store.updateFormField('0xrecipient', 'external', 'address');
      store.updateWallet('external', {step: 2});

      await store.submitExternalForm();

      expect(withdrawRequest).not.toHaveBeenCalled();
      expect(store.wallets.external.step).toBe(2);
    });
  });

  describe('balance checks use the selected token', () => {
    it('external form blocks a USDC amount above the USDC balance, even when USDT0 would cover it', async () => {
      const store = useContractsStore();
      store.activeChain = polygonChain;
      store.web3 = {} as never;
      store.vaultContract = {methods: {}} as never;
      store.currencyToken = polygonChain.currencies[1].value;
      store.balances = {[USDT0]: 100, [POLY_USDC]: 1};
      store.updateFormField(5, 'external', 'amount');

      await store.submitExternalForm();

      expect(store.wallets.external.step).toBe(1);
    });

    it('connected form allows a USDC amount within the USDC balance, even when USDT0 is lower', async () => {
      const store = useContractsStore();
      const send = vi.fn().mockResolvedValue({});
      const withdrawRequest = vi.fn(() => ({send}));
      store.activeChain = polygonChain;
      store.connectedAccount = '0xowner';
      store.currencyToken = polygonChain.currencies[1].value;
      store.balances = {[USDT0]: 0, [POLY_USDC]: 5};
      store.vaultContract = {
        methods: {
          withdrawRequest,
          getWithdrawProtocolTokenReservation: vi.fn(() =>
            resolves({amount: 0n, unlockTime: 0n})
          )
        }
      } as never;
      vi.spyOn(store, 'getEstimatedGas').mockResolvedValue();
      vi.spyOn(store, 'getVaultBalance').mockResolvedValue();
      store.updateFormField(5, 'connected', 'amount');

      await store.submitConnectedForm();

      expect(withdrawRequest).toHaveBeenCalledWith(
        polygonChain.currencies[1].value,
        '0xowner',
        5_000_000n
      );
    });

    it('blocks when the selected balance is unknown', async () => {
      const store = useContractsStore();
      const withdrawRequest = vi.fn();
      store.activeChain = polygonChain;
      store.currencyToken = polygonChain.currencies[0].value;
      store.balances = {[USDT0]: null};
      store.vaultContract = {methods: {withdrawRequest}} as never;
      store.updateFormField(1, 'connected', 'amount');

      await store.submitConnectedForm();

      expect(withdrawRequest).not.toHaveBeenCalled();
    });
  });

  describe('updateActiveVault', () => {
    it("clears the previous vault's balances and requests before connecting the new one", async () => {
      const store = useContractsStore();
      store.balances = {[USDT0]: 5};
      store.activeRequest = {
        address: '0xabc',
        amount: 1,
        date: new Date(),
        status: 'pending',
        token: polygonChain.currencies[0].value
      };
      const connect = vi
        .spyOn(store, 'connectContract')
        .mockImplementation(async () => {
          expect(store.balances).toEqual({});
          expect(store.activeRequest).toBeNull();
        });

      await store.updateActiveVault(1);

      expect(connect).toHaveBeenCalledOnce();
      expect(store.contractIndex).toBe(1);
    });
  });

  describe('withdrawal history', () => {
    /** The real ABI coder (web3 itself is mocked in this file) */
    let abi: any;
    beforeAll(async () => {
      const real = await vi.importActual<typeof import('web3')>('web3');
      abi = new real.Web3().eth.abi;
    });

    const TOKEN = avaxChain.currencies[0].value;
    const RECIPIENT = '0xC97723fA0dbf09a784421e57F1Cbc6c454137B27';
    const inputs = [
      {type: 'address', name: 'token_'},
      {type: 'address', name: 'recipient_'},
      {type: 'uint256', name: 'amount_'}
    ];
    const plainCall = (amount: bigint) =>
      abi.encodeFunctionCall({name: 'withdrawRequest', type: 'function', inputs}, [
        TOKEN,
        RECIPIENT,
        amount
      ]);
    const signedCall = (amount: bigint) =>
      abi.encodeFunctionCall(
        {
          name: 'withdrawRequestWithSignature',
          type: 'function',
          inputs: [...inputs, {type: 'bytes', name: 'signature_'}]
        },
        [TOKEN, RECIPIENT, amount, '0x' + 'ab'.repeat(65)]
      );

    describe('extractWithdrawRequestRecipient', () => {
      const withAbi = () => {
        const store = useContractsStore();
        store.web3 = {eth: {abi}} as never;
        return store;
      };

      it('reads the recipient of a plain withdrawRequest (web app)', () => {
        const recipient = withAbi().extractWithdrawRequestRecipient(
          plainCall(1_000_000n),
          TOKEN,
          1_000_000n
        );
        expect(recipient?.toLowerCase()).toBe(RECIPIENT.toLowerCase());
      });

      it('reads the recipient of withdrawRequestWithSignature (signed flows)', () => {
        /** 23 of 27 cancelled requests on the reported Avalanche vault were made this way */
        const recipient = withAbi().extractWithdrawRequestRecipient(
          signedCall(500n),
          TOKEN,
          500n
        );
        expect(recipient?.toLowerCase()).toBe(RECIPIENT.toLowerCase());
      });

      it('finds the call inside a wrapped (smart-account) transaction', () => {
        const wrapped = '0xcef6d209' + '00'.repeat(64) + signedCall(500n).slice(2);
        const recipient = withAbi().extractWithdrawRequestRecipient(
          wrapped,
          TOKEN,
          500n
        );
        expect(recipient?.toLowerCase()).toBe(RECIPIENT.toLowerCase());
      });

      it('returns null when the token or amount does not match', () => {
        const store = withAbi();
        expect(
          store.extractWithdrawRequestRecipient(signedCall(500n), TOKEN, 501n)
        ).toBeNull();
        expect(
          store.extractWithdrawRequestRecipient(
            signedCall(500n),
            avaxChain.currencies[2].value,
            500n
          )
        ).toBeNull();
      });
    });

    const event = (
      hash: string,
      block: bigint,
      amount: bigint,
      extra: Record<string, unknown> = {}
    ) => ({
      transactionHash: hash,
      blockNumber: block,
      address: '0xvault',
      returnValues: {token: TOKEN, amount, ...extra}
    });

    const setupHistory = (transactions: Record<string, string>) => {
      const store = useContractsStore();
      store.activeChain = avaxChain;
      store.rpc = {name: 'test', url: 'http://rpc'};
      store.vaultAddress = '0xvault';
      store.web3 = {
        eth: {
          abi,
          getBlock: vi.fn(async (block: bigint) => {
            if (block === 666n) throw new Error('rate limit');
            return {timestamp: 1_764_000_000n + BigInt(block)};
          }),
          getTransaction: vi.fn(async (hash: string) => {
            if (!transactions[hash]) throw new Error('Transaction not found');
            return {input: transactions[hash]};
          })
        }
      } as never;
      /** The configured RPC fallback doesn't know the transaction either */
      mockRpcGetTransaction.mockRejectedValue(new Error('Transaction not found'));
      return store;
    };

    it('keeps every cancelled row: signed requests resolve, failed or unmatched lookups show as unknown', async () => {
      const store = setupHistory({'0xreq-signed': signedCall(500n)});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      store.withdrawalRequests = [
        event('0xreq-signed', 10n, 500n, {unlockTime: 1n}),
        event('0xreq-missing-tx', 20n, 700n, {unlockTime: 1n})
      ] as never;
      mockGetPastEvents.mockResolvedValue([
        event('0xcancel-1', 11n, 500n),
        /** Its request's transaction can't be fetched from any provider */
        event('0xcancel-2', 21n, 700n),
        /** No request in this time window matches */
        event('0xcancel-3', 31n, 900n)
      ]);

      await store.getCancelledWithdrawals();

      expect(store.cancelledWithdrawals).toHaveLength(3);
      expect(store.cancelledWithdrawals[0].address.toLowerCase()).toBe(
        RECIPIENT.toLowerCase()
      );
      expect(store.cancelledWithdrawals[0].status).toBe('cancelled');
      expect(store.cancelledWithdrawals[0].amount).toBe(0.0005);
      expect(store.cancelledWithdrawals[1].address).toBe('');
      expect(store.cancelledWithdrawals[2].address).toBe('');
    });

    it('falls back to the configured RPC when the wallet provider misses a transaction', async () => {
      const store = setupHistory({});
      store.withdrawalRequests = [
        event('0xreq', 10n, 500n, {unlockTime: 1n})
      ] as never;
      mockRpcGetTransaction.mockResolvedValue({input: signedCall(500n)});
      mockGetPastEvents.mockResolvedValue([event('0xcancel', 11n, 500n)]);

      await store.getCancelledWithdrawals();

      expect(store.cancelledWithdrawals[0].address.toLowerCase()).toBe(
        RECIPIENT.toLowerCase()
      );
    });

    it('drops only the row whose block time cannot be read', async () => {
      const store = setupHistory({});
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockGetPastEvents.mockResolvedValue([
        event('0xw1', 100n, 1_000_000n, {recipient: RECIPIENT}),
        event('0xw2', 666n, 2_000_000n, {recipient: RECIPIENT}),
        event('0xw3', 300n, 3_000_000n, {recipient: RECIPIENT})
      ]);

      await store.getCompletedWithdrawals();

      expect(store.completedWithdrawals.map((row) => row.amount)).toEqual([
        1, 3
      ]);
      expect(store.completedWithdrawals[0].date).toEqual(
        new Date((1_764_000_000 + 100) * 1000)
      );
    });
  });

  describe('findBlockRangeForTimestamp', () => {
    /** Synthetic chain with uneven block times, including blocks that share a timestamp */
    const timestamps: number[] = [];
    let time = 1_750_000_000;
    for (let block = 0; block < 200_000; block++) {
      timestamps.push(time);
      time += [0, 1, 2, 3, 1, 2][block % 6] + (block % 1000 === 0 ? 30 : 0);
    }
    const latest = timestamps.length - 1;
    const getTimestamp = vi.fn(async (block: number) => timestamps[block]);

    it.each([2_000, 5_001, 123_457, 199_000])(
      'narrows to a range containing every block with the timestamp of block %i',
      async (block) => {
        getTimestamp.mockClear();
        const target = timestamps[block];

        /** Deliberately wrong blocks-per-day estimate (real rate is ~57,600/day) */
        const {from, to} = await findBlockRangeForTimestamp(
          getTimestamp,
          latest,
          target,
          10_000
        );

        const matching = timestamps.flatMap((ts, index) =>
          ts === target ? [index] : []
        );
        expect(from).toBeLessThanOrEqual(Math.min(...matching));
        expect(to).toBeGreaterThanOrEqual(Math.max(...matching));
        expect(to - from).toBeLessThan(2_000);
        expect(getTimestamp.mock.calls.length).toBeLessThan(60);
      }
    );

    it('narrows below 100 blocks with a small tolerance (strict RPC log limits)', async () => {
      getTimestamp.mockClear();
      const target = timestamps[150_321];

      const {from, to} = await findBlockRangeForTimestamp(
        getTimestamp,
        latest,
        target,
        57_600,
        16
      );

      expect(from).toBeLessThan(150_321);
      expect(to).toBeGreaterThanOrEqual(150_321);
      expect(to - from).toBeLessThan(100);
      expect(getTimestamp.mock.calls.length).toBeLessThan(60);
    });

    it('returns the newest blocks for a target at or after the chain head', async () => {
      const range = await findBlockRangeForTimestamp(
        getTimestamp,
        latest,
        timestamps[latest] + 10,
        57_600
      );

      expect(range.to).toBe(latest);
      expect(range.from).toBe(latest - 500);
    });
  });
});
