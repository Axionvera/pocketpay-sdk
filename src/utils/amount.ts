/**
 * amount.ts — the safe amount model.
 * ──────────────────────────────────────────────────────────────────────────────
 * Stellar amounts are signed 64-bit integers of stroops, where one unit is
 * 10,000,000 stroops. JavaScript's `number` cannot carry that domain: the
 * protocol allows up to 9,223,372,036,854,775,807 stroops while
 * `Number.MAX_SAFE_INTEGER` stops at 9,007,199,254,740,991 — roughly a
 * thousandth of the legal range.
 *
 * Everything here is exact:
 *
 *  - parsing splits the decimal string and builds a `bigint`; no `parseFloat`
 *  - arithmetic and comparison happen on `bigint` stroops
 *  - formatting rebuilds the string from the integer, never from a float
 *
 * `SafeAmount` also keeps the caller's original input, so "preserve exact user
 * intent" holds by construction rather than by round-tripping through
 * `toFixed()`.
 */

import { PocketPayError } from '../types';
import { ErrorCode, ERROR_CODES } from '../errors/codes';

/** Stroops in one unit of any Stellar asset. */
export const STROOPS_PER_UNIT = 10_000_000n;

/** Decimal places every Stellar asset carries. */
export const AMOUNT_DECIMALS = 7;

/** Largest amount the protocol accepts, in stroops (2^63 - 1). */
export const MAX_STROOPS = 9_223_372_036_854_775_807n;

/** A plain positive-or-zero decimal string: digits, optional fraction. */
const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;

/** Builds the typed error used for every amount rejection. */
function amountError(reason: string, message: string, value?: string): PocketPayError {
  const spec = ERROR_CODES[ErrorCode.PAYMENT_INVALID_AMOUNT];
  return new PocketPayError(message, ErrorCode.PAYMENT_INVALID_AMOUNT, {
    category: spec.category,
    safeMessage: spec.safeMessage,
    validation: { field: 'amount', reason, value },
  });
}

/**
 * An exact Stellar amount.
 *
 * Instances are immutable and always valid: construction goes through
 * {@link parseAmount}, which rejects anything the protocol cannot represent.
 */
export class SafeAmount {
  /** The amount in stroops — the protocol's own unit. */
  public readonly stroops: bigint;
  /** The caller's original input, preserved verbatim. */
  public readonly input: string;

  private constructor(stroops: bigint, input: string) {
    this.stroops = stroops;
    this.input = input;
    Object.freeze(this);
  }

  /** @internal — construction is via {@link parseAmount}. */
  static fromStroopsUnchecked(stroops: bigint, input: string): SafeAmount {
    return new SafeAmount(stroops, input);
  }

  /** True when the amount is exactly zero. */
  get isZero(): boolean {
    return this.stroops === 0n;
  }

  /**
   * The canonical decimal string: always 7 decimal places, rebuilt from the
   * integer. Use this for display and for anything sent to the network.
   */
  toString(): string {
    return formatStroops(this.stroops);
  }

  /** The canonical decimal string. Alias of {@link SafeAmount.toString}. */
  toDecimal(): string {
    return this.toString();
  }

  /** The stroop count as a decimal string, safe for any transport. */
  toStroopString(): string {
    return this.stroops.toString();
  }

  /** Serialises to the canonical decimal string. */
  toJSON(): string {
    return this.toString();
  }

  /** Exact equality on stroops. `'1'` and `'1.0000000'` are equal. */
  equals(other: SafeAmount): boolean {
    return this.stroops === other.stroops;
  }

  /** Returns -1, 0 or 1 comparing this amount to `other`. */
  compare(other: SafeAmount): -1 | 0 | 1 {
    if (this.stroops < other.stroops) return -1;
    if (this.stroops > other.stroops) return 1;
    return 0;
  }

  /**
   * Adds two amounts exactly.
   *
   * @throws PocketPayError when the result exceeds the protocol maximum
   */
  plus(other: SafeAmount): SafeAmount {
    const total = this.stroops + other.stroops;
    if (total > MAX_STROOPS) {
      throw amountError(
        'overflow',
        `Amount sum exceeds the maximum Stellar amount (${formatStroops(MAX_STROOPS)}).`
      );
    }
    return new SafeAmount(total, formatStroops(total));
  }

  /**
   * Subtracts `other` from this amount exactly.
   *
   * @throws PocketPayError when the result would be negative
   */
  minus(other: SafeAmount): SafeAmount {
    const result = this.stroops - other.stroops;
    if (result < 0n) {
      throw amountError(
        'negative_result',
        'Amount subtraction would produce a negative amount.'
      );
    }
    return new SafeAmount(result, formatStroops(result));
  }
}

