/**
 * Stellar PocketPay SDK — Utility Helpers
 *
 * Shared validation, formatting, and conversion utilities.
 */

import * as StellarSDK from '@stellar/stellar-sdk';
import {
  AssetBalance,
  PocketPayError,
  SuccessResult,
  FailureResult,
  PocketPayResult,
} from '../types';

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validates that a string is a valid Stellar public key (G...).
 *
 * @param publicKey - The public key to validate
 * @returns true if valid
 * @throws PocketPayError if invalid
 */
export function validatePublicKey(publicKey: string): boolean {
  try {
    StellarSDK.Keypair.fromPublicKey(publicKey);
    return true;
  } catch {
    throw new PocketPayError(
      `Invalid Stellar public key: ${publicKey}`,
      'INVALID_PUBLIC_KEY'
    );
  }
}

/**
 * Validates that a string is a valid Stellar secret key (S...).
 *
 * @param secretKey - The secret key to validate
 * @returns true if valid
 * @throws PocketPayError if invalid
 */
export function validateSecretKey(secretKey: string): boolean {
  try {
    StellarSDK.Keypair.fromSecret(secretKey);
    return true;
  } catch {
    throw new PocketPayError(
      'Invalid Stellar secret key',
      'INVALID_SECRET_KEY'
    );
  }
}

/**
 * Validates that an amount string is a positive number with valid precision.
 *
 * @param amount - The amount string to validate
 * @returns true if valid
 * @throws PocketPayError if invalid
 */
export function validateAmount(amount: string): boolean {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) {
    throw new PocketPayError(
      `Invalid amount: "${amount}". Must be a positive number.`,
      'INVALID_AMOUNT'
    );
  }
  // Stellar supports up to 7 decimal places
  const parts = amount.split('.');
  if (parts[1] && parts[1].length > 7) {
    throw new PocketPayError(
      `Amount "${amount}" exceeds maximum precision of 7 decimal places.`,
      'INVALID_AMOUNT_PRECISION'
    );
  }
  return true;
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/**
 * Converts stroops (1 XLM = 10,000,000 stroops) to XLM string.
 *
 * @param stroops - Amount in stroops
 * @returns Formatted XLM amount string
 */
export function stroopsToXLM(stroops: string | number): string {
  const value = typeof stroops === 'string' ? parseInt(stroops, 10) : stroops;
  return (value / 10_000_000).toFixed(7);
}

/**
 * Converts XLM amount to stroops.
 *
 * @param xlm - Amount in XLM
 * @returns Amount in stroops
 */
export function xlmToStroops(xlm: string | number): number {
  const value = typeof xlm === 'string' ? parseFloat(xlm) : xlm;
  return Math.round(value * 10_000_000);
}

/**
 * Truncates a Stellar address for display purposes.
 *
 * @param address - Full public key
 * @param startChars - Number of characters from the start (default: 4)
 * @param endChars - Number of characters from the end (default: 4)
 * @returns Truncated address like "GABCD...WXYZ"
 */
