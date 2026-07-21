/**
 * Stellar PocketPay SDK — Error & Result Enrichment Types
 *
 * Defines structured warning and recovery-hint types that can be attached to
 * any {@link PocketPayResult} to give consumers richer, actionable feedback
 * beyond a simple success/failure boolean.
 */

// ─── Result Warning ─────────────────────────────────────────────────────────

/**
 * A non-fatal warning attached to a successful or failed result.
 *
 * Warnings communicate issues that did not prevent the operation from
 * completing (or from producing a meaningful error) but that the consumer
 * should be aware of — for example, a deprecated field being used, a
 * rate-limit that was nearly exceeded, or a partial degradation in service.
 *
 * @example
 * ```ts
 * const warning: ResultWarning = {
 *   code: 'DEPRECATED_FIELD',
 *   message: 'The "memo" field is deprecated; use "memoText" instead.',
 * };
 * ```
 */
export interface ResultWarning {
  /**
   * Machine-readable warning code (e.g. `"DEPRECATED_FIELD"`,
   * `"RATE_LIMIT_NEAR"`, `"PARTIAL_DEGRADATION"`).
   */
  code: string;

  /**
   * Human-readable description of the warning.
   */
  message: string;

  /**
   * Optional structured metadata specific to the warning.
   * Keys and values are operation-dependent.
   */
  metadata?: Record<string, unknown>;
}

// ─── Recovery Hint ──────────────────────────────────────────────────────────

/**
 * An actionable suggestion that tells the consumer how to recover from or
 * mitigate a failure (or a degraded success).
 *
 * Recovery hints are advisory — the consumer decides whether and how to act
 * on them. They are particularly useful for transient errors (retry after
 * delay) or validation-adjacent failures (fund the account, reduce the
 * amount, etc.).
 *
 * @example
 * ```ts
 * const hint: RecoveryHint = {
 *   action: 'retry',
 *   message: 'The network timed out. Try again in a few seconds.',
 *   retryable: true,
 *   suggestedDelayMs: 5000,
 * };
 * ```
 */
export interface RecoveryHint {
  /**
   * A well-known action string that programmatic consumers can switch on.
   *
   * Common values:
   * - `"retry"`        — The operation may succeed if retried.
   * - `"fund_account"` — The account needs to be funded first.
   * - `"reduce_amount"` — The requested amount exceeds available balance.
   * - `"check_input"`  — One or more inputs need correction.
   * - `"check_network"` — A network issue occurred; verify connectivity.
   * - `"contact_support"` — The error is unexpected; escalate to support.
   */
  action: string;

  /**
   * Human-readable explanation of what the consumer should do.
   */
  message: string;

  /**
   * Whether the operation is safe to retry automatically.
   * Defaults to `false` when omitted.
   */
  retryable?: boolean;

  /**
   * Suggested delay in milliseconds before retrying.
   * Only meaningful when `retryable` is `true`.
   */
  suggestedDelayMs?: number;

  /**
   * Optional structured metadata specific to the hint.
   * Keys and values are operation-dependent.
   */
  metadata?: Record<string, unknown>;
}
