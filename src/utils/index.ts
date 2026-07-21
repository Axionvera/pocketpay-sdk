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

export function validatePublicKey(publicKey: string): boolean {
  try {
    StellarSDK.Keypair.fromPublicKey(publicKey);
    return true;
  } catch {
    throw new PocketPayError(
      `Invalid Stellar public key: ${publicKey}`,
      'INVALID_PUBLIC_KEY',
      {
        validation: {
          field: 'publicKey',
          reason: 'invalid_format',
          value: publicKey
        }
      }
    );
  }
}

export function validateSecretKey(secretKey: string): boolean {
  try {
    StellarSDK.Keypair.fromSecret(secretKey);
    return true;
  } catch {
    throw new PocketPayError(
      'Invalid Stellar secret key',
      'INVALID_SECRET_KEY',
      {
        validation: {
          field: 'secretKey',
          reason: 'invalid_format'
          // Do NOT include value (secret!)
        }
      }
    );
  }
}

export function validateAmount(amount: string): boolean {
  // Must be a plain positive decimal string: digits, optionally one decimal
  // point followed by digits. This rejects '', whitespace, '10abc', '1e3',
  // 'Infinity', 'NaN', signs, and any other non-decimal input up front —
  // parseFloat alone would accept many of these (e.g. parseFloat('10abc') === 10).
  if (typeof amount !== 'string' || !/^\d+(\.\d+)?$/.test(amount)) {
    throw new PocketPayError(
      `Invalid amount: "${amount}". Must be a positive decimal string.`,
      'INVALID_AMOUNT',
      {
        validation: {
          field: 'amount',
          reason: 'invalid_format',
          value: amount
        }
      }
    );
  }
  const num = parseFloat(amount);
  if (num <= 0) {
    throw new PocketPayError(
      `Invalid amount: "${amount}". Must be greater than zero.`,
      'INVALID_AMOUNT',
      {
        validation: {
          field: 'amount',
          reason: 'not_positive',
          value: amount
        }
      }
    );
  }
  const parts = amount.split('.');
  if (parts[1] && parts[1].length > 7) {
    throw new PocketPayError(
      `Amount "${amount}" exceeds maximum precision of 7 decimal places.`,
      'INVALID_AMOUNT_PRECISION',
      {
        validation: {
          field: 'amount',
          reason: 'too_precise',
          value: amount
        }
      }
    );
  }
  return true;
}

/**
 * Validates a memo string for use in a Stellar transaction.
 *
 * Stellar text memos are limited to 28 bytes (not characters — multi-byte
 * Unicode characters count for more than one byte each). An empty string or
 * `undefined` memo is treated as "no memo" and is always valid, since memos
 * are optional on most PocketPay SDK operations.
 *
 * @param memo - The memo text to validate, or undefined for no memo
 * @returns true if the memo is valid (including empty/undefined)
 * @throws PocketPayError if the memo exceeds the 28-byte limit
 */
export function validateMemo(memo?: string): boolean {
  if (!memo) return true;

  const byteLength = Buffer.byteLength(memo, 'utf-8');
  if (byteLength > 28) {
    throw new PocketPayError(
      `Memo text exceeds 28-byte limit (got ${byteLength} bytes): "${memo}"`,
      'INVALID_MEMO',
      {
        validation: {
          field: 'memo',
          reason: 'too_long',
          value: memo
        }
      }
    );
  }

  return true;
}


/**
 * Validates a Stellar transaction hash.
 *
 * Stellar transaction hashes are 64-character hexadecimal strings (32 bytes
 * represented in hex). This utility throws a `PocketPayError` on invalid
 * input and returns `true` when the hash is valid.
 */
export function validateTransactionHash(hash: string): boolean {
  if (typeof hash !== 'string' || !/^[0-9a-fA-F]{64}$/.test(hash)) {
    throw new PocketPayError(
      `Invalid transaction hash: ${hash}`,
      'INVALID_TRANSACTION_HASH'
    );
  }
  return true;
}



export function stroopsToXLM(stroops: string | number): string {
  const value = typeof stroops === 'string' ? parseInt(stroops, 10) : stroops;
  return (value / 10_000_000).toFixed(7);
}

