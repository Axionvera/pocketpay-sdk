/**
 * codes.ts — PocketPay SDK Public Error Code Standard
 * ─────────────────────────────────────────────────────
 * This module is the single source of truth for stable, machine-readable
 * error codes exposed by the SDK. Every code below is part of the public
 * contract: once published it must not be renamed or renumbered. Consumers
 * should branch on `PocketPayError.code` (or `error.category`) rather than
 * parsing `error.message`.
 *
 * Guidelines:
 *  - Codes are UPPER_SNAKE_CASE and prefixed by their category (e.g. WALLET_*,
 *    PAYMENT_*, TX_*, NET_*, SOROBAN_*, VAULT_*, SDK_*).
 *  - Codes are stable. Add new ones; never edit/recycle existing ones.
 *  - `safeMessage` is what you may show end users. `message` (the raw Error
 *    message) may contain sensitive detail and must be redacted before logging
 *    or surfacing (see taxonomy.ts → redactError).
 */

/** High-level error categories. Used for grouping, telemetry, and routing. */
export enum ErrorCategory {
  Wallet = 'WALLET',
  Payment = 'PAYMENT',
  Transaction = 'TRANSACTION',
  Network = 'NETWORK',
  Soroban = 'SOROBAN',
  Vault = 'VAULT',
  SDK = 'SDK',
}

/**
 * Public, stable error codes. Prefer referencing these constants over raw
 * strings so refactors can't silently drift the contract.
 */
