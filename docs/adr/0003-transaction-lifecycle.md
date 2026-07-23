# ADR 0003: Transaction Lifecycle Architecture

- **Status:** Accepted
- **Date:** 2026-07-22
- **Deciders:** PocketPay SDK maintainers
- **Type:** Documentation / Architecture

## Context

The PocketPay SDK submits transactions to two distinct Stellar backends:
Horizon (classic payments) and Soroban RPC (smart-contract vault
operations). Each backend has different preparation, submission, and
confirmation semantics. Without a single reference document, these
differences risk being understood only by whoever last touched the code,
making review and onboarding harder.

This ADR records the current transaction lifecycle for both paths, the
retry and polling assumptions baked into each, and the security boundaries
between the SDK and the consuming application. It is purely descriptive;
it proposes no new behavior.

## Decision

### Lifecycle stages

Every write operation in the SDK follows the same five-stage pipeline.
The details differ between Horizon and Soroban, but the shape is
consistent.

#### Stage 1 — Preflight validation

All user-supplied inputs are validated synchronously before any network
call is made. This includes public-key format, secret-key format, amount
syntax, memo length, self-payment checks, and contract-ID presence.

Invalid inputs throw `PocketPayError` with a machine-readable code
(e.g. `INVALID_PUBLIC_KEY`, `INVALID_AMOUNT`, `SELF_PAYMENT`) and are
never sent over the wire.

**Files:** `src/utils/index.ts` (validation functions), beginning of each
public function in `src/payments/index.ts` and `src/soroban/index.ts`.

#### Stage 2 — Configuration resolution and server construction

`resolveConfig(overrides?)` merges explicit overrides, environment
variables, and built-in defaults (Testnet endpoints, 30 000 ms timeout)
into a fully validated `SDKConfig`. A Horizon `Server` or
`SorobanRpc.Server` is then constructed from the resolved URL.

**Files:** `src/config/index.ts`.

#### Stage 3 — Account state fetch

The source account's current sequence number and state are loaded from
the network. This is a read-only call that anchors the transaction to a
specific ledger snapshot.

- **Horizon path:** `server.loadAccount(publicKey)` returns a
  `StellarSDK.Account` usable with `TransactionBuilder`.
- **Soroban path:** `sorobanServer.getAccount(publicKey)` returns a
  Soroban-aware account object.

Both calls are wrapped in `withTimeout()` using the resolved timeout.

#### Stage 4 — Transaction construction, signing, and (for Soroban) simulation

**Horizon payments (`sendXLM`):**

1. A `TransactionBuilder` is created with `BASE_FEE` and the network
   passphrase.
2. A `payment` operation (native XLM) is added; an optional memo is
   attached.
3. `setTimeout(30)` is set on the builder so the transaction expires if
   not included within 30 seconds of ledger close.
4. The transaction is built and signed with the source `Keypair`.

**Soroban vault operations (`depositToVault`, `withdrawFromVault`,
`getVaultBalance`):**

1. A `TransactionBuilder` is created with `BASE_FEE` and the network
   passphrase.
2. A `contract.call(...)` operation is added with the appropriate
   Soroban-scVal arguments (public key as `address`, amount as `i128`).
3. `setTimeout(30)` is set.
4. The transaction is built (but **not** signed yet).
5. The transaction is **simulated** via
   `sorobanServer.simulateTransaction(tx)`.
6. If simulation returns an error, a `VaultResult` with `success: false`
   is returned immediately — no submission occurs.
7. If simulation succeeds, `rpc.assembleTransaction(tx, simulated).build()`
   produces a prepared transaction with the correct resource fees and
   Soroban footprint baked in.
8. The prepared transaction is signed with the source `Keypair`.

The simulate-then-assemble pattern is required by Soroban: the runtime
must evaluate the contract to determine CPU/memory resource consumption
before the transaction can be priced and submitted.

#### Stage 5 — Submission and confirmation

**Horizon payments (`sendXLM`):**

`server.submitTransaction(transaction)` sends the signed transaction
to Horizon. On success the response is mapped to a `PaymentResult` with
`hash`, `ledger`, `fee`, and `createdAt`.

On failure, the error is classified:

| Horizon condition | SDK error code | Behavior |
|---|---|---|
| HTTP 404 | `ACCOUNT_NOT_FOUND` | Thrown immediately |
| `result_codes.transaction` present | `PAYMENT_FAILED` | Thrown with result code |
| Other / network error | `SEND_ERROR` | Wrapped via `wrapError` |

**Idempotent submission (`submitTransactionIdempotently`):**

The SDK also exports an idempotent submission helper for callers who
need stronger delivery guarantees. It wraps `server.submitTransaction`
and, when the initial attempt returns a status-unknown error (timeout or
network failure), enters a polling loop:

1. The transaction hash is extracted from the signed transaction.
2. `pollTransactionStatus` queries Horizon for the transaction record.
3. Polling continues at 2-second intervals for up to 10 attempts (or
   until the transaction's `timeBounds.maxTime` is exceeded, whichever
   comes first).
4. If the transaction is found, the record is returned (confirming it
   was eventually included).
5. If the transaction expires on-chain, `TX_EXPIRED` is thrown.
6. If polling exhausts all attempts without resolution,
   `TX_STATUS_UNKNOWN` (HTTP 504) is thrown.

**Soroban vault operations:**

`sorobanServer.sendTransaction(prepared)` submits the prepared
transaction. If the send itself returns `status: 'ERROR'`, a
`VaultResult` with `success: false` is returned immediately.

