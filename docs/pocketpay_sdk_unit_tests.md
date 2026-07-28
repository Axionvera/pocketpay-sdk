# PocketPay SDK Unit Test Coverage

Unit tests live in `tests/` and mirror the `src/` module layout.

For the full module-level expectations (unit, fixtures, error paths, and
integration), see the [SDK Module Test Matrix](./module-test-matrix.md).

## Payment helpers

Payment error-path coverage (issue #373) lives in:

- `tests/payments-error-paths.test.ts` — typed `PocketPayError` assertions for
  `sendXLM` and `sendAsset` validation, trustline, network, and submission failures
- `tests/payments.test.ts` — preflight validation and happy-path submission shape
- `tests/payments-validation.test.ts` — non-throwing `validateSendXLMParams`
- `tests/trustline.test.ts` — asset spec and destination trustline checks

Shared Horizon error fixtures for payment tests are in `tests/fixtures/payments.ts`.

Pre-PR verification helper tests live in `tests/verify-acceptance.test.ts`.

See [Error Handling — Payment Helper Error Reference](./error-handling.md#payment-helper-error-reference) for the documented failure modes.
See [Pre-PR Verification](./pre-pr-verification.md) for the `npm run verify:pr` workflow.
