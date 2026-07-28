# Transaction build validation pipeline

A reusable pipeline that validates the inputs a transaction is built from, in a
documented order, before anything is built or signed.

```ts
import { validateTransactionBuild } from 'stellar-pocketpay-sdk';

const result = validateTransactionBuild({ sourceSecret, destination, amount, memo });
if (!result.valid) {
  for (const issue of result.issues) showFieldError(issue.field, issue.message);
  return;
}
```

## Why it exists

The duplication was literal. `sendXLM` hand-chained four validators, and
`sendAsset` repeated the same four with `validateAssetSpec` appended. Both now
call the pipeline instead.

A non-throwing family already existed that the build path never used — but the
helpers could not simply be called in sequence, because they return **four
different shapes**:

| Helper | Returns |
|---|---|
| `safeValidateMemo` | `{ valid } \| { valid, error }` |
| `safeParseAmount` | `{ valid, amount } \| { valid, error }` |
| `safeValidateDestination` | `Promise<PocketPayResult<…>>` |
| `validateSendXLMParams` | `{ ok } \| { ok, errors: ValidationError[] }` |

Normalising those into one result is what the pipeline does.

## Validation order

`VALIDATION_ORDER` is exported so the order is checkable, not just documented.
Local, zero-cost checks run first; anything that reads configuration or an
account runs last, so a malformed key is reported without resolving config at
all.

| # | Stage | Reads | Notes |
|---|---|---|---|
| 1 | `sourceAccount` | — | The only stage that touches the secret |
| 2 | `destination` | — | Includes self-payment, which needs the derived source |
| 3 | `amount` | — | Format, positivity, 7-decimal precision |
| 4 | `asset` | — | Issued-asset spec shape |
| 5 | `memo` | — | Type and byte length |
| 6 | `network` | SDK config | Validates URLs, timeout, contract ID |
| 7 | `signerCapability` | account | See the limitation below |

### Issues accumulate

Stages are **not** short-circuited. Three malformed fields produce three issues,
so a form can show all of them at once instead of one per submit.
`assertTransactionBuildValid` is the throwing variant for call sites that want
the first failure only.

### Running a subset

```ts
validateTransactionBuild(input, { stages: ['sourceAccount', 'amount'] });
```

`sendXLM` and `sendAsset` use this to skip the `network` stage, because they
resolve configuration themselves. Skipping it keeps *when* a configuration error
surfaces exactly where it was before the pipeline existed.

## Error codes are transported, never merged

An issue carries the code the originating validator already produced:

```ts
{ stage: 'amount', code: 'INVALID_AMOUNT', field: 'amount', message: '…' }
```

`ValidationErrorCode` (`src/payments/validation.ts`) and the published error
registry are **separate taxonomies on purpose**. Both appear in the same
`issues` array unchanged; the pipeline does not unify them.

This is also why the amount stage uses `validateAmount` rather than
`safeParseAmount`. The safe parser belongs to the safe-amount model and raises
that model's codes, while the payment surface publishes `INVALID_AMOUNT` and
`INVALID_AMOUNT_PRECISION`. Composing the safe parser would have been a silent
breaking change to published codes.

## Adoption is not a breaking change

`assertTransactionBuildValid` throws the **same error object** the underlying
validator produced. Every published code — `INVALID_SECRET_KEY`,
`SELF_PAYMENT`, `INVALID_AMOUNT`, `INVALID_AMOUNT_PRECISION` and the asset codes
— is unchanged by routing through the pipeline, and tests assert exactly that.

The self-payment *message* differs between flows ("Cannot send XLM to yourself"
vs "Cannot send asset to yourself"). The check is shared; only the sentence is
passed in via `selfPaymentMessage`.

## Limitation: the signer-capability stage

`mapAuthRequirements` takes a **built** transaction, so full threshold analysis
cannot run before a transaction exists. The pipeline's `signerCapability` stage
validates what is knowable pre-build: whether the supplied account declares
signing capability.

Full authorisation mapping — thresholds, signer weights, unsupported operations
— remains a post-build step via `mapAuthRequirements` and
`assertAuthFullyMapped`. The stage is skipped entirely when no `account` is
supplied.

## API

| Export | Purpose |
|---|---|
| `validateTransactionBuild(input, options?)` | Run the pipeline, collect all issues |
| `assertTransactionBuildValid(input, options?)` | Throw the first failure, unchanged |
| `VALIDATION_ORDER` | The documented stage order |
| `ValidationStage`, `TransactionValidationIssue`, `TransactionValidationResult`, `TransactionBuildInput`, `TransactionValidationOptions` | Types |
