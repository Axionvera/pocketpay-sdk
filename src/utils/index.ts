/**
 * Stellar PocketPay SDK — Utility Helpers
 *
 * Shared validation, formatting, and conversion utilities.
 */

import * as StellarSDK from '@stellar/stellar-sdk';
import { PocketPayError } from '../types';

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