export function xlmToStroops(xlm: string | number): number {
  const value = typeof xlm === 'string' ? parseFloat(xlm) : xlm;
  return Math.round(value * 10_000_000);
}

export function truncateAddress(
  address: string,
  startChars: number = 4,
  endChars: number = 4
): string {
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

// ─── Redaction ───────────────────────────────────────────────────────────────

/**
 * Redacts a Stellar secret key, keeping only the first 4 and last 4 characters.
 *
 * Stellar secret keys start with "S" and are 56 characters long. This utility
 * masks the middle portion so the key can be safely included in logs, debug
 * output, and error messages without exposing the full secret.
 *
 * This utility **never** validates or exposes the full secret key. Invalid or
 * non-secret-key strings are handled gracefully by redacting the middle portion
 * without any validation step that could leak key material.
 *
 * @param secretKey - The secret key string to redact
 * @returns A redacted string like `"S...CK4L"` for valid keys, or `"(empty)"` for
 *   empty/blank input, or a similarly truncated string for other values
 *
 * @example
 * ```ts
 * redactSecretKey('SC4M4...FULL...CK4L');
 * // => 'SC4M...CK4L'
 *
 * redactSecretKey('');
 * // => '(empty)'
 *
 * redactSecretKey('not-a-key');
 * // => 'not-...-key'
 * ```
 */
export function redactSecretKey(secretKey: string): string {
  if (!secretKey || secretKey.trim().length === 0) {
    return '(empty)';
  }

  // Already redacted — return as-is (idempotent)
  if (secretKey.includes('...')) {
    return secretKey;
  }

  if (secretKey.length <= 8) {
    return secretKey;
  }

  return `${secretKey.slice(0, 4)}...${secretKey.slice(-4)}`;
}

/**
 * Redacts any sensitive string value by truncating the middle portion.
 *
 * This is a general-purpose redaction helper for any sensitive value (API keys,
 * tokens, private data, etc.). It keeps the first `showFirst` and last
 * `showLast` characters, replacing the middle with `...`.
 *
 * For Stellar secret keys specifically, prefer {@link redactSecretKey}.
 *
 * @param value - The sensitive string to redact
 * @param showFirst - Number of characters to keep at the start (default: 4)
 * @param showLast - Number of characters to keep at the end (default: 4)
 * @returns A redacted string, or `"(empty)"` for empty/blank input
 *
 * @example
 * ```ts
 * redactSensitiveValue('sk_live_abc123xyz789');
 * // => 'sk_l...z789'
 *
 * redactSensitiveValue('my-api-token', 2, 2);
 * // => 'my...en'
 * ```
 */
export function redactSensitiveValue(
  value: string,
  showFirst: number = 4,
  showLast: number = 4,
): string {
  // Gracefully handle null/undefined at runtime (even though TS types forbid it)
  if (value == null || value.trim().length === 0) {
    return '(empty)';
  }

  // Already redacted — return as-is (idempotent)
  if (value.includes('...')) {
    return value;
  }

  if (value.length <= showFirst + showLast) {
    return value;
  }

  return `${value.slice(0, showFirst)}...${value.slice(-showLast)}`;
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
 * Redacts sensitive data from a string, particularly for error messages.
 * Detects and masks Stellar secret keys (S...) and other sensitive patterns.
 *
 * @param str - The string to sanitize
 * @returns The sanitized string with sensitive data redacted
 */
export function redactSensitive(str: string): string {
  // Redact Stellar secret keys (S followed by 50+ alphanumeric characters)
  // Match S only at start of string or after non-alphanumeric character
  const redacted = str.replace(/(^|[^A-Za-z0-9])S[A-Z0-9]{50,}/g, '$1S[REDACTED]');
  return redacted;
}

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

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Result Helpers ─────────────────────────────────────────────────────────

export function toSuccessResult<T>(value: T): SuccessResult<T> {
  return { ok: true, value };
}

export function toFailureResult(error: PocketPayError): FailureResult {
  return { ok: false, error };
}

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
export {
  isNode,
  isBrowser,
  isReactNative,
} from './env';

