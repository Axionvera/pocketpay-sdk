/**
 * Stellar PocketPay SDK — Type Definitions
 *
 * All shared types, interfaces, and enums used across the SDK.
 */

// ─── Network ────────────────────────────────────────────────────────────────

/** Supported Stellar networks */
export type StellarNetwork = 'testnet' | 'mainnet';

/** SDK configuration options */
export interface SDKConfig {
  /** Network to connect to (default: "testnet") */
  network: StellarNetwork;
  /** Horizon server URL (auto-resolved if omitted) */
  horizonUrl: string;
  /** Soroban RPC URL (auto-resolved if omitted) */
  sorobanRpcUrl: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Soroban contract ID for vault operations (optional) */
  contractId?: string;
}

// ─── Wallet ─────────────────────────────────────────────────────────────────

/** A newly created or imported Stellar keypair */
export interface WalletKeypair {
  /** Stellar public key (G...) */
  publicKey: string;
  /** Stellar secret key (S...) — handle with extreme care */
  secretKey: string;
}

/** Balance entry for a single asset */
export interface AssetBalance {
  /** Asset code (e.g. "XLM", "USDC") */
  asset: string;
  /** Balance amount as a string (to preserve precision) */
  balance: string;
  /** Asset issuer public key (empty for native XLM) */
  issuer: string;
}

/** Full account balance response */
export interface AccountBalance {
  /** The queried public key */
  publicKey: string;
  /** Array of asset balances */
  balances: AssetBalance[];
  /** Native XLM balance (convenience shortcut) */
  nativeBalance: string;
}

// ─── Payments ───────────────────────────────────────────────────────────────

/** Parameters for sending an XLM payment */
export interface SendXLMParams {
  /** Secret key of the source account (S...) */
  sourceSecret: string;
  /** Public key of the destination account (G...) */
  destination: string;
  /** Amount of XLM to send (as string for precision, e.g. "10.5") */
  amount: string;
  /** Optional memo text (max 28 bytes) */
  memo?: string;
}

/** Result of a successful payment */
export interface PaymentResult {
  /** Whether the transaction was successful */
  success: boolean;
  /** Transaction hash */
  hash: string;
  /** Ledger number the transaction was included in */
  ledger: number;
  /** Fee charged in stroops */
  fee: string;
  /** Source account public key */
  sourceAccount: string;
  /** Destination account public key */
  destinationAccount: string;
  /** Amount sent */
  amount: string;
  /** Timestamp of the transaction */
  createdAt: string;
}

// ─── Transactions ───────────────────────────────────────────────────────────

/** A single transaction record */
export interface TransactionRecord {
  /** Transaction hash */
  hash: string;
  /** Ledger number */
  ledger: number;
  /** ISO 8601 timestamp */
  createdAt: string;
  /** Source account public key */
  sourceAccount: string;
  /** Fee paid in stroops */
  fee: string;
  /** Number of operations in the transaction */
  operationCount: number;
  /** Whether the transaction was successful */
  successful: boolean;
  /** Optional memo */
  memo?: string;
  /** Memo type */
  memoType: string;
}

/** A single payment operation record */
export interface PaymentRecord {
  /** Operation ID */
  id: string;
  /** Transaction hash this operation belongs to */
  transactionHash: string;
  /** Operation type */
  type: string;
  /** ISO 8601 timestamp */
  createdAt: string;
  /** Source account */
  from: string;
  /** Destination account */
  to: string;
  /** Amount transferred */
  amount: string;
  /** Asset code */
  asset: string;
  /** Asset issuer (empty for native) */
  assetIssuer: string;
}

/** Paginated transaction list */
export interface TransactionList {
  /** Array of transaction records */
  records: TransactionRecord[];
  /** Number of records returned */
  count: number;
}

/** Paginated payment list */
export interface PaymentList {
  /** Array of payment records */
  records: PaymentRecord[];
  /** Number of records returned */
  count: number;
}

// ─── Soroban / Vault ────────────────────────────────────────────────────────

/** Parameters for a vault deposit */
export interface VaultDepositParams {
  /** Secret key of the depositor */
  sourceSecret: string;
  /** Amount to deposit (as string) */
  amount: string;
  /** Vault contract ID */
  contractId: string;
}

/** Parameters for a vault withdrawal */
export interface VaultWithdrawParams {
  /** Secret key of the withdrawer */
  sourceSecret: string;
  /** Amount to withdraw (as string) */
  amount: string;
  /** Vault contract ID */
  contractId: string;
}

/** Vault operation result */
export interface VaultResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Transaction hash (if submitted on-chain) */
  hash?: string;
  /** Resulting balance after operation */
  balance?: string;
  /** Error message if failed */
  error?: string;
}

/** Vault balance query params */
export interface VaultBalanceParams {
  /** Public key of the user */
  publicKey: string;
  /** Vault contract ID */
  contractId: string;
}

// ─── Friendbot / Funding ────────────────────────────────────────────────────

/** Result of funding a testnet account via Friendbot */
export interface FundResult {
  /** Whether funding was successful */
  success: boolean;
  /** Transaction hash from Friendbot */
  hash?: string;
  /** Error message if failed */
  error?: string;
}

// ─── Errors ─────────────────────────────────────────────────────────────────

/** Custom SDK error with additional context */
export class PocketPayError extends Error {
  /** Machine-readable error code */
  public readonly code: string;
  /** HTTP status code (if applicable) */
  public readonly statusCode?: number;
  /** Original error that caused this error */
  public readonly cause?: Error;

  constructor(
    message: string,
    code: string,
    statusCode?: number,
    cause?: Error
  ) {
    super(message);
    this.name = 'PocketPayError';
    this.code = code;
    this.statusCode = statusCode;
    this.cause = cause;
    Object.setPrototypeOf(this, PocketPayError.prototype);
  }
}
