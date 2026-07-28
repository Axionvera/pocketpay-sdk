# Meaningful SDK Change Review Guide

What counts as *meaningful* PocketPay SDK work — and what doesn't. Use this
before opening a PR and before reviewing one. The goal is complete, correct,
tested behaviour that satisfies the issue, not a thin patch that merely touches
the code.

> **Why this matters:** a merged PR is **not** automatically payment-approved.
> Rewards are assessed on whether the work actually solved the problem (see
> [Payment-Period Conduct Note](./payment-period-conduct.md) in the contracts
> repo). This guide defines the bar.

## What "meaningful" means

A contribution is meaningful when it:

1. **Addresses the problem** — the issue's root cause, not a symptom or a comment.
2. **Touches the necessary modules** — the real implementation files, not just
   docs or a stub.
3. **Includes tests** — happy path **and** failure paths, where the change has
   behaviour.
4. **Meets the acceptance criteria** — every checkbox in the issue, or a
   documented reason it's out of scope.
5. **Is verifiable locally** — passes `npm run verify` (lint, circular check,
   tests, coverage, build).

A small PR can be meaningful (a tight, tested fix). A large PR can be
*un*meaningful (adds code without behaviour, tests, or criteria coverage).
Size is not the measure — **completeness is**.

---

## Before you start

- [ ] Read the issue's acceptance criteria and any linked docs (e.g.
      [testing.md](./testing.md), [error-handling.md](./error-handling.md)).
- [ ] Identify which module owns the behaviour
      (e.g. `src/payments/validation.ts`, `src/payments/destination-validation.ts`,
      `src/transactions/mapper.ts`, `src/errors/index.ts`, `src/wallet/account.ts`).
- [ ] Note the public API surface you're changing — is it exported from
      `src/index.ts`? Breaking changes need a clear rationale.

---

## ❌ Insufficient (small/incomplete) examples

**1. A stub with no behaviour**
```ts
// ❌ Doesn't validate anything; just returns the input.
export function validateSendXLMParams(params: SendXLMParams): SendXLMParams {
  return params;
}
```
Meaningful version checks `destination`, `amount > 0`, `asset` shape, and throws
a typed error on failure.

**2. Behaviour without tests**
```ts
// ❌ Fixes the bug but proves nothing. Reviewers can't tell if it works.
export function classifySubmitError(error: unknown, txHash?: string): PocketPayError {
  // ...new logic...
}
```
Meaningful version adds `tests/errors.test.ts` cases: Horizon timeout,
`tx_bad_seq`, op-level `op_*` codes, and passthrough of an already-classified
`PocketPayError`.

**3. Happy-path-only tests**
```ts
// ❌ Only proves the success case; never proves rejection of bad input.
it('formats a valid amount', () => {
  expect(formatAssetAmount(valid)).toBe('100.00');
});
```
Meaningful version also asserts: zero amount, negative, NaN, and oversized
decimals are rejected or formatted per spec.

**4. Fixes the symptom, not the cause**
```ts
// ❌ Swallows the real error so CI stops complaining.
catch (e) { return undefined; }   // hides the failure
```
Meaningful version surfaces a classified `PocketPayError` with a retryability
hint (see `src/errors/index.ts`) so callers can act.

**5. Docs/comments only for a behaviour issue**
```md
<!-- ❌ Issue asks for validation; PR only adds a README note "validate amounts". -->
```
Meaningful version implements the validation in code **and** updates docs if the
public contract changed.

---

## ✅ Acceptable (meaningful) examples

**1. A complete fix with coverage**
- Implements the real rule in the owning module.
- Adds/updates a test file in `tests/` covering success + failure.
- `npm run verify` is green.
- Acceptance criteria all checked (or noted as out-of-scope).

**2. A new public helper with tests + export**
- Added in the correct module (e.g. `src/payments/validation.ts`).
- Exported from `src/index.ts` if it's public API.
- Unit-tested; types documented.

**3. A refactor that preserves behaviour**
- No behaviour change, but improves clarity/structure.
- Existing tests still pass; new tests added if a path was uncovered.
- No silent API break without a documented reason.

---

## Test expectations

- [ ] New behaviour has tests in `tests/` (the repo's unit lane — offline-safe,
      see [testing.md](./testing.md)).
- [ ] **Failure paths are tested**, not just the happy path.
- [ ] Tests assert the returned value **and** the thrown error type where
      relevant (typed `PocketPayError`, not bare `Error`).
- [ ] `npm run verify` passes locally — including the coverage step.
- [ ] Integration-only behaviour (needs Testnet) goes in the
      `test:integration` lane, not the unit lane.

## Reviewer criteria (use on every PR)

- [ ] Does the PR solve the issue, or just add code/comments?
- [ ] Does it touch the necessary implementation modules (not only docs)?
- [ ] Are both happy and failure paths tested?
- [ ] Does it meet every acceptance criterion (or document out-of-scope)?
- [ ] Does `npm run verify` pass (lint, circular, test, coverage, build)?
- [ ] Any breaking API change? If so, is it intentional and documented?
- [ ] Is error handling typed and classified (not swallowed)?

If the answer to the first question is "just code/comments," the PR is not
meaningful yet — request the missing behaviour, tests, or criteria coverage
before approving. Merging it does not by itself approve payment.

For the full maintainer **pass / hold** checklist (implementation, tests, CI,
docs, acceptance criteria) and more incomplete vs acceptable examples, see
[Contribution Quality Gate](./contribution-quality-gate.md).
