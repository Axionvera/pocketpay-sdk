/**
 * unsupported.ts — standard errors for unsupported and capability-gated features.
 * ──────────────────────────────────────────────────────────────────────────────
 * Two error types, both extending {@link PocketPayError} so existing catch
 * blocks keep working:
 *
 *  - {@link UnsupportedFeatureError}  — the operation does not exist in this
 *    build of the SDK (planned or placeholder surface).
 *  - {@link CapabilityMismatchError}  — the operation exists, but a capability
 *    it depends on is not configured or not enabled.
 *
 * Both carry structured diagnostic context (`module`, `operation`,
 * `capability`) plus a `suggestedNextStep` sourced from the published registry
 * so guidance can never drift from `ERROR_CODES`.
 *
 * Design notes:
 *  - No new error codes are introduced. These classes give their first call
 *    sites to codes already frozen as public contract in `codes.ts`.
 *  - This module must not import from `../config`, `../soroban` or `../vault`:
 *    `src/errors/*` sits below them in the dependency graph and importing
 *    upward would create a cycle (`scripts/check-circular-deps.ts`).
 */

import { ErrorCode, ERROR_CODES, type ErrorCodeValue } from './codes';
import { PocketPayError } from '../types';

/**
 * Structured diagnostic context attached to unsupported / capability errors.
 * Values must never contain secrets — they are safe to log.
 */
export interface FeatureContext {
  /** SDK module the call was routed to (e.g. 'vault', 'soroban'). */
  module: string;
  /** Operation the caller attempted (e.g. 'deposit', 'get_balance'). */
  operation: string;
  /** Dot-scoped capability the operation depends on (e.g. 'vault.contract'). */
  capability?: string;
}

/** Options accepted by {@link UnsupportedFeatureError}. */
export interface UnsupportedFeatureOptions extends FeatureContext {
  /** Overrides the generated message. Keep it factual; never promise dates. */
  message?: string;
  /** Underlying error, when this wraps one. */
  cause?: Error;
}

/** Options accepted by {@link CapabilityMismatchError}. */
export interface CapabilityMismatchOptions extends FeatureContext {
  /**
   * Registry code describing the mismatch. Typed to {@link ErrorCodeValue} so
   * callers cannot introduce a code outside the published standard.
   */
  code: ErrorCodeValue;
  /** Overrides the generated message. */
  message?: string;
  /** Underlying error, when this wraps one. */
  cause?: Error;
}

/** Renders the diagnostic suffix shared by both messages. */
function describeContext(context: FeatureContext): string {
  const capability = context.capability ? ` (capability: ${context.capability})` : '';
  return `${context.module}.${context.operation}${capability}`;
}

/**
 * Thrown when an operation is not implemented in this build of the SDK.
 *
 * Uses the published `SDK_NOT_IMPLEMENTED` code, so
 * `isKnownErrorCode(err.code)` is true and `describeError(err.code)` returns
 * real guidance instead of the unknown-code fallback.
 *
 * @example
 * ```ts
 * throw new UnsupportedFeatureError({
 *   module: 'soroban',
 *   operation: 'encodeParams',
 *   capability: 'contract.params',
 * });
 * ```
 */
export class UnsupportedFeatureError extends PocketPayError {
  /** SDK module the call was routed to. */
  public readonly module: string;
  /** Operation the caller attempted. */
  public readonly operation: string;
  /** Capability the operation depends on, when applicable. */
  public readonly capability?: string;
  /** Developer guidance, taken verbatim from the published registry. */
  public readonly suggestedNextStep: string;

  constructor(options: UnsupportedFeatureOptions) {
    const spec = ERROR_CODES[ErrorCode.SDK_NOT_IMPLEMENTED];

    super(
      options.message ?? `Operation not implemented: ${describeContext(options)}.`,
      ErrorCode.SDK_NOT_IMPLEMENTED,
      {
        cause: options.cause,
        category: spec.category,
        safeMessage: spec.safeMessage,
      }
    );

    // PocketPayError's constructor ends with
    // `Object.setPrototypeOf(this, PocketPayError.prototype)`, which overwrites
    // the prototype `new.target` established for this subclass. Without the
    // line below, `err instanceof UnsupportedFeatureError` silently returns
    // false and `err.name` stays 'PocketPayError'.
    Object.setPrototypeOf(this, UnsupportedFeatureError.prototype);
    this.name = 'UnsupportedFeatureError';

    this.module = options.module;
    this.operation = options.operation;
    this.capability = options.capability;
    this.suggestedNextStep = spec.developerHint;
  }

  /**
   * Log-safe structured view. Contains only the diagnostic context and the
   * registry's safe message — never the raw `message`, which may carry detail
   * that has to go through `redactError` first.
   */
  toJSON(): {
    name: string;
    code: string;
    category?: string;
    module: string;
    operation: string;
    capability?: string;
    safeMessage?: string;
    suggestedNextStep: string;
  } {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      module: this.module,
      operation: this.operation,
      capability: this.capability,
      safeMessage: this.safeMessage,
      suggestedNextStep: this.suggestedNextStep,
    };
  }
}