export function truncateAddress(
  address: string,
  startChars: number = 4,
  endChars: number = 4
): string {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

// ─── Asset Helpers ───────────────────────────────────────────────────────────

/**
 * Finds a specific asset balance from an array of asset balances.
 *
 * For native XLM, pass `"XLM"` as the asset code. For issued assets, pass the
 * asset code and optionally the issuer to disambiguate.
 *
 * @param balances - Array of asset balances to search
 * @param assetCode - Asset code to find (e.g. `"XLM"`, `"USDC"`)
 * @param assetIssuer - Issuer public key (required for issued assets with
 *   multiple issuers; ignored for native XLM)
 * @returns The matching `AssetBalance` or `undefined` if not found
 *
 * @example
 * ```ts
 * // Native XLM
 * const xlm = findAssetBalance(balances, 'XLM');
 *
 * // USDC from a specific issuer
 * const usdc = findAssetBalance(balances, 'USDC', 'GA5ZSE...KZVN');
 *
 * // First USDC balance (any issuer)
 * const anyUsdc = findAssetBalance(balances, 'USDC');
 * ```
 */
export function findAssetBalance(
  balances: AssetBalance[],
  assetCode: string,
  assetIssuer?: string,
): AssetBalance | undefined {
  return balances.find((b) => {
    if (assetCode === 'XLM') {
      return b.asset === 'XLM';
    }
    if (assetIssuer) {
      return b.asset === assetCode && b.issuer === assetIssuer;
    }
    return b.asset === assetCode;
  });
}

// ─── Error Wrapping ─────────────────────────────────────────────────────────

/**
 * Wraps an unknown error into a PocketPayError with context.
 *
 * @param error - The caught error
 * @param context - Description of what was being attempted
 * @param code - Machine-readable error code
 * @returns PocketPayError instance
 */
export function wrapError(
  error: unknown,
  context: string,
  code: string
): PocketPayError {
  if (error instanceof PocketPayError) return error;

  const message =
    error instanceof Error ? error.message : String(error);
  const cause = error instanceof Error ? error : undefined;

  return new PocketPayError(
    `${context}: ${message}`,
    code,
    undefined,
    cause
  );
}

// ─── Misc ───────────────────────────────────────────────────────────────────

/**
 * Delays execution for the specified number of milliseconds.
 *
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Result Helpers ─────────────────────────────────────────────────────────

/**
 * Creates a `SuccessResult<T>` wrapping the given value.
 *
 * @param value - The successful result value
 * @returns A `SuccessResult<T>` with `ok: true`
 *
 * @example
 * ```ts
 * return toSuccessResult(balance);
 * // → { ok: true, value: balance }
 * ```
 */
export function toSuccessResult<T>(value: T): SuccessResult<T> {
  return { ok: true, value };
}

/**
 * Converts a `PocketPayError` into a `FailureResult`.
 *
 * @param error - The `PocketPayError` to wrap
 * @returns A `FailureResult` with `ok: false`
 *
 * @example
 * ```ts
 * catch (err) {
 *   return toFailureResult(err instanceof PocketPayError ? err : wrapError(err, 'context', 'CODE'));
 * }
 * ```
 */
export function toFailureResult(error: PocketPayError): FailureResult {
  return { ok: false, error };
}

/**
 * Wraps a `Promise`-returning thunk and returns a `PocketPayResult<T>`
 * instead of throwing. Any error that is not already a `PocketPayError`
 * is normalised via {@link wrapError}.
 *
 * This is the low-level building block used by the `safe*` helpers below.
 * You can use it to wrap any SDK call in one line:
 *
 * @example
 * ```ts
 * const result = await toResult(() => sendXLM(params, config));
 * if (result.ok) {
 *   console.log('tx hash:', result.value.hash);
 * } else {
 *   console.error(result.error.code);
 * }
 * ```
 */
export async function toResult<T>(
  fn: () => Promise<T>,
  errorContext?: string,
  errorCode?: string
): Promise<PocketPayResult<T>> {
  try {
    const value = await fn();
    return toSuccessResult(value);
  } catch (err) {
    const pocketErr =
      err instanceof PocketPayError
        ? err
        : wrapError(err, errorContext ?? 'Operation failed', errorCode ?? 'UNKNOWN_ERROR');
    return toFailureResult(pocketErr);
  }
}

// ─── Safe Wrappers ──────────────────────────────────────────────────────────
//
// These functions mirror the core SDK APIs but return PocketPayResult<T>
// instead of throwing. Existing throwing APIs are unchanged and still work
// exactly as before — these are purely additive alternatives for consumers
// that prefer explicit error handling over try/catch.
//
// Import the underlying functions directly rather than going through the
// barrel to avoid circular-dependency issues at the utils layer.

import { getBalance, fundTestnetAccount } from '../wallet';
import { sendXLM } from '../payments';
import { getTransactions, getPayments } from '../transactions';
import {
  AccountBalance,
  FundResult,
  PaymentResult,
  TransactionList,
  PaymentList,
  SendXLMParams,
  SDKConfig,
} from '../types';

/**
 * Non-throwing alternative to {@link getBalance}.
 *
 * @param publicKey - Stellar public key (G...)
 * @param config - Optional SDK config overrides
 * @returns `PocketPayResult<AccountBalance>` — never throws
 */
export async function safeGetBalance(
  publicKey: string,
  config?: Partial<SDKConfig>
): Promise<PocketPayResult<AccountBalance>> {
  return toResult(() => getBalance(publicKey, config), 'Failed to fetch balance', 'BALANCE_ERROR');
}

/**
 * Non-throwing alternative to {@link fundTestnetAccount}.
 *
 * @param publicKey - Stellar public key (G...) to fund
 * @returns `PocketPayResult<FundResult>` — never throws
 */
export async function safeFundTestnetAccount(
  publicKey: string
): Promise<PocketPayResult<FundResult>> {
  return toResult(() => fundTestnetAccount(publicKey), 'Failed to fund testnet account', 'FUND_ERROR');
}

/**
 * Non-throwing alternative to {@link sendXLM}.
 *
 * @param params - Payment parameters
 * @param config - Optional SDK config overrides
 * @returns `PocketPayResult<PaymentResult>` — never throws
 */
export async function safeSendXLM(
  params: SendXLMParams,
  config?: Partial<SDKConfig>
): Promise<PocketPayResult<PaymentResult>> {
  return toResult(() => sendXLM(params, config), 'Failed to send XLM', 'SEND_ERROR');
}

/**
 * Non-throwing alternative to {@link getTransactions}.
 *
 * @param publicKey - Stellar public key (G...)
 * @param limit - Maximum number of records to return
 * @param config - Optional SDK config overrides
 * @returns `PocketPayResult<TransactionList>` — never throws
 */
export async function safeGetTransactions(
  publicKey: string,
  limit?: number,
  config?: Partial<SDKConfig>
): Promise<PocketPayResult<TransactionList>> {
  return toResult(
    () => getTransactions(publicKey, limit, undefined, config),
    'Failed to fetch transactions',
    'TRANSACTION_ERROR'
  );
}

/**
 * Non-throwing alternative to {@link getPayments}.
 *
 * @param publicKey - Stellar public key (G...)
 * @param limit - Maximum number of records to return
 * @param config - Optional SDK config overrides
 * @returns `PocketPayResult<PaymentList>` — never throws
 */
export async function safeGetPayments(
  publicKey: string,
  limit?: number,
  config?: Partial<SDKConfig>
): Promise<PocketPayResult<PaymentList>> {
  return toResult(
    () => getPayments(publicKey, limit, undefined, config),
    'Failed to fetch payments',
    'PAYMENT_ERROR'
  );
}
