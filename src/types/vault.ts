export interface IVaultBalance {
  availableBalance: bigint;
  balance: bigint;
  frozenPaymentTokenAmount?: bigint;
  processPaymentReservation: bigint;
  withdrawalReservation: bigint;
}

export interface IReservation {
  amount: bigint;
  unlockTime: bigint;
}

export interface IWithdrawRequestData {
  token: string;
  amount: bigint;
  unlockTime: bigint;
}

export interface ICancelledWithdrawReservationData {
  amount: bigint;
  token: string;
}

export interface IVaultEvent<T> {
  returnValues: T;
  transactionHash: string;
  blockNumber: bigint;
  address: string;
}

export interface ITransaction {
  accessList: unknown[];
  blockHash: string;
  blockNumber: bigint;
  chainId: bigint;
  from: string;
  gas: bigint;
  gasPrice: bigint;
  hash: string;
  input: string;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  nonce: bigint;
  r: string;
  s: string;
  to: string;
  transactionIndex: bigint;
  type: bigint;
  v: bigint;
  value: bigint;
}

export interface IBlock {
  baseFeePerGas: bigint;
  difficulty: bigint;
  extraData: string;
  gasLimit: bigint;
  gasUsed: bigint;
  hash: string;
  logsBloom: string;
  miner: string;
  mixHash: string;
  nonce: bigint;
  number: bigint;
  parentHash: string;
  receiptsRoot: string;
  sha3Uncles: string;
  size: bigint;
  stateRoot: string;
  timestamp: bigint;
  transactions: ITransaction[];
  transactionsRoot: string;
  uncles: unknown[];
}

export interface ITransactionReceiptLog {
  address: string;
  blockHash: string;
  blockNumber: bigint;
  data: string;
  logIndex: bigint;
  removed: boolean;
  topics: string[];
  transactionHash: string;
  transactionIndex: bigint;
}

export interface ITransactionReceipt {
  blockHash: string;
  blockNumber: bigint;
  cumulativeGasUsed: bigint;
  effectiveGasPrice: bigint;
  from: string;
  gasUsed: bigint;
  logs: ITransactionReceiptLog[];
  logsBloom: string;
  status: bigint;
  to: string;
  transactionHash: string;
  transactionIndex: bigint;
  type: bigint;
}

export interface IWhitelistedToken {
  tokenAddress: string;
  tokenId: bigint;
}
