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

// ─── Balance Result (discriminated union) ───────────────────────────────────

/**
 * Result of {@link getBalanceOrUnfunded} — a discriminated union on `status`.
 *
 * Use `result.status` to branch without try/catch:
 * - `"funded"` — the account exists on-chain; `balance` is populated.
 * - `"unfunded"` — Horizon returned 404; the account has never been funded.
 *
 * Any unexpected Horizon failure (5xx, network error, etc.) is still thrown
 * as a {@link PocketPayError} so genuine errors are never silently swallowed.
 *
 * @example
 * ```ts
 * const result = await getBalanceOrUnfunded(wallet.publicKey);
 * if (result.status === 'funded') {
 *   console.log('XLM balance:', result.balance.nativeBalance);
 * } else {
 *   // result.status === 'unfunded'
 *   console.log('Wallet not yet funded — call fundTestnetAccount()');
 * }
 * ```
 */
export type BalanceResult =
  | {
      /** Account exists and has been funded. */
      status: 'funded';
      /** The queried public key. */
      publicKey: string;
      /** Full account balance detail. */
      balance: AccountBalance;
    }
  | {
      /** Account does not exist on Horizon (never funded). */
      status: 'unfunded';
      /** The queried public key. */
      publicKey: string;
    };

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

/** A single transaction summary — the SDK's stable typed model for one transaction. */
export interface TransactionSummary {
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
  /** Horizon paging token (cursor) for this record */
  pagingToken: string;
}
/**
 * @deprecated Use {@link TransactionSummary}. Retained as an alias for
 * backward compatibility with existing consumers.
 */
export type TransactionRecord = TransactionSummary;
/** A single payment summary — the SDK's stable typed model for one payment operation. */
export interface PaymentSummary {
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
  /** Horizon paging token (cursor) for this record */
  pagingToken: string;
}
/**
 * @deprecated Use {@link PaymentSummary}. Retained as an alias for
 * backward compatibility with existing consumers.
 */
export type PaymentRecord = PaymentSummary;
/** Paginated transaction list */
export interface TransactionList {
  /** Array of transaction summaries */
  records: TransactionSummary[];
  /** Number of records returned */
  count: number;
  /** Paging token of the last record, for fetching the next page (undefined when empty) */
  nextCursor?: string;
}
/** Paginated payment list */
export interface PaymentList {
  /** Array of payment summaries */
  records: PaymentSummary[];
  /** Number of records returned */
  count: number;
  /** Paging token of the last record, for fetching the next page (undefined when empty) */
  nextCursor?: string;
}

// ─── Transaction Filtering ───────────────────────────────────────────────────

/**
 * The relative direction of a transaction or payment with respect to a
 * reference Stellar account.
 *
 * - `"incoming"` — value or activity flowed *to* the reference account.
 * - `"outgoing"` — value or activity originated *from* the reference account.
 * - `"self"`     — the reference account is both sender and receiver (e.g. a
 *   payment where `from === to`).
 */
export type TransactionDirection = 'incoming' | 'outgoing' | 'self';

/**
 * Structural shape shared by {@link TransactionSummary} and
 * {@link PaymentSummary} that the pure filtering helpers operate on.
 *
 * Every field except `createdAt` is optional so the same helper functions
 * work across both record types — including records that lack asset or
 * counterparty data (e.g. a raw {@link TransactionSummary} has no `asset`).
 */
export interface FilterableTransaction {
  /** ISO 8601 timestamp used for date-range filtering */
  createdAt: string;
  /** Present on transaction records; the tx source account */
  sourceAccount?: string;
  /** Present on payment records; the sending account */
  from?: string;
  /** Present on payment records; the receiving account */
  to?: string;
  /** Present on payment records; the asset code (e.g. "XLM", "USDC") */
  asset?: string;
  /** Present on payment records; the asset issuer (empty for native XLM) */
  assetIssuer?: string;
}

/** Sort direction supported by {@link sortTransactionsByDate}. */
export type TransactionSortOrder = 'newest' | 'oldest';

/**
 * Minimal transaction-like shape accepted by the date sorting helper.
 *
 * `createdAt` is optional because callers may be sorting partially populated
 * API records. Missing and invalid dates are retained at the end of the result.
 */
export interface SortableTransaction {
  /** Timestamp used for sorting, normally an ISO 8601 string. */
  createdAt?: string | Date | null;
}

