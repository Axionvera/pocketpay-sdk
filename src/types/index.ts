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
