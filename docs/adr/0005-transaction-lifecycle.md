# ADR 0005: Transaction Lifecycle Architecture

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** PocketPay SDK maintainers
- **Issue:** [#156 - Add SDK transaction lifecycle architecture decision record](https://github.com/Axionvera/pocketpay-sdk/issues/156)
- **Type:** Architecture / Security / Transactions

## Context

PocketPay exposes two styles of transaction API:

1. one-shot helpers such as `sendXLM`, `sendAsset`, `depositToVault`, and
   `withdrawFromVault`, which combine several lifecycle stages; and
2. a staged classic-transaction pipeline in `src/transactions/` that can
   prepare, inspect, sign, and submit an envelope separately.

Both styles eventually cross the same irreversible boundary: once a signed
envelope may have reached Horizon or Soroban RPC, a timeout no longer proves
that the transaction failed. Rebuilding or resubmitting without reconciling
that outcome can duplicate a payment. Sequence snapshots, signer authority,
polling limits, and secret handling create additional boundaries that future
transaction helpers must preserve.

This ADR defines those boundaries. It records the target architecture that
new transaction work must follow and identifies where the current convenience
APIs intentionally collapse stages.

## Decision

Every write operation is modeled as five stages:

1. prepare intent;
2. bind network state and build;
3. authorize and sign;
4. submit;
5. confirm or reconcile.

A helper may combine adjacent stages for convenience, but it must preserve
the inputs, outputs, error meaning, and retry rule of each stage.

### Stage contracts

| Stage | Input | Output | Network | Secret material | Safe recovery |
| --- | --- | --- | --- | --- | --- |
| Prepare intent | Public keys, operations, amounts, memo, configuration | Validated intent | None for local validation | None required | Fix input and run again |
| Bind and build | Validated intent plus a fresh sequence, fee, network passphrase, and time bounds | Unsigned deterministic envelope | Read-only account/fee lookup may occur | None | Refresh stale state and rebuild |
| Authorize and sign | Inspectable unsigned envelope plus an authorized signer | Immutable signed envelope and transaction hash | Signer-dependent | Confined to signer boundary | Re-request authorization; never substitute a signer |
| Submit | Signed envelope | Definitive response or status-unknown result | Horizon or Soroban RPC write | None | Retry only when classification says the same envelope is safe |
| Confirm/reconcile | Transaction hash, time bounds, and submission context | Terminal success, terminal rejection, expiry, or still unknown | Read-only status lookup | None | Poll within policy; unresolved is not failure |

The transaction hash is the identity of a signed envelope. Rebuilding with a
new sequence, time bound, fee, or operation creates a different envelope and
a different hash, even when the business intent appears unchanged.

### 1. Prepare intent

Local validation runs before any network call or signing action. It covers
key format, amount precision, memo limits, self-payment, asset shape, and
contract configuration as applicable. Invalid input is represented by a
`PocketPayError` with a stable code and structured validation details.

Preparation must not require a secret key. `prepareTransactionOffline`
demonstrates the preferred advanced-flow boundary: it accepts a source public
key and operations, and returns a `PreparedTransaction` that cannot yet be
submitted.

Issued-asset trustline checks and Soroban simulation are pre-submission network
checks, not proof that a later submission will succeed. State can change
between checking and ledger inclusion.

### 2. Bind network state and build

A Stellar transaction is not buildable until it is bound to network-specific
state:

- source account sequence;
- network passphrase;
- base or simulated resource fee;
- explicit time bounds; and
- Soroban footprint and authorization data when applicable.

`fetchNetworkState` and `updateWithNetworkState` make the sequence dependency
explicit in the staged pipeline. `buildUnsignedTransaction` can reject a
stale fetched snapshot when `enforceSequenceFreshness` is enabled.

For concurrent classic submissions from one account, callers should keep
sequence acquisition, build, and submit inside one `SequenceProvider`
critical section. That lock is process-local. Coordination across browser
tabs, workers, processes, devices, or services remains an application
responsibility.

A `tx_bad_seq` result is rebuild-required, not retryable: refresh account
state, rebuild, inspect, and sign a new envelope.

### 3. Authorize and sign

The unsigned envelope is the authorization boundary. Before signing, a
consumer must be able to inspect the source, destination, asset, amount, memo,
fee, network, operations, and time bounds. `mapAuthRequirements` and
`inspectSignedTransaction` are package-root inspection exports.
`getTransactionSigningSummary` also supports this review inside the
`src/transactions/` barrel, but is not currently re-exported from the package
root; that discoverability gap is future work.

The SDK enforces these signing rules:

- the signer public key must match the transaction source;
- read-only accounts fail before any signer is invoked;
- local secrets are not persisted by the SDK and must not appear in logs,
  errors, diagnostics, or serialized signer objects; and
- external signers may reject, delay, or require user presence, and their
  errors propagate to the caller.

Signing freezes the envelope. Code after this boundary must not silently
change operations, network, fee, sequence, or time bounds. Any such change
requires a new inspection and authorization cycle.

### 4. Submit

Submission starts when the signed envelope is handed to a network client.
From that point, failures have three materially different meanings:

| Outcome | Example | Same envelope | New envelope |
| --- | --- | --- | --- |
| Definitive success | Horizon returns a ledger record | Do not resubmit | Not needed |
| Definitive rejection | `tx_bad_seq`, insufficient balance, failed Soroban result | Do not resubmit | Rebuild only after fixing the cause |
| Retryable pre-acceptance failure | Explicit rate limit or classified transient refusal | May retry with backoff | Do not rebuild merely to retry |
| Unknown status | Submission timeout, connection reset, lost response | Do not blindly resubmit | Do not rebuild until reconciled or expired |

The central safety rule is:

> Once submission may have reached the network, an ambiguous result must be
> reconciled by transaction hash before any resubmission or rebuild.

`withTimeout` classifies submission and confirmation timeouts as
`TX_STATUS_UNKNOWN`, not as a generic retryable timeout.
`submitTransactionIdempotently` submits a classic transaction and switches to
`pollTransactionStatus` when the outcome is unknown. `withRetryPolicy` adds
bounded backoff for outcomes that are explicitly safe to retry.

The name "idempotent" applies to replaying the same signed Stellar envelope:
validators identify it by the same hash. It does not provide business-level
idempotency across rebuilt envelopes. Consumers that represent invoices,
orders, or withdrawals must persist their own intent identifier and reconcile
it with transaction hashes.

### 5. Confirm or reconcile

Confirmation is read-only and keyed by transaction hash. A polling attempt
that returns `404` or `NOT_FOUND` means "not observed yet", not "failed".

For classic Horizon transactions, `pollTransactionStatus` stops when one of
the following occurs:

- the transaction record is found;
- its `maxTime` has passed, producing `TX_EXPIRED`; or
- the configured poll-attempt budget is exhausted, preserving
  `TX_STATUS_UNKNOWN`.

Expiry proves that the old envelope can no longer be newly included. It does
not prove that the envelope was not included shortly before expiry, so a final
hash lookup is still required before rebuilding the business intent. An
exhausted local polling budget proves neither condition.

The current Soroban vault helpers poll once per second while RPC returns
`NOT_FOUND`. Each request has a timeout, but the loop has no total attempt or
elapsed-time budget and no cancellation signal. The transaction's 30-second
time bound limits validator acceptance; it does not itself stop the local
loop. This is a known limitation and must not be copied into new APIs.

## Current API mapping

### One-shot classic payments

`sendXLM` and `sendAsset` validate, load the source account, build, sign with a
raw source secret, and submit in one call. They are appropriate for simple
interactive payments, but they do not expose an unsigned inspection boundary
or accept `AccountAbstraction`.

Their successful Horizon response includes the transaction hash and ledger.
A submission timeout surfaces as `TX_STATUS_UNKNOWN`, but the rejected
one-shot call does not return its built envelope or transaction hash. The
consumer therefore cannot safely recover by simply invoking the helper again.
Applications that require durable reconciliation or controlled retries must
choose the staged pipeline before signing and retain the envelope/hash for
`submitTransactionIdempotently` or `withRetryPolicy`.

### Staged classic transactions

The advanced path is:

```text
prepareTransactionOffline
  -> fetchNetworkState / updateWithNetworkState
  -> buildUnsignedTransaction
  -> inspect and map authorization requirements
  -> signTransaction / signTransactionWithSigner / signWithAccount
  -> submit or reconcile with the network helpers
```

`submitSignedTransaction` is a convenience adapter returning
`SubmissionResult`. Its current catch-all `SUBMISSION_ERROR` result does not
retain the full unknown-status classification. Advanced callers that require
the no-blind-resubmission guarantee should submit
`signed.transaction` through `submitTransactionIdempotently` or
`withRetryPolicy`. A future revision should unify these result contracts.

### Soroban vault operations

`depositToVault` and `withdrawFromVault` validate, fetch account state, build,
simulate, assemble resource data, sign, submit, and poll. Simulation failure
prevents submission. `getVaultBalance` is read-only and stops after
simulation.

Soroban simulation output belongs to the envelope being assembled and may
become stale. Retrying after simulation or submission failure may require a
fresh simulation and authorization pass; classic-transaction retry rules
must not be applied mechanically to Soroban.

## Error ownership

Errors are interpreted at the stage where they occur:

- validation errors require corrected intent;
- account lookup and pre-submission network errors may be retried without
  duplicate-payment risk;
- signer missing/mismatch/rejection errors require authorization action;
- `TX_BAD_SEQUENCE` requires fresh state and a rebuilt envelope;
- definitive transaction failures require fixing their on-chain cause;
- `TX_STATUS_UNKNOWN` requires reconciliation, never a blind retry; and
- `TX_EXPIRED` permits a new build only after the old hash has been checked
  and remains absent.

Consumers branch on `PocketPayError.code`, not message text. Non-throwing
`safe*` wrappers change error transport, not lifecycle meaning.

## Consumer responsibilities

The consuming application owns:

- secure key storage, backup, recovery, and user-presence policy;
- presenting the complete signing intent and obtaining approval;
- business-level idempotency and durable intent-to-hash records;
- cross-process sequence coordination;
- choosing retry, polling, cancellation, and user-visible timeout budgets;
- persisting unresolved hashes and reconciling them after restart;
- selecting Testnet or Mainnet deliberately and showing that choice; and
- monitoring finality appropriate to its risk model instead of treating a
  local timeout as an on-chain result.

PocketPay defaults to Testnet and never stores keys or an application
transaction journal on the consumer's behalf.

## Alternatives considered

### Keep one-shot helpers as the only model

Rejected. They are convenient but cannot represent offline signing, external
signers, multisig review, durable reconciliation, or explicit cancellation.

### Make every helper expose every stage

Rejected. It would make simple payments unnecessarily difficult and break the
existing API. The staged pipeline remains additive while one-shot helpers
preserve ergonomics.

### Automatically rebuild after any failure

Rejected. A timeout after submission can hide a successful payment; rebuilding
would create a different hash and can pay twice.

### Treat a finite polling budget as failure

Rejected. A client stopping its observations does not change ledger state.
Unresolved status remains explicit so the caller can resume reconciliation.

## Consequences and trade-offs

### Positive

- New transaction helpers share a reviewable lifecycle and error vocabulary.
- Secret-bearing signing is isolated from public-data preparation and
  confirmation.
- The no-blind-resubmission rule prevents a common duplicate-payment failure.
- One-shot and advanced APIs can coexist without pretending they offer the
  same control.

### Negative

- Consumers using the staged path must persist more state and make explicit
  retry and confirmation decisions.
- Multiple overlapping submission helpers remain until their result contracts
  are unified.
- Process-local sequence locking does not solve distributed coordination.
- Classic and Soroban confirmation semantics still require separate adapters.

### Neutral

- This ADR changes documentation, not runtime behavior.
- Existing one-shot helper signatures and Testnet defaults remain unchanged.

## Future extension points

Future advanced transaction work should prefer additive APIs for:

- an inspected/authorized transaction state machine with typed stage outputs;
- `AccountAbstraction` support in one-shot payment and vault helpers;
- a common submission result preserving transaction hash and outcome class;
- bounded polling with elapsed-time limits, `AbortSignal`, and resume tokens;
- durable idempotency journals supplied by consumers;
- fee-bump, multisig, and hardware/mobile signer orchestration; and
- a shared confirmation interface with backend-specific Horizon and Soroban
  adapters.

Changes that weaken a stage boundary or alter retry meaning require a
superseding ADR.

## References

- [ADR 0001 - SDK API Design Principles](./0001-api-design-principles.md)
- [ADR 0002 - Account Abstraction Layer](./0002-account-abstraction.md)
- [ADR 0004 - Signer Capability Architecture](./0004-signer-capability-architecture.md)
- [Architecture Overview](../architecture.md)
- [Offline Transaction Preparation](../offline-transaction-preparation.md)
- [Signing Boundaries](../signing-boundaries.md)
- [Safe Retry Policy](../retry-policy.md)
- [Idempotency Strategy](../idempotency.md)
- [Sequence and Concurrent Submission Safety](../concurrent_submission_safety.md)
- [Timeout Classification](../timeout-classification.md)
- [Security Best Practices](../security.md)
- [Soroban Vault](../soroban-vault.md)
