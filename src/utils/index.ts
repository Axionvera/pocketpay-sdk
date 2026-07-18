/**
 * Stellar PocketPay SDK — Utility Helpers
 *
 * Shared validation, formatting, and conversion utilities.
 */ 

import * as StellarSDK from '@stellar/stellar-sdk';
import {
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

// ─── Error Wrapping ─────────────────────────────────────────────────────────

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

// ─── Safe Wrappers ──────────────────────────────────────────────────────────

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

export async function safeGetBalance(
  publicKey: string,
  config?: Partial<SDKConfig>
): Promise<PocketPayResult<AccountBalance>> {
  return toResult(() => getBalance(publicKey, config), 'Failed to fetch balance', 'BALANCE_ERROR');
}

export async function safeFundTestnetAccount(
  publicKey: string
): Promise<PocketPayResult<FundResult>> {
  return toResult(() => fundTestnetAccount(publicKey), 'Failed to fund testnet account', 'FUND_ERROR');
}

export async function safeSendXLM(
  params: SendXLMParams,
  config?: Partial<SDKConfig>
): Promise<PocketPayResult<PaymentResult>> {
  return toResult(() => sendXLM(params, config), 'Failed to send XLM', 'SEND_ERROR');
}

export async function safeGetTransactions(
  publicKey: string,
  limit: number = 10,
  order: 'asc' | 'desc' = 'desc',
  config?: Partial<SDKConfig>
): Promise<PocketPayResult<TransactionList>> {
  return toResult(
    () => getTransactions(publicKey, limit, order, config),
    'Failed to fetch transactions',
    'TRANSACTION_ERROR'
  );
}

export async function safeGetPayments(
  publicKey: string,
  limit: number = 10,
  order: 'asc' | 'desc' = 'desc',
  config?: Partial<SDKConfig>
): Promise<PocketPayResult<PaymentList>> {
  return toResult(
    () => getPayments(publicKey, limit, order, config),
    'Failed to fetch payments',
    'PAYMENT_ERROR'
  );
}
