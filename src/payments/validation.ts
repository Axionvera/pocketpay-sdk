/**
 * Stellar PocketPay SDK — Payment Input Validation Helper
 *
 * Non-throwing companion to {@link sendXLM}'s built-in preflight validation.
 * Runs the same input checks (`validateSecretKey`, `validatePublicKey`,
 * `validateAmount`, `validateMemo`, plus the self-payment guard) and returns
 * a structured result rather than throwing on the first failure. Intended for
 * form UIs and other callers that need to enumerate every input problem
 * before letting the user retry.
 *
 * This helper is pure: no Horizon calls, no signing, no transaction
 * submission of any kind.
 */

import * as StellarSDK from '@stellar/stellar-sdk';
import { PocketPayError, SendXLMParams } from '../types';
import {
  validateAmount,
  validateMemo,
  validatePublicKey,
  validateSecretKey,
} from '../utils';

/**
 * Stable machine-readable code for a single validation failure. Consumers
 * should branch on `code`, never parse `message`, since the message is
 * intended for human consumption and may change over time.
 */
export type ValidationErrorCode =
  | 'INVALID_SECRET_KEY'
  | 'INVALID_PUBLIC_KEY'
  | 'INVALID_AMOUNT'
  | 'INVALID_AMOUNT_PRECISION'
  | 'INVALID_MEMO'
  | 'SELF_PAYMENT';

/** The `SendXLMParams` field responsible for a validation failure. */
export type ValidationErrorField =
  | 'sourceSecret'
  | 'destination'
  | 'amount'
  | 'memo';

/**
 * One validation failure. Multiple errors can be reported per call so a form
 * can show every offending field at once instead of one at a time.
 */
export interface ValidationError {
  /** Stable machine-readable classification. */
  code: ValidationErrorCode;
  /** Which `SendXLMParams` field failed. */
  field: ValidationErrorField;
  /** Short reason token (e.g. `"invalid_format"`, `"too_precise"`). */
  reason: string;
  /** Human-readable message. */
  message: string;
}

/** Discriminated result of {@link validateSendXLMParams}. */
export type SendXLMValidationResult =
  | { ok: true }
  | { ok: false; errors: ValidationError[] };

/**
 * Validate {@link SendXLMParams} without submitting a transaction.
 *
 * Runs the same input checks that `sendXLM` performs internally:
 * 1. Source secret key format (`S...`)
 * 2. Destination public key format (`G...`)
 * 3. Amount format, positivity, and 7-decimal-place precision
 * 4. Memo byte length (≤ 28 bytes) when present
 * 5. Self-payment detection when the source public key can be derived
 *
 * Unlike `sendXLM`, this helper never throws and never touches the network.
 * It collects every validation failure into a single structured result so a
 * UI can render all field errors at once.
 *
 * @example
 * ```ts
 * const result = validateSendXLMParams(params);
 * if (!result.ok) {
 *   for (const err of result.errors) {
 *     showFieldError(err.field, err.message);
 *   }
 *   return;
 * }
 * await sendXLM(params);
 * ```
 */
export function validateSendXLMParams(
  params: SendXLMParams,
): SendXLMValidationResult {
  const errors: ValidationError[] = [];

  // 1. Source secret key format.
  try {
    validateSecretKey(params.sourceSecret);
  } catch (err) {
    errors.push(toValidationError(err, 'sourceSecret', 'INVALID_SECRET_KEY'));
  }

  // 2. Destination public key format.
  try {
    validatePublicKey(params.destination);
  } catch (err) {
    errors.push(toValidationError(err, 'destination', 'INVALID_PUBLIC_KEY'));
  }

  // 3. Amount format + positivity + precision.
  try {
    validateAmount(params.amount);
  } catch (err) {
    errors.push(toValidationError(err, 'amount', 'INVALID_AMOUNT'));
  }

  // 4. Memo length (optional field; missing memo is always valid).
  try {
    validateMemo(params.memo);
  } catch (err) {
    errors.push(toValidationError(err, 'memo', 'INVALID_MEMO'));
  }

  // 5. Self-payment — only checkable when secret + destination both parse.
  // Skipping when either failed keeps the helper from crashing on an invalid
  // secret key, and avoids reporting a misleading SELF_PAYMENT alongside a
  // real INVALID_SECRET_KEY.
  const secretOk = !errors.some((e) => e.field === 'sourceSecret');
  const destOk = !errors.some((e) => e.field === 'destination');
  if (secretOk && destOk) {
    try {
      const sourcePublic = StellarSDK.Keypair.fromSecret(
        params.sourceSecret,
      ).publicKey();
      if (sourcePublic === params.destination) {
        errors.push({
          code: 'SELF_PAYMENT',
          field: 'destination',
          reason: 'same_as_source',
          message: 'Cannot send XLM to yourself.',
        });
      }
    } catch {
      // Should not happen once validateSecretKey has passed; stay defensive
      // rather than surface a duplicate INVALID_SECRET_KEY here.
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * Convert a `PocketPayError` thrown by one of the underlying validators into
 * a structured `ValidationError`. Falls back to the caller-provided defaults
 * if the thrown value is not a `PocketPayError` (should not happen, but
 * keeps the helper total).
 */
function toValidationError(
  err: unknown,
  field: ValidationErrorField,
  fallbackCode: ValidationErrorCode,
): ValidationError {
  if (err instanceof PocketPayError) {
    const code =
      isKnownValidationCode(err.code) ? err.code : fallbackCode;
    const reason = err.validation?.reason ?? 'invalid';
    // Prefer the validator's own field label when it provides one so we
    // stay consistent with the throwing path (e.g. INVALID_PUBLIC_KEY
    // labels its field as "publicKey").
    return {
      code,
      field,
      reason,
      message: err.message,
    };
  }
  return {
    code: fallbackCode,
    field,
    reason: 'unknown',
    message: err instanceof Error ? err.message : String(err),
  };
}

function isKnownValidationCode(code: string): code is ValidationErrorCode {
  return (
    code === 'INVALID_SECRET_KEY' ||
    code === 'INVALID_PUBLIC_KEY' ||
    code === 'INVALID_AMOUNT' ||
    code === 'INVALID_AMOUNT_PRECISION' ||
    code === 'INVALID_MEMO' ||
    code === 'SELF_PAYMENT'
  );
}
