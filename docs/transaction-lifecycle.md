# Transaction lifecycle

This document describes the orchestration layer that implements
[ADR 0005 — Transaction Lifecycle Architecture](./adr/0005-transaction-lifecycle.md)
and, in particular, the duplicate-submission guard every write now goes through.

## The problem it solves

The SDK already shipped a duplicate-submission guard,
`submitTransactionIdempotently`, which submits an envelope and — on a timeout or
network drop — **polls Horizon instead of letting the caller resubmit**.

It had exactly one call site: `src/network/retry-policy.ts`.

Meanwhile three paths submitted straight to Horizon:

| Path | Where |
|---|---|
| `sendXLM` | `src/payments/index.ts` |
| `sendAsset` | `src/payments/index.ts` |
| `submitSignedTransaction` | `src/transactions/offline-preparation.ts` |

Each wrapped `server.submitTransaction` in a timeout, so a slow network surfaced
as a **failed payment** even when the signed envelope had already reached
Horizon. Rebuilding or resubmitting after that can pay twice. All three now
route through the guard.

## The five stages

Per ADR 0005, every write is modeled as five stages. A helper may combine
adjacent stages, but it must preserve each stage's inputs, outputs, error
meaning and retry rule.

| Stage | `LifecycleStage` | Network | Safe recovery |
|---|---|---|---|
| Prepare intent | `intent` | none | fix input and run again |
| Bind network state and build | `build` | read-only | refresh stale state, rebuild |
| Authorize and sign | `sign` | signer-dependent | re-request authorization |
| Submit | `submit` | **write** | retry only when classification says the same envelope is safe |
| Confirm or reconcile | `confirm` | read-only | poll within policy |

## Two axes, deliberately separate

`LifecycleState` says **where** an operation got to. `TransactionStatus` says
**how** it ended. They are not the same question, and collapsing them is what
produced the two incomplete vocabularies this layer reconciles:
`SubmissionOutcome` has no `pending`, `SorobanInvocationStatus` has no
`unknown`.

| `LifecycleState` | Meaning | `TransactionStatus` | `actionRequired` |
|---|---|---|---|
| `confirmed` | included in a ledger | `COMPLETED` | `none` |
| `submitted` | transient failure; same envelope may be resubmitted | `PENDING` | `retry` |
| `rejected` | definitive on-chain rejection | `FAILED` | `rebuild` |
| `unresolved` | status unknown | `UNKNOWN` | `poll` |

### `unresolved` is not a failure

This is the rule the whole layer exists to protect. A submission timeout does
not prove the transaction failed — it proves only that no answer arrived. The
envelope may be on-chain already.

A consumer that receives `state: 'unresolved'` must **poll**, never rebuild or
resubmit. `requiresStatusResolution(result)` returns `true` for exactly that
case.

## Consumer responsibilities

1. **Never resubmit on `unresolved`.** Poll by transaction hash. The hash is the
   identity of a signed envelope; rebuilding with a new sequence, fee or time
   bound produces a *different* envelope and a different hash, even when the
   business intent is unchanged.
2. **Treat `submitted` / `PENDING` as unresolved too.** A retryable failure means
   the network refused to accept the envelope, not that the payment is dead.
3. **Do not persist a lifecycle result as proof of settlement.** It is a snapshot
   of what was known at that moment.
4. **Keep the SDK error object if you need detail.** A `LifecycleResult` carries
   only `{ code, safeMessage }` — never the raw error, XDR or envelope, which
   `DIAGNOSTICS_SENSITIVE_KEYS` classifies as always-redacted.

## Timeout budget

`submitTransactionIdempotently` submits without a timeout of its own: it reacts
to an error and, on `TX_STATUS_UNKNOWN`, polls. Wrapping it in a bare
`cfg.timeout` would abort exactly the polling that makes it safe, so the guarded
paths use a deadline of

```
cfg.timeout + (maxPollAttempts × pollIntervalMs)
```

with the defaults of `IdempotencyOptions` (10 × 2000 ms). Callers that need a
tighter or looser budget pass `GuardedSubmitOptions`.

## API

| Export | Purpose |
|---|---|
| `submitGuarded(transaction, options?, config?)` | Stages 4–5: submit through the guard and reconcile |
| `reconcileSubmission(error, transactionHash)` | Stage 5 alone, for helpers that submitted themselves |
| `requiresStatusResolution(result)` | `true` when the caller must poll rather than rebuild |
| `LifecycleStage`, `LifecycleState`, `LifecycleResult`, `LifecycleFailure` | Types |
| `GuardedSubmitOptions` | Polling budget for the unknown-status path |

## Behaviour change

Payment helpers previously reported a submission timeout as a failure. They now
poll and report `unresolved` when the status genuinely cannot be settled. See
the Migration section of the pull request for issue #305.
