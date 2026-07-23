/**
 * Transaction direction
 */
export enum TransactionDirection {
  INCOMING = 'incoming',
  OUTGOING = 'outgoing',
  SELF = 'self',
}

/**
 * Transaction status
 */
export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  UNKNOWN = 'unknown',
}

/**
 * Transaction summary for mobile UI and Horizon transaction queries
 */
export interface TransactionSummary {
  /** Unique transaction identifier */
  id?: string;
  
  /** Stellar transaction hash */
  hash?: string;

  /** Stellar transaction hash (alias for txHash) */
  txHash?: string;
  
  /** Ledger sequence number */
  ledger?: number;

  /** Source account public key */
  sourceAccount?: string;

  /** Number of operations in transaction */
  operationCount?: number;

  /** Whether the transaction was successful */
  successful?: boolean;

  /** Memo type */
  memoType?: string;

  /** Horizon paging token (cursor) */
  pagingToken?: string;

  /** Transaction direction (incoming/outgoing/self) */
  direction?: TransactionDirection | 'incoming' | 'outgoing' | 'self';
  
  /** Amount in the asset's smallest unit */
  amount?: string;
  
  /** Human-readable amount (formatted with proper decimals) */
  amountDisplay?: string;
  
  /** Asset code (XLM, USDC, etc.) */
  asset?: string;
  
  /** Counterparty address (sender for incoming, recipient for outgoing) */
  counterparty?: string;
  
  /** Transaction memo (if any) */
  memo?: string;
  
  /** Transaction status */
  status?: TransactionStatus | 'pending' | 'completed' | 'failed' | 'unknown';
  
  /** ISO timestamp of the transaction */
  createdAt: string;
  
  /** Human-readable relative time (e.g., "2 hours ago") */
  timeAgo?: string;
  
  /** Fee paid for the transaction */
  fee?: string;
  
  /** Raw transaction type (from Horizon) */
  rawType?: string;
}

/**
 * Raw Horizon transaction record
 * This is a simplified version of what Horizon returns
 */
export interface RawHorizonTransaction {
  id: string;
  paging_token: string;
  tx_hash: string;
  created_at: string;
  source_account: string;
  fee_account: string;
  fee_charged: string;
  memo_type: string;
  memo?: string;
  successful: boolean;
  operations: RawHorizonOperation[];
}

/**
 * Raw Horizon operation record
 */
export interface RawHorizonOperation {
  id: string;
  source_account: string;
  type: string;
  type_i: number;
  created_at: string;
  transaction_hash: string;
  amount?: string;
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  from?: string;
  to?: string;
  starting_balance?: string;
  balance?: string;
  limit?: string;
  account?: string;
}

/**
 * Options for the transaction mapper
 */
export interface TransactionMapperOptions {
  /** The user's account address to determine direction */
  userAccount: string;
  /** Whether to include raw data in the summary */
  includeRawData?: boolean;
  /** Whether to format amounts with proper decimals */
  formatAmounts?: boolean;
}
