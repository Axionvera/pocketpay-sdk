# ADR 0001: SDK API Design Principles

- **Status:** Accepted
- **Date:** 2026-07-21
- **Deciders:** PocketPay SDK maintainers
- **Type:** Documentation / Architecture

## Context

The PocketPay SDK is a TypeScript helper package for Stellar wallet
management, XLM payments, transaction history, and Soroban savings-vault
operations. As the surface area grows and more contributors add helpers, the
public API risks drifting into inconsistent shapes: some functions throwing,
others returning results; mixed naming; ad hoc configuration handling. That
inconsistency is a poor developer experience and makes every new PR a fresh
debate.

This record captures the API design principles the SDK already follows, so
future contributions and reviews have a shared reference rather than
re-deciding these questions case by case. It documents current practice; it
does not propose new patterns.

## Decision

The SDK commits to the following five principles.

### 1. Naming

Public functions use `camelCase` verbs describing the action, grouped by
domain module (`wallet`, `payments`, `transactions`, `soroban`, `config`,
`utils`). The SDK exposes a single package entry point; consumers import from
the root rather than reaching into submodules.

A consistent prefix convention communicates a function's error behavior from
its name alone:

- `doThing(...)` — the base operation. May throw `PocketPayError` on failure.
- `safeDoThing(...)` — the non-throwing variant. Returns a `PocketPayResult`
  instead of throwing, so callers handle failure through the return value.
- `enhancedDoThing(...)` — returns an enriched result that may also carry
  non-fatal warnings and recovery hints.
- `safeEnhancedDoThing(...)` — the non-throwing, enriched combination.

For example, the wallet module ships `getBalance`, `safeGetBalance`,
`enhancedGetBalance`, and `safeEnhancedGetBalance`. A reader who learns the
convention once can predict the behavior and signature of every helper.

Types use `PascalCase` and are named for what they carry (`AccountBalance`,
`PaymentResult`, `VaultDepositParams`). Parameter object types end in
`Params`; result types end in `Result`.

### 2. Error handling

Errors are represented by a single `PocketPayError` class, constructed as
`new PocketPayError(message, code, details?, cause?)`:

- `message` — human-readable description.
- `code` — a stable, machine-readable string (for example `INVALID_PUBLIC_KEY`,
  `INVALID_NETWORK`, `BALANCE_ERROR`). Consumers branch on `code`, never on
  message text.
- `details` — optional structured metadata (for example a `validation` object
  naming the offending field, reason, and value).
- `cause` — the original underlying error when one is being wrapped.

The SDK offers two ways to consume failures, and callers choose per call site:

- **Throwing** — base functions throw `PocketPayError`. Natural inside
  `try/catch` and when failure is exceptional.
- **Result-returning** — `safe*` functions return a discriminated union so
  failure is part of the normal control flow:

```ts
  type SuccessResult<T> = { ok: true; value: T };
  type FailureResult = { ok: false; error: PocketPayError };
  type PocketPayResult<T> = SuccessResult<T> | FailureResult;
```

  Callers narrow on the `ok` discriminant. This is powered by an internal
  `toResult` wrapper that runs the throwing function, returns
  `{ ok: true, value }` on success, and wraps any thrown value into a
  `PocketPayError` and returns `{ ok: false, error }` on failure. Non-Error
  throwables are normalized through `wrapError`, so a `FailureResult` always
  carries a real `PocketPayError`.

### 3. Configuration

Configuration is centralized in `SDKConfig` and resolved through a single
`resolveConfig(overrides?: Partial<SDKConfig>)` path. The design follows a
clear precedence:

1. Explicit programmatic overrides passed to a function (`Partial<SDKConfig>`).
2. Environment variables (for example `VAULT_CONTRACT_ID`).
3. Built-in defaults (Stellar Testnet endpoints, a default request timeout).

Every function that talks to the network accepts an optional
`config?: Partial<SDKConfig>` argument, so a caller can override just the
network or a single endpoint without restating the whole configuration.
Invalid configuration fails fast: `validateNetwork` and the URL/timeout
validators throw `PocketPayError` with a specific `code` rather than allowing
a malformed value to reach the network layer.

Defaults favor the safe, common case: the SDK targets Testnet unless a caller
explicitly selects `mainnet`.

### 4. Async operations

All network-touching operations are asynchronous and return promises. Base
functions return `Promise<T>` (and may reject with `PocketPayError`); their
`safe*` counterparts return `Promise<PocketPayResult<T>>` and never reject for
operational failures. Pure, synchronous helpers (validation, formatting,
filtering, sorting, explorer-link building) stay synchronous and are not
wrapped in promises.

Enriched variants return an enhanced result that can carry, alongside the
value or error, a set of non-fatal `ResultWarning`s and actionable
`RecoveryHint`s. A `RecoveryHint` includes a well-known `action` string
(`"retry"`, `"fund_account"`, `"reduce_amount"`, `"check_input"`,
`"check_network"`, `"contact_support"`), a human-readable `message`, and
optional `retryable` / `suggestedDelayMs` fields so programmatic consumers can
decide whether and when to retry.

### 5. Backwards compatibility

The project follows Semantic Versioning. While the package is pre-1.0
(currently `[Unreleased]`), the public API may still change, but changes are
recorded in `CHANGELOG.md` following the Keep a Changelog format.

The public contract is the set of exports from the package root entry point.
Adding new helpers or new optional fields is a backwards-compatible change.
Changing an existing function's signature, renaming an export, or altering the
shape of a returned type is a breaking change and must be called out in the
changelog. New behavior is preferably introduced additively (a new `enhanced*`
variant, a new optional `config` field) rather than by mutating existing
signatures.

Supported baselines are defined in the support policy: Node.js 18+ (CI targets
Node 22), TypeScript 5+, `@stellar/stellar-sdk` 13.x, compiled to ES2020 with
shipped declaration files.

## Consequences

**Positive.** Contributors have a single reference for how a new helper should
look, which shortens reviews and keeps the surface predictable. Consumers can
infer a function's error behavior from its name and branch on stable error
codes. The dual throwing/result model lets each caller pick the style that
fits their code.

**Negative / trade-offs.** The `x` / `safe*` / `enhanced*` / `safeEnhanced*`
family multiplies the number of exported functions per operation, which is
more surface to maintain and document. Maintaining both a throwing and a
result-returning path for each operation is deliberate duplication in service
of caller ergonomics.

**Neutral.** These principles describe current practice. If a future change
needs to depart from them, that departure should be recorded in a superseding
ADR rather than applied silently.