/**
 * Formats a stroop count as its canonical decimal string.
 *
 * Built by slicing the integer's digits — never by dividing, so no rounding
 * error can enter.
 *
 * @param stroops - The stroop count
 * @returns A decimal string with exactly 7 decimal places
 */
export function formatStroops(stroops: bigint): string {
  const negative = stroops < 0n;
  const digits = (negative ? -stroops : stroops).toString().padStart(AMOUNT_DECIMALS + 1, '0');
  const whole = digits.slice(0, digits.length - AMOUNT_DECIMALS);
  const fraction = digits.slice(digits.length - AMOUNT_DECIMALS);
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/**
 * Parses a decimal amount string into an exact {@link SafeAmount}.
 *
 * Rejects anything that is not a plain decimal — `''`, `'10abc'`, `'1e3'`,
 * `'NaN'`, `'Infinity'`, signs and whitespace — as well as more than 7 decimal
 * places and values above the protocol maximum.
 *
 * Zero is accepted here; callers that require a payable amount should use
 * {@link parsePositiveAmount}.
 *
 * @param amount - The decimal string to parse
 * @throws PocketPayError with code `PAYMENT_INVALID_AMOUNT`
 */
export function parseAmount(amount: string): SafeAmount {
  if (typeof amount !== 'string' || !DECIMAL_PATTERN.test(amount)) {
    throw amountError(
      'invalid_format',
      `Invalid amount: "${amount}". Must be a positive decimal string.`,
      String(amount)
    );
  }

  const [whole, fraction = ''] = amount.split('.');
  if (fraction.length > AMOUNT_DECIMALS) {
    throw amountError(
      'too_precise',
      `Amount "${amount}" exceeds maximum precision of ${AMOUNT_DECIMALS} decimal places.`,
      amount
    );
  }

  // Exact: pad the fraction to 7 places and concatenate, so the value is read
  // as an integer rather than reconstructed from a float.
  const stroops = BigInt(whole + fraction.padEnd(AMOUNT_DECIMALS, '0'));

  if (stroops > MAX_STROOPS) {
    throw amountError(
      'exceeds_maximum',
      `Amount "${amount}" exceeds the maximum Stellar amount (${formatStroops(MAX_STROOPS)}).`,
      amount
    );
  }

  return SafeAmount.fromStroopsUnchecked(stroops, amount);
}

/**
 * Parses an amount that must be greater than zero.
 *
 * @param amount - The decimal string to parse
 * @throws PocketPayError when the amount is invalid or zero
 */
export function parsePositiveAmount(amount: string): SafeAmount {
  const parsed = parseAmount(amount);
  if (parsed.isZero) {
    throw amountError('not_positive', `Invalid amount: "${amount}". Must be greater than zero.`, amount);
  }
  return parsed;
}

/**
 * Builds a {@link SafeAmount} from a stroop count.
 *
 * @param stroops - Stroops as a bigint, or a decimal string of stroops
 * @throws PocketPayError when the value is malformed or out of range
 */
export function fromStroops(stroops: bigint | string): SafeAmount {
  let value: bigint;

  if (typeof stroops === 'bigint') {
    value = stroops;
  } else {
    if (typeof stroops !== 'string' || !/^\d+$/.test(stroops)) {
      throw amountError(
        'invalid_stroops',
        `Invalid stroop value: "${stroops}". Must be a whole number of stroops.`,
        String(stroops)
      );
    }
    value = BigInt(stroops);
  }

  if (value < 0n) {
    throw amountError('negative', 'Stroop values must not be negative.', value.toString());
  }
  if (value > MAX_STROOPS) {
    throw amountError(
      'exceeds_maximum',
      `Stroop value exceeds the maximum Stellar amount (${MAX_STROOPS}).`,
      value.toString()
    );
  }

  return SafeAmount.fromStroopsUnchecked(value, formatStroops(value));
}

/**
 * Non-throwing form of {@link parseAmount}.
 *
 * @param amount - The decimal string to parse
 * @returns `{ valid: true, amount }`, or `{ valid: false, error }`
 */
export function safeParseAmount(
  amount: string
): { valid: true; amount: SafeAmount } | { valid: false; error: PocketPayError } {
  try {
    return { valid: true, amount: parseAmount(amount) };
  } catch (error) {
    if (error instanceof PocketPayError) return { valid: false, error };
    throw error;
  }
}

/**
 * Converts a decimal amount string to stroops, exactly.
 *
 * This is the safe replacement for `xlmToStroops`, which returns a `number`
 * and therefore cannot represent the upper 99.9% of the protocol's range.
 *
 * @param amount - The decimal amount string
 * @returns The exact stroop count
 */
export function toStroops(amount: string): bigint {
  return parseAmount(amount).stroops;
}