/** Options for the combined {@link filterTransactions} helper. */
export interface FilterTransactionsOptions {
  /** Keep only records matching this direction relative to `account` */
  direction?: TransactionDirection;
  /**
   * Reference Stellar account (G...) used to resolve `direction` and
   * `counterparty`. Required for those two filters; ignored otherwise.
   */
  account?: string;
  /** Keep only records for this asset code (e.g. "XLM", "USDC"). */
  asset?: string;
  /** When filtering by asset, optionally scope to a specific issuer. */
  assetIssuer?: string;
  /** Keep only records created on or after this date (string or Date). */
  startDate?: string | Date;
  /** Keep only records created on or before this date (string or Date). */
  endDate?: string | Date;
  /** Keep only records whose counterparty equals this account (needs `account`). */
  counterparty?: string;
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

/**
 * Result of funding a testnet account via Friendbot.
 *
 * @remarks **Testnet only.** Friendbot is not available on Stellar mainnet.
 *
 * @example
 * ```ts
 * const result = await fundTestnetAccount(wallet.publicKey);
 * if (result.success) {
 *   console.log('Funded!', result.hash, 'ledger:', result.ledger);
 * }
 * ```
 */
export interface FundResult {
  /** Whether the funding request was successful */
  success: boolean;

  /**
   * The Stellar public key (G...) that was funded.
   * Always present, mirrors the input public key for easy destructuring.
   */
  publicKey: string;

  /**
   * Transaction hash of the Friendbot funding transaction.
   * Present on success; used to look up the transaction on a block explorer.
   */
  hash?: string;

  /**
   * Friendbot's internal operation/record ID.
   * Useful as a fallback identifier when `hash` is not available.
   */
  friendbotId?: string;

  /**
   * Ledger sequence number the funding transaction was included in.
   * Present on success.
   */
  ledger?: number;

  /**
   * ISO 8601 timestamp of when the funding transaction was created.
   * Present on success.
   */
  createdAt?: string;

  /**
   * Fee charged by the Friendbot transaction (in stroops).
   * Present on success.
   */
  feeCharged?: string;

  /**
   * The Friendbot's own source account public key.
   * Present on success; useful for audit purposes.
   */
  friendbotAccount?: string;

  /**
   * Human-readable error message when `success` is `false`.
   * Contains the Friendbot HTTP status and response body on HTTP errors.
   */
  error?: string;
}

// ─── Result Wrappers ────────────────────────────────────────────────────────

/**
 * A typed success result. Returned by safe wrapper functions when an
 * operation completes without throwing.
 *
 * @typeParam T - The value type on success
 *
 * @example
 * ```ts
 * const result = await safeGetBalance(publicKey);
 * if (result.ok) {
 *   console.log(result.value.nativeBalance);
 * }
 * ```
 */
export interface SuccessResult<T> {
  /** Always `true` — use this to narrow to `SuccessResult<T>` */
  ok: true;
  /** The successful return value */
  value: T;
}

/**
 * A typed failure result. Returned by safe wrapper functions when an
 * operation throws. The original `PocketPayError` is always preserved.
 *
 * @example
 * ```ts
 * const result = await safeGetBalance(publicKey);
 * if (!result.ok) {
 *   console.error(result.error.code, result.error.message);
 * }
 * ```
 */
export interface FailureResult {
  /** Always `false` — use this to narrow to `FailureResult` */
  ok: false;
  /** The `PocketPayError` that caused the failure */
  error: PocketPayError;
}

/**
 * A discriminated union of {@link SuccessResult} and {@link FailureResult}.
 *
 * Check the `ok` property to narrow to the correct variant:
 * - `ok === true`  → `SuccessResult<T>` — access `.value`
 * - `ok === false` → `FailureResult`    — access `.error`
 *
 * @typeParam T - The value type on success
 *
 * @example
 * ```ts
 * const result: PocketPayResult<AccountBalance> = await safeGetBalance(key);
 * if (result.ok) {
 *   console.log(result.value.nativeBalance);
 * } else {
 *   console.error(result.error.code);
 * }
 * ```
 */
export type PocketPayResult<T> = SuccessResult<T> | FailureResult;

// ─── Errors ─────────────────────────────────────────────────────────────────

/** Metadata for validation errors to identify the field and reason */
export interface ValidationMetadata {
  /** The input field that failed validation (e.g., 'publicKey', 'amount') */
  field: string;
  /** The reason validation failed (e.g., 'invalid_format', 'too_long') */
  reason: string;
  /** Optional: The value that was provided (never include secrets!) */
  value?: string | number;
}

/** Custom SDK error with additional context */
export class PocketPayError extends Error {
  /** Machine-readable error code */
  public readonly code: string;
  /** HTTP status code (if applicable) */
  public readonly statusCode?: number;
  /** Original error that caused this error */
  public readonly cause?: Error;
  /** Validation metadata (if this is a validation error) */
  public readonly validation?: ValidationMetadata;
  /** Transaction hash (if associated with a transaction) */
  public readonly transactionHash?: string;
  /** Whether the operation is safe to retry */
  public readonly retryable?: boolean;