export const ErrorCode = {
  // ─── Wallet ──────────────────────────────────────────────────────────────
  WALLET_SECRET_EXPOSED: 'WALLET_SECRET_EXPOSED',
  WALLET_INVALID_SECRET: 'WALLET_INVALID_SECRET',
  WALLET_INVALID_PUBLIC_KEY: 'WALLET_INVALID_PUBLIC_KEY',
  WALLET_ACCOUNT_UNFUNDED: 'WALLET_ACCOUNT_UNFUNDED',
  WALLET_KEYPAIR_MISMATCH: 'WALLET_KEYPAIR_MISMATCH',
  WALLET_TESTNET_ONLY: 'WALLET_TESTNET_ONLY',

  // ─── Payment ───────────────────────────────────────────────────────────────
  PAYMENT_SELF: 'PAYMENT_SELF',
  PAYMENT_INVALID_AMOUNT: 'PAYMENT_INVALID_AMOUNT',
  PAYMENT_INVALID_DESTINATION: 'PAYMENT_INVALID_DESTINATION',
  PAYMENT_TRUSTLINE_MISSING: 'PAYMENT_TRUSTLINE_MISSING',
  PAYMENT_ASSET_UNSUPPORTED: 'PAYMENT_ASSET_UNSUPPORTED',
  PAYMENT_PREVIEW_FAILED: 'PAYMENT_PREVIEW_FAILED',

  // ─── Transaction ────────────────────────────────────────────────────────────
  TX_EXPIRED: 'TX_EXPIRED',
  TX_FAILED: 'TX_FAILED',
  TX_STATUS_UNKNOWN: 'TX_STATUS_UNKNOWN',
  TX_INVALID_ASSET: 'TX_INVALID_ASSET',
  TX_INVALID_ASSET_CODE: 'TX_INVALID_ASSET_CODE',
  TX_UNSIGNED: 'TX_UNSIGNED',
  TX_SIGNING_DENIED: 'TX_SIGNING_DENIED',
  TX_BUILD_FAILED: 'TX_BUILD_FAILED',
  TX_INVALID_MEMO: 'TX_INVALID_MEMO',
  TX_BAD_SEQUENCE: 'TX_BAD_SEQUENCE',
  TX_SIGNER_MISSING: 'TX_SIGNER_MISSING',
  TX_SIGNER_MISMATCH: 'TX_SIGNER_MISMATCH',

  // ─── Network ──────────────────────────────────────────────────────────────
  NET_RATE_LIMITED: 'NET_RATE_LIMITED',
  NET_TIMEOUT: 'NET_TIMEOUT',
  NET_UNREACHABLE: 'NET_UNREACHABLE',
  NET_HTTP: 'NET_HTTP',
  NET_IDEMPOTENCY_CONFLICT: 'NET_IDEMPOTENCY_CONFLICT',

  // ─── Soroban ────────────────────────────────────────────────────────────────
  SOROBAN_CONTRACT_ERROR: 'SOROBAN_CONTRACT_ERROR',
  SOROBAN_SIMULATION_FAILED: 'SOROBAN_SIMULATION_FAILED',
  SOROBAN_RPC_UNAVAILABLE: 'SOROBAN_RPC_UNAVAILABLE',
  SOROBAN_INVALID_RESPONSE: 'SOROBAN_INVALID_RESPONSE',

  // ─── Vault ──────────────────────────────────────────────────────────────────
  VAULT_CONTRACT_NOT_CONFIGURED: 'VAULT_CONTRACT_NOT_CONFIGURED',
  VAULT_DEPOSIT_FAILED: 'VAULT_DEPOSIT_FAILED',
  VAULT_WITHDRAW_FAILED: 'VAULT_WITHDRAW_FAILED',
  VAULT_INSUFFICIENT_FUNDS: 'VAULT_INSUFFICIENT_FUNDS',

  // ─── SDK / generic ────────────────────────────────────────────────────────
  SDK_CONFIG_INVALID: 'SDK_CONFIG_INVALID',
  SDK_NOT_IMPLEMENTED: 'SDK_NOT_IMPLEMENTED',
  SDK_INTERNAL: 'SDK_INTERNAL',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Metadata describing how a consumer should treat a given error code. */
export interface ErrorCodeSpec {
  category: ErrorCategory;
  /** Whether the operation is safe to retry (e.g. rate-limit, transient net). */
  retryable: boolean;
  /** Suggested HTTP-ish status for API layers; undefined for client errors. */
  httpStatus?: number;
  /**
   * User-safe summary. Never includes secrets, raw addresses, or internal
   * detail. Safe to display in UI.
   */
  safeMessage: string;
  /** One-line guidance for developers integrating the SDK. */
  developerHint: string;
}

/**
 * The published error-code registry. Every code used by the SDK should appear
 * here so consumers get a category, retryability, and a safe message.
 */
export const ERROR_CODES: Record<ErrorCodeValue, ErrorCodeSpec> = {
  [ErrorCode.WALLET_SECRET_EXPOSED]: {
    category: ErrorCategory.Wallet,
    retryable: false,
    safeMessage: 'A secret key was found where it should not be. Operation blocked.',
    developerHint: 'Never pass a secret key (S...) to read-only APIs. Use the public key (G...).',
  },
  [ErrorCode.WALLET_INVALID_SECRET]: {
    category: ErrorCategory.Wallet,
    retryable: false,
    safeMessage: 'The provided secret key is invalid.',
    developerHint: 'Validate the S... secret before use; do not log it.',
  },
  [ErrorCode.WALLET_INVALID_PUBLIC_KEY]: {
    category: ErrorCategory.Wallet,
    retryable: false,
    safeMessage: 'The provided public key is invalid.',
    developerHint: 'Public keys must start with G and be 56 chars (StrKey ed25519).',
  },
  [ErrorCode.WALLET_ACCOUNT_UNFUNDED]: {
    category: ErrorCategory.Wallet,
    retryable: false,
    safeMessage: 'The account has no funds. Fund it before transacting.',
    developerHint: 'Horizon returned 404 for the account. Call fundTestnetAccount() on testnet.',
  },
  [ErrorCode.WALLET_KEYPAIR_MISMATCH]: {
    category: ErrorCategory.Wallet,
    retryable: false,
    safeMessage: 'The provided secret and public key do not match.',
    developerHint: 'Derive the public key from the secret and compare before signing.',
  },
  [ErrorCode.WALLET_TESTNET_ONLY]: {
    category: ErrorCategory.Wallet,
    retryable: false,
    safeMessage: 'This operation is only available on testnet.',
    developerHint: 'Friendbot funding exists only on testnet. Set network to "testnet" to use it.',
  },

  [ErrorCode.PAYMENT_SELF]: {
    category: ErrorCategory.Payment,
    retryable: false,
    safeMessage: 'Cannot send a payment to your own account.',
    developerHint: 'Reject source === destination before building the payment.',
  },
  [ErrorCode.PAYMENT_INVALID_AMOUNT]: {
    category: ErrorCategory.Payment,
    retryable: false,
    safeMessage: 'The payment amount is invalid.',
    developerHint: 'Amount must be a positive decimal string within asset precision.',
  },
  [ErrorCode.PAYMENT_INVALID_DESTINATION]: {
    category: ErrorCategory.Payment,
    retryable: false,
    safeMessage: 'The payment destination is invalid.',
    developerHint: 'Destination must be a valid G... account or a federation address.',
  },
  [ErrorCode.PAYMENT_TRUSTLINE_MISSING]: {
    category: ErrorCategory.Payment,
    retryable: false,
    safeMessage: 'The destination lacks a trustline for this asset.',
    developerHint: 'Run a trustline preflight check; the recipient must authorize the asset.',
  },
  [ErrorCode.PAYMENT_ASSET_UNSUPPORTED]: {
    category: ErrorCategory.Payment,
    retryable: false,
    safeMessage: 'This asset is not supported for the requested operation.',
    developerHint: 'Supply a valid { code, issuer } spec; native XLM needs no issuer.',
  },
  [ErrorCode.PAYMENT_PREVIEW_FAILED]: {
    category: ErrorCategory.Payment,
    retryable: true,
    safeMessage: 'Could not preview the payment right now. Try again.',
    developerHint: 'Usually a transient Horizon read failure; safe to retry.',
  },

  [ErrorCode.TX_EXPIRED]: {
    category: ErrorCategory.Transaction,
    retryable: false,
    safeMessage: 'The transaction expired and can no longer be submitted.',
    developerHint: 'Rebuild a fresh envelope with a new timebounds; do not resubmit.',
  },
  [ErrorCode.TX_FAILED]: {
    category: ErrorCategory.Transaction,
    retryable: false,
    safeMessage: 'The transaction was rejected on-chain.',
    developerHint: 'Inspect result_codes; a definitive rejection requires rebuilding.',
  },
  [ErrorCode.TX_STATUS_UNKNOWN]: {
    category: ErrorCategory.Transaction,
    retryable: false,
    safeMessage: 'Transaction status is unknown after submission.',
    developerHint: 'Poll Horizon before deciding to rebuild or resubmit.',
  },
  [ErrorCode.TX_INVALID_ASSET]: {
    category: ErrorCategory.Transaction,
    retryable: false,
    safeMessage: 'The asset specification is invalid.',
    developerHint: 'Native XLM must not carry an issuer; issued assets need code + issuer.',
  },
  [ErrorCode.TX_INVALID_ASSET_CODE]: {
    category: ErrorCategory.Transaction,
    retryable: false,
    safeMessage: 'The asset code is missing or invalid.',
    developerHint: 'Asset code is required and must match issuer asset code.',
  },
  [ErrorCode.TX_UNSIGNED]: {
    category: ErrorCategory.Transaction,
    retryable: false,
    safeMessage: 'The transaction is not signed.',
    developerHint: 'An unsigned transaction cannot be submitted; sign before submit.',
  },
  [ErrorCode.TX_SIGNING_DENIED]: {
    category: ErrorCategory.Transaction,
    retryable: false,
    safeMessage: 'Transaction signing was denied.',
    developerHint: 'The wallet/user rejected the signing request.',
  },
  [ErrorCode.TX_BUILD_FAILED]: {
    category: ErrorCategory.Transaction,
    retryable: false,
    safeMessage: 'Failed to build the transaction.',
    developerHint: 'Check operation params, sequence number, and asset specs.',
  },
  [ErrorCode.TX_BAD_SEQUENCE]: {
    category: ErrorCategory.Transaction,
    retryable: false,
    safeMessage: 'The transaction used an out-of-date account sequence number.',
    developerHint:
      'Resubmitting the same envelope can never succeed. Refresh the account sequence and ' +
      'rebuild the transaction; see requiresRebuild().',
  },
  [ErrorCode.TX_INVALID_MEMO]: {
    category: ErrorCategory.Transaction,
    retryable: false,
    safeMessage: 'The transaction memo is invalid.',
    developerHint:
      'Text memos are limited to 28 bytes; id memos are unsigned 64-bit integers; ' +
      'hash and return memos are 64 hex characters.',
  },
  [ErrorCode.TX_SIGNER_MISSING]: {
    category: ErrorCategory.Transaction,
    retryable: false,
    safeMessage: 'This account cannot sign transactions.',
    developerHint: 'The account has no Signer attached (read-only). Check canSignTransaction(account) before calling sign(), or attach a Signer via createLocalAccount/createAccountWithSigner.',
  },
  [ErrorCode.TX_SIGNER_MISMATCH]: {
    category: ErrorCategory.Transaction,
    retryable: false,
    safeMessage: 'The signer does not match the transaction source account.',
    developerHint: 'Compare account.publicKey (or signer.publicKey) to the transaction source account before signing.',
  },

  [ErrorCode.NET_RATE_LIMITED]: {
    category: ErrorCategory.Network,
    retryable: true,
    httpStatus: 429,
    safeMessage: 'Too many requests. Please wait and try again.',
    developerHint: 'Honor Retry-After; back off exponentially.',
  },
  [ErrorCode.NET_TIMEOUT]: {
    category: ErrorCategory.Network,
    retryable: true,
    httpStatus: 504,
    safeMessage: 'The request timed out. Please try again.',
    developerHint: 'Transient; retry with idempotency key.',
  },
  [ErrorCode.NET_UNREACHABLE]: {
    category: ErrorCategory.Network,
    retryable: true,
    safeMessage: 'The network is unreachable. Please try again.',
    developerHint: 'DNS/connection error; safe to retry.',
  },
  [ErrorCode.NET_HTTP]: {
    category: ErrorCategory.Network,
    retryable: false,
    safeMessage: 'A network request failed.',
    developerHint: 'Inspect statusCode; non-5xx is usually non-retryable.',
  },
  [ErrorCode.NET_IDEMPOTENCY_CONFLICT]: {
    category: ErrorCategory.Network,
    retryable: false,
    httpStatus: 409,
    safeMessage: 'A conflicting request was already processed.',
    developerHint: 'An in-flight request with the same idempotency key exists.',
  },

  [ErrorCode.SOROBAN_CONTRACT_ERROR]: {
    category: ErrorCategory.Soroban,
    retryable: false,
    safeMessage: 'The smart contract call failed.',
    developerHint: 'Inspect contract result; may need different args or auth.',
  },
  [ErrorCode.SOROBAN_SIMULATION_FAILED]: {
    category: ErrorCategory.Soroban,
    retryable: true,
    safeMessage: 'Contract simulation failed. Please try again.',
    developerHint: 'Often transient RPC; retry before giving up.',
  },
  [ErrorCode.SOROBAN_RPC_UNAVAILABLE]: {
    category: ErrorCategory.Soroban,
    retryable: true,
    safeMessage: 'The Soroban RPC is unavailable. Please try again.',
    developerHint: 'Transient; retry with backoff.',
  },
  [ErrorCode.SOROBAN_INVALID_RESPONSE]: {
    category: ErrorCategory.Soroban,
    retryable: false,
    safeMessage: 'The contract returned an unexpected response.',
    developerHint: 'Schema mismatch between SDK and deployed contract.',
  },

  [ErrorCode.VAULT_CONTRACT_NOT_CONFIGURED]: {
    category: ErrorCategory.Vault,
    retryable: false,
    safeMessage: 'Vault operations require a configured contract.',
    developerHint: 'Set SDKConfig.contractId before vault calls.',
  },
  [ErrorCode.VAULT_DEPOSIT_FAILED]: {
    category: ErrorCategory.Vault,
    retryable: false,
    safeMessage: 'The vault deposit failed.',
    developerHint: 'Check allowance, balance, and contract state.',
  },
  [ErrorCode.VAULT_WITHDRAW_FAILED]: {
    category: ErrorCategory.Vault,
    retryable: false,
    safeMessage: 'The vault withdrawal failed.',
    developerHint: 'Check available balance and unlock schedule.',
  },
  [ErrorCode.VAULT_INSUFFICIENT_FUNDS]: {
    category: ErrorCategory.Vault,
    retryable: false,
    safeMessage: 'Insufficient vault funds.',
    developerHint: 'The requested amount exceeds the vault balance.',
  },

  [ErrorCode.SDK_CONFIG_INVALID]: {
    category: ErrorCategory.SDK,
    retryable: false,
    safeMessage: 'The SDK configuration is invalid.',
    developerHint: 'Run validatePocketPayConfig and fix reported issues.',
  },
  [ErrorCode.SDK_NOT_IMPLEMENTED]: {
    category: ErrorCategory.SDK,
    retryable: false,
    safeMessage: 'This operation is not implemented.',
    developerHint: 'Feature gap; track via the project roadmap.',
  },
  [ErrorCode.SDK_INTERNAL]: {
    category: ErrorCategory.SDK,
    retryable: false,
    safeMessage: 'An unexpected SDK error occurred.',
    developerHint: 'Report with redacted logs; should not normally happen.',
  },
};

/** Returns true if the given string is a known public error code. */
export function isKnownErrorCode(code: string): code is ErrorCodeValue {
  return Object.values(ErrorCode).includes(code as ErrorCodeValue);
}
