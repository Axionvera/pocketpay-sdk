# Typed Result Wrapper with Warnings & Recovery Hints

## Summary

This PR adds a **reusable typed result model** that extends the existing `PocketPayResult<T>` pattern with optional `warnings` and `recoveryHints` arrays, giving consumers richer, actionable feedback beyond simple success/failure.

As a pilot, the enhanced result is applied to two SDK operations: `sendXLM` and `getBalance`.

## Motivation

Consumers currently need to handle thrown errors differently across SDK modules, and successful results carry no diagnostic context. This PR addresses issue **#137** by:

1. Defining a reusable `ResultWarning` and `RecoveryHint` type pair
2. Adding `EnhancedSuccessResult<T>`, `EnhancedFailureResult`, and `EnhancedPocketPayResult<T>` discriminated unions
3. Providing helper functions (`toEnhancedSuccessResult`, `toEnhancedFailureResult`, `toEnhancedResult`) for constructing enriched results
4. Piloting the pattern on two high-value operations

## What's New

### New Types (`src/errors/index.ts`)

| Type | Purpose |
|:---|:---|
| `ResultWarning` | Non-fatal diagnostic with `code`, `message`, and optional `metadata` |
| `RecoveryHint` | Actionable suggestion with `action`, `message`, optional `retryable`, `suggestedDelayMs`, and `metadata` |

### Enhanced Result Types (`src/types/index.ts`)

| Type | Description |
|:---|:---|
| `EnhancedSuccessResult<T>` | Success result with optional `warnings` and `recoveryHints` |
| `EnhancedFailureResult` | Failure result with optional `warnings` and `recoveryHints` |
| `EnhancedPocketPayResult<T>` | Discriminated union of the above two |

These are **structurally compatible** with the existing `PocketPayResult<T>` — code that checks `result.ok` works unchanged.

### Helper Functions (`src/utils/index.ts`)

- `toEnhancedSuccessResult(value, warnings?, recoveryHints?)` — construct an enriched success
- `toEnhancedFailureResult(error, warnings?, recoveryHints?)` — construct an enriched failure
- `toEnhancedResult(fn, options?)` — wrap an async function into an enhanced result

### Pilot: `enhancedSendXLM` / `safeEnhancedSendXLM` (`src/payments/index.ts`)

| Signal | Condition |
|:---|:---|
| **Warning:** `HIGH_FEE_RATIO` | Transaction fee > 10% of payment amount |
| **Hint:** `fund_account` | Source account not found (404) |
| **Hint:** `check_input` | Payment failed (validation) |
| **Hint:** `retry` | Network timeout or general send error |
| **Hint:** `check_input` | Any validation error (invalid key, amount, etc.) |

### Pilot: `enhancedGetBalance` / `safeEnhancedGetBalance` (`src/wallet/index.ts`)

| Signal | Condition |
|:---|:---|
| **Warning:** `ZERO_NATIVE_BALANCE` | Account has 0 XLM |
| **Warning:** `MANY_ASSETS` | Account holds > 20 assets |
| **Hint:** `fund_account` | Account not found (404) |
| **Hint:** `check_network` | Horizon server unreachable |
| **Hint:** `check_input` | Any validation error |

## Files Changed

| File | Change |
|:---|:---|
| `src/errors/index.ts` | **New** — `ResultWarning` and `RecoveryHint` types |
| `src/types/index.ts` | Added `EnhancedSuccessResult`, `EnhancedFailureResult`, `EnhancedPocketPayResult` |
| `src/utils/index.ts` | Added `toEnhancedSuccessResult`, `toEnhancedFailureResult`, `toEnhancedResult` |
| `src/payments/index.ts` | Added `enhancedSendXLM` and `safeEnhancedSendXLM` |
| `src/wallet/index.ts` | Added `enhancedGetBalance` and `safeEnhancedGetBalance` |
| `src/index.ts` | Re-exports all new types and functions |
| `tests/enhanced-result.test.ts` | **New** — 38 tests covering all enhanced result shapes and pilots |
| `docs/error-handling.md` | Added "Enhanced Result Wrapper" section with usage examples |

## Backward Compatibility

- **No existing APIs are changed.** All existing types, functions, and `safe*` wrappers remain exactly as before.
- `EnhancedPocketPayResult<T>` is a structural superset of `PocketPayResult<T>` — existing `result.ok` narrowing works unchanged.
- The new types and functions are purely additive.

## Acceptance Criteria

- [x] A reusable typed result model is added (`EnhancedSuccessResult<T>`, `EnhancedFailureResult`, `EnhancedPocketPayResult<T>`)
- [x] The model supports success and failure states
- [x] The model includes optional warnings (`ResultWarning`) and recovery hints (`RecoveryHint`)
- [x] At least one SDK operation uses the model (`enhancedSendXLM`, `enhancedGetBalance`)
- [x] Tests cover both success and failure result shapes (38 new tests, all passing)

## Verification

```bash
npm run lint          # TypeScript type check — passes
npm run check:circular # Circular dependency check — passes
npm run test          # Full test suite — 354/354 passing (1 integration skipped)
```

Closes #137