/**
 * Thrown when an operation exists but a capability it depends on is not
 * configured or not enabled — for example vault calls without a contract ID.
 *
 * @example
 * ```ts
 * throw new CapabilityMismatchError({
 *   code: ErrorCode.VAULT_CONTRACT_NOT_CONFIGURED,
 *   module: 'vault',
 *   operation: 'deposit',
 *   capability: 'vault.contract',
 * });
 * ```
 */
export class CapabilityMismatchError extends PocketPayError {
  /** SDK module the call was routed to. */
  public readonly module: string;
  /** Operation the caller attempted. */
  public readonly operation: string;
  /** Capability that is missing or disabled. */
  public readonly capability?: string;
  /** Developer guidance, taken verbatim from the published registry. */
  public readonly suggestedNextStep: string;

  constructor(options: CapabilityMismatchOptions) {
    const spec = ERROR_CODES[options.code];

    super(
      options.message ?? `Capability not available for ${describeContext(options)}.`,
      options.code,
      {
        cause: options.cause,
        category: spec.category,
        safeMessage: spec.safeMessage,
      }
    );

    // See the note in UnsupportedFeatureError: the parent constructor resets
    // the prototype, so the subclass has to restore its own.
    Object.setPrototypeOf(this, CapabilityMismatchError.prototype);
    this.name = 'CapabilityMismatchError';

    this.module = options.module;
    this.operation = options.operation;
    this.capability = options.capability;
    this.suggestedNextStep = spec.developerHint;
  }

  /** Log-safe structured view. See {@link UnsupportedFeatureError.toJSON}. */
  toJSON(): {
    name: string;
    code: string;
    category?: string;
    module: string;
    operation: string;
    capability?: string;
    safeMessage?: string;
    suggestedNextStep: string;
  } {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      module: this.module,
      operation: this.operation,
      capability: this.capability,
      safeMessage: this.safeMessage,
      suggestedNextStep: this.suggestedNextStep,
    };
  }
}

/** Narrowing helper for consumers branching on unsupported operations. */
export function isUnsupportedFeatureError(error: unknown): error is UnsupportedFeatureError {
  return error instanceof UnsupportedFeatureError;
}

/** Narrowing helper for consumers branching on missing capabilities. */
export function isCapabilityMismatchError(error: unknown): error is CapabilityMismatchError {
  return error instanceof CapabilityMismatchError;
}

/** Options accepted by {@link DisabledFeatureError}. */
export interface DisabledFeatureOptions extends FeatureContext {
  /** Feature flag key that is disabled (e.g. 'experimentalVault'). */
  featureFlag: string;
  /** Overrides the generated message. */
  message?: string;
  /** Underlying error, when this wraps one. */
  cause?: Error;
}

/**
 * Thrown when an operation is requested but the required feature flag is disabled.
 *
 * Uses the published `SDK_FEATURE_DISABLED` code, so `isKnownErrorCode(err.code)`
 * is true and `describeError(err.code)` returns real guidance.
 *
 * @example
 * ```ts
 * throw new DisabledFeatureError({
 *   featureFlag: 'experimentalVault',
 *   module: 'vault',
 *   operation: 'executeVaultBatch',
 * });
 * ```
 */
export class DisabledFeatureError extends PocketPayError {
  /** SDK module the call was routed to. */
  public readonly module: string;
  /** Operation the caller attempted. */
  public readonly operation: string;
  /** Feature flag key that is disabled. */
  public readonly featureFlag: string;
  /** Capability the operation depends on, when applicable. */
  public readonly capability?: string;
  /** Developer guidance, taken verbatim from the published registry. */
  public readonly suggestedNextStep: string;

  constructor(options: DisabledFeatureOptions) {
    const spec = ERROR_CODES[ErrorCode.SDK_FEATURE_DISABLED];

    super(
      options.message ?? `Feature '${options.featureFlag}' is disabled for ${describeContext(options)}.`,
      ErrorCode.SDK_FEATURE_DISABLED,
      {
        cause: options.cause,
        category: spec.category,
        safeMessage: spec.safeMessage,
      }
    );

    Object.setPrototypeOf(this, DisabledFeatureError.prototype);
    this.name = 'DisabledFeatureError';

    this.module = options.module;
    this.operation = options.operation;
    this.featureFlag = options.featureFlag;
    this.capability = options.capability;
    this.suggestedNextStep = spec.developerHint;
  }

  /** Log-safe structured view. See {@link UnsupportedFeatureError.toJSON}. */
  toJSON(): {
    name: string;
    code: string;
    category?: string;
    module: string;
    operation: string;
    featureFlag: string;
    capability?: string;
    safeMessage?: string;
    suggestedNextStep: string;
  } {
    return {
      name: this.name,
      code: this.code,
      category: this.category,
      module: this.module,
      operation: this.operation,
      featureFlag: this.featureFlag,
      capability: this.capability,
      safeMessage: this.safeMessage,
      suggestedNextStep: this.suggestedNextStep,
    };
  }
}

/** Narrowing helper for consumers branching on disabled features. */
export function isDisabledFeatureError(error: unknown): error is DisabledFeatureError {
  return error instanceof DisabledFeatureError;
}
