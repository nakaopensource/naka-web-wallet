import type {Contract, ContractAbi, Web3} from 'web3';
import type {IFormField} from '@/types/general.ts';
import type {
  IVaultBalance,
  IVaultEvent,
  IWithdrawRequestData
} from '@/types/vault.ts';

export interface IContractsInputs {
  privateKey: string;
  nonce: string;
  transactionHash: string;
  apiKey: string;
  factory: string;
}

export interface IContractsLoading {
  transactionHash: boolean;
  factory: boolean;
  balance: boolean;
  withdrawConnected: boolean;
  withdrawExternal: boolean;
  connect: boolean;
  history: boolean;
  withdraw: boolean;
  cancelWithdraw: boolean;
  completeWithdraw: boolean;
}

export interface IContractsHash {
  contractAddress: string;
}

export interface IContractsFactory {
  contractAddress: string;
  factoryABI: ContractAbi;
}

export interface IContractsDeployer {
  contractAddress: string;
}

export interface IContractsModal {
  connect: boolean;
  withdrawConnected: boolean;
  withdrawExternal: boolean;
  cancelWithdraw: boolean;
  completeWithdraw: boolean;
  overtime: boolean;
}

export interface IActiveNetwork {
  name: string;
  icon: string;
  id: string;
  symbol: string;
}

export interface IWithdrawal {
  address: string;
  date: Date;
  amount: number;
  status: string;
  token: string;
}

export interface IConnectedForm {
  amount: IFormField<number | null>;
}

export interface IExternalForm {
  amount: IFormField<number | null>;
  address: IFormField<string>;
}

export interface IContractsForms {
  connected: IConnectedForm;
  external: IExternalForm;
}

export interface IWallet {
  step: number;
}

export interface IContractsWallets {
  connected: IWallet;
  external: IWallet;
}

export interface IContractsErrors {
  external: boolean;
  connected: boolean;
  externalAddress: boolean;
}

export interface ITransactionGas {
  gas: number;
  gasPrice?: number;
  maxFeePerGas: number;
  maxPriorityFeePerGas: number;
}

export interface IContractBalance {
  eth: number;
  usdt: number;
}

export interface IRpc {
  name: string;
  url: string;
}

export interface IToken {
  name: string;
  value: string;
}

export interface ICurrency {
  contract: Contract<ContractAbi> | null;
  balance: number;
}

export interface IChain {
  id: number;
  hexId: string;
  name: string;
  contract: string[];
  rpcs: IRpc[];
  gas: string;
  currencies: IToken[];
  vaultAbi: ContractAbi;
  registryAbi: ContractAbi;
  balanceCall: string;
  reservationCall: string;
  reservationLockCall: string;
}

export interface ITime {
  text: string;
  value: number;
}

export interface IContractsStore {
  web3: Web3 | null;
  connectedAccount: string;
  allAccounts: string[];
  balance: string;
  contractBalance: IContractBalance;
  vaultBalance: IVaultBalance | null;
  amountDecimalPoints: number;
  inputs: IContractsInputs;
  loading: IContractsLoading;
  transactionHash: IContractsHash;
  factory: IContractsFactory;
  deployer: IContractsDeployer;
  modal: IContractsModal;
  provider: any;
  withdrawals: IWithdrawal[];
  firstSign: boolean;
  form: IContractsForms;
  wallets: IContractsWallets;
  error: IContractsErrors;
  vaultContract: Contract<ContractAbi> | null;
  factoryContract: Contract<ContractAbi>[];
  transactionGas: ITransactionGas;
  activeRequest: IWithdrawal | null;
  lastBlock: number;
  withdrawalRequests: IVaultEvent<IWithdrawRequestData>[];
  completedWithdrawals: IWithdrawal[];
  cancelledWithdrawals: IWithdrawal[];
  vaultAddress: string;
  availableVaults: string[];
  blocksOffset: number;
  daysOffset: number;
  thresholdPrompt: string;
  rpc: IRpc;
  usdc: ICurrency;
  xaut: ICurrency;
  currencyToken: string;
  tokens: IToken[];
  activeChain: IChain | null;
  contractIndex: number;
  timeList: ITime[];
}