Otherwise, the SDK enters a polling loop:

1. `sorobanServer.getTransaction(hash)` is called.
2. While the status is `NOT_FOUND`, the SDK waits 1 second and retries.
3. Once the status is no longer `NOT_FOUND`, the loop exits.
4. `SUCCESS` returns `{ success: true, hash }`.
5. Any other final status returns `{ success: false, error }`.

There is no maximum poll count on the Soroban path — the loop continues
until the transaction reaches a terminal state. The 30-second
`setTimeout` on the transaction itself provides the ultimate bound: if
the transaction is not included within that window, the Stellar network
rejects it.

### Timeout strategy

Every network call in the SDK is wrapped in `withTimeout(operation, timeoutMs, promise)`.

- Default timeout: 30 000 ms (configurable via `SDKConfig.timeout` or
  `STELLAR_TIMEOUT` env var).
- On timeout, the promise rejects with `PocketPayError` code
  `REQUEST_TIMEOUT`.
- The timeout is enforced via `Promise.race` against a timer; the timer
  is cleaned up in a `finally` block regardless of which side wins.
- For `fetch`-based calls (e.g. Friendbot), `fetchWithTimeout` uses
  `AbortController` when available, falling back to the same `Promise.race`
  strategy on older runtimes.

Timeouts are per-request, not cumulative. A Soroban vault deposit that
requires simulation + submission + polling may incur multiple independent
timeouts across those steps.

### Error model

All errors bubble up as `PocketPayError` instances with a stable
machine-readable `code` field. Consumers branch on `code`, never on
message text.

- **Throwing functions** (`sendXLM`, `depositToVault`, etc.) throw
  `PocketPayError` on failure.
- **Safe wrappers** (`safeSendXLM`, etc.) return a `PocketPayResult<T>`
  discriminated union — `ok: true` with a value, or `ok: false` with an
  error. They never reject.
- **Enhanced wrappers** (`enhancedSendXLM`, etc.) return an
  `EnhancedPocketPayResult<T>` that carries the same value/error plus
  optional `ResultWarning[]` and `RecoveryHint[]`. Hints include an
  `action` string (`"retry"`, `"fund_account"`, `"check_input"`, etc.),
  a human-readable `message`, and `retryable` / `suggestedDelayMs` fields.

The `wrapError` utility normalizes non-`PocketPayError` throwables into
a `PocketPayError` with the original error as `cause`.

### Security boundaries

The SDK enforces the following invariants:

1. **No key persistence.** The SDK never writes, caches, or logs secret
   keys. `createWallet` generates a keypair in memory and returns it; the
   consumer is responsible for persisting it to secure storage.

2. **Preflight-only validation.** All input validation happens before any
   network call. Malformed keys, amounts, or addresses never reach
   Horizon or Soroban RPC.

3. **No secret leakage in errors.** Validation errors for secret keys
   use generic messages (`"Invalid Stellar secret key"`) without
   including the key value. The `redactSecretKey` and `redactSensitive`
   utilities are available for consumers who need to log key-adjacent
   data.

4. **Configuration validated eagerly.** `resolveConfig` validates every
   field (network, URLs, timeout, contract ID) before returning. Invalid
   configuration fails fast with a descriptive `PocketPayError` rather
   than producing a malformed request downstream.

5. **Testnet default.** The SDK defaults to Stellar Testnet. Mainnet
   must be selected explicitly, preventing accidental real-asset
   transactions during development.

### Consumer responsibilities

The SDK does not handle the following, and consuming applications must:

- **Key backup and recovery.** Secret keys exist only in the return
  value of `createWallet` or `importWallet`. If lost, the SDK provides
  no recovery mechanism.

- **Retry strategy.** The SDK's idempotency module handles post-submit
  polling, but automatic retry of the initial submission is the
  consumer's responsibility. The `enhanced*` variants provide
  `RecoveryHint` data to guide this.

- **Transaction confirmation UX.** The SDK returns transaction hashes
  and ledger numbers, but does not poll for ledger close or provide
  real-time confirmation callbacks. Consumers that need a "confirmed"
  indicator should use `getTransactions` or the Stellar SDK's
  `transactions().transaction(hash)` endpoint.

- **Fee estimation.** The SDK uses `BASE_FEE` for all transactions.
  Consumers that need dynamic fee management should use the Stellar
  SDK's fee simulation directly.

- **Nonce / sequence number management.** The SDK fetches the source
  account state fresh for each transaction. Concurrent transactions
  from the same account may encounter sequence-number conflicts. The
  consumer is responsible for sequencing or using the Stellar SDK's
  `TransactionBuilder` sequence-number management if concurrency is
  required.

## Consequences

**Positive.** A single reference document makes the transaction lifecycle
accessible to reviewers and new contributors without reading implementation
code. The lifecycle stages, retry semantics, and security boundaries are
now explicit and auditable.

**Negative / trade-offs.** This document reflects current practice; as
the codebase evolves, the ADR must be kept in sync or superseded. The
lifecycle description is necessarily a simplification — edge cases in
Horizon error classification or Soroban simulation are in the code, not
here.

**Neutral.** This ADR does not change any SDK behavior. It is a
documentation-only record.

## References

- [ADR 0001 — SDK API Design Principles](./0001-api-design-principles.md)
- [ADR 0002 — Account Abstraction Layer](./0002-account-abstraction.md)
- [Network Error Handling](../network-errors.md)
- [Error Handling](../error-handling.md)
- [Security Best Practices](../security.md)
- [Soroban Vault](../soroban-vault.md)