  constructor(
    message: string,
    code: string,
    arg3?: number | {
      statusCode?: number;
      cause?: Error;
      validation?: ValidationMetadata;
    },
    arg4?: Error | string,
    arg5?: string | boolean,
    arg6?: boolean
  ) {
    super(message);
    this.name = 'PocketPayError';
    this.code = code;

    if (typeof arg3 === 'object' && arg3 !== null) {
      this.statusCode = arg3.statusCode;
      this.cause = arg3.cause;
      this.validation = arg3.validation;
    } else {
      this.statusCode = arg3 as number | undefined;
      if (typeof arg4 === 'object') {
        this.cause = arg4 as Error;
      }
    }

    if (typeof arg4 === 'string') {
      this.transactionHash = arg4;
      this.retryable = typeof arg5 === 'boolean' ? arg5 : false;
    } else if (typeof arg5 === 'string') {
      this.transactionHash = arg5;
      this.retryable = typeof arg6 === 'boolean' ? arg6 : false;
    } else if (typeof arg5 === 'boolean') {
      this.retryable = arg5;
    }

    Object.setPrototypeOf(this, PocketPayError.prototype);
  }
}

/** Options for cursor-based pagination on list queries. */
export interface PaginationOptions {
  /** Max records to return (default: 10) */
  limit?: number;
  /** Sort order by ledger time (default: "desc") */
  order?: 'asc' | 'desc';
  /** Horizon paging token to start after (for fetching the next page) */
  cursor?: string;
}


// ─── Result Warning & Recovery Hint ─────────────────────────────────────────

/**
 * A non-fatal warning attached to a successful or failed result.
 */
export interface ResultWarning {
  /** Machine-readable warning code */
  code: string;
  /** Human-readable description */
  message: string;
  /** Optional structured metadata */
  metadata?: Record<string, unknown>;
}

/**
 * An actionable suggestion for mitigation or recovery.
 */
export interface RecoveryHint {
  /** Well-known action string */
  action: string;
  /** Human-readable description */
  message: string;
  /** Whether the operation is safe to retry automatically */
  retryable?: boolean;
  /** Suggested delay in milliseconds before retrying */
  suggestedDelayMs?: number;
  /** Optional structured metadata */
  metadata?: Record<string, unknown>;
}

// ─── Enhanced Result Wrappers ───────────────────────────────────────────────

export interface EnhancedSuccessResult<T> {
  ok: true;
  value: T;
  warnings?: ResultWarning[];
  recoveryHints?: RecoveryHint[];
}

export interface EnhancedFailureResult {
  ok: false;
  error: PocketPayError;
  warnings?: ResultWarning[];
  recoveryHints?: RecoveryHint[];
}

export type EnhancedPocketPayResult<T> = EnhancedSuccessResult<T> | EnhancedFailureResult;

// ─── Trustline Validation ───────────────────────────────────────────────────

/**
 * Specification of a Stellar asset (Native XLM or an issued asset).
 *
 * For native XLM: `code` is `"XLM"` or `"native"`, `issuer` is omitted or empty.
 * For issued assets: `code` is 1-12 alphanumeric characters, `issuer` is the Stellar public key (G...).
 */
export interface StellarAssetSpec {
  /** Asset code (e.g. "XLM", "USDC", "EURT") */
  code: string;
  /** Stellar public key (G...) of the asset issuer (empty/omitted for native XLM) */
  issuer?: string;
}

/** Status discriminant for trustline verification results. */
export type TrustlineStatus =
  | 'valid'               // Destination can receive the payment
  | 'native_xlm'          // Native XLM requires no trustline check
  | 'missing_trustline'   // Destination account has no trustline for this asset
  | 'not_authorized'      // Trustline exists but issuer authorization is lacking
  | 'limit_exceeded'      // Payment amount exceeds remaining trustline capacity
  | 'account_not_found';  // Destination account does not exist / unfunded

/**
 * Result of a destination trustline verification check.
 */
export interface TrustlineCheckResult {
  /** Whether the destination account is ready to receive the issued asset payment */
  valid: boolean;
  /** Granular status code indicating the trustline validation outcome */
  status: TrustlineStatus;
  /** Destination Stellar public key (G...) */
  destination: string;
  /** The asset specification evaluated */
  asset: StellarAssetSpec;
  /** Current balance held by destination for this asset (if trustline exists) */
  currentBalance?: string;
  /** Maximum trustline limit configured by destination (if trustline exists) */
  limit?: string;
  /** Remaining capacity (`limit - currentBalance`) for this asset (if trustline exists) */
  availableCapacity?: string;
  /** Whether the trustline is authorized by the issuer (if issuer requires auth) */
  isAuthorized?: boolean;
  /** Machine-readable error code if `valid` is `false` */
  errorCode?: string;
  /** Human-readable explanation of the validation result */
  message?: string;
}

/** Options for trustline verification checks */
export interface TrustlineCheckOptions {
  /** Optional payment amount (as decimal string) to test against trustline capacity */
  amount?: string;
  /** Optional SDK config overrides */
  config?: Partial<SDKConfig>;
}
