# Contribution Quality Gate

A repeatable quality gate for PocketPay SDK issue work. Maintainers use it
**before approving** a PR. Contributors should treat it as the bar their PR
must clear.

> **Merged ≠ payment-approved.** GrantFox and campaign rewards are assessed
> separately. This gate reduces incomplete merges that later fail evaluation.

```text
Contributor self-review  →  npm run verify:pr  →  PR opened
        ↓
Maintainer quality gate checklist  →  approve / hold
```

## Checklist location

Use the checklist in
[`.github/checklists/contribution-quality-gate.md`](../.github/checklists/contribution-quality-gate.md).

It covers five areas required by this gate:

| Area | What must be true |
| :--- | :--- |
| **Implementation** | Real behaviour in the right modules; size is not enough |
| **Tests** | Unit tests with failure paths; offline-safe |
| **CI status** | Local verify green; GitHub checks green (or documented pre-existing red) |
| **Docs** | Public contract / workflow docs updated when needed |
| **Acceptance criteria** | Every issue criterion mapped and satisfied (or scoped out) |

Copy the checklist into a review comment or fill it while reviewing the PR.

## How contributors prepare

1. Complete the [Contributor Self-Review Form](../.github/checklists/contributor-self-review.template.md).
2. Run `npm run verify:pr` (see [Pre-PR Verification](./pre-pr-verification.md)).
3. Fill the PR template sections: tests, commands run, CI, acceptance criteria.
4. Map each issue acceptance criterion to a concrete change.

## How maintainers validate

Before clicking approve:

1. Open [contribution-quality-gate.md](../.github/checklists/contribution-quality-gate.md).
2. Walk each section against the PR diff, CI tab, and issue acceptance criteria.
3. Cross-check with [Meaningful Change Review](./meaningful-change-review.md).
4. **PASS** only when every applicable box is checked.
5. **HOLD** with specific missing items if the gate fails — do not merge “to fix later” for incomplete criteria.

### Quick maintainer questions

- Does this PR solve the issue, or only touch nearby files / docs?
- Are failure paths tested, or only the happy path?
- Are GitHub checks green for *this* PR?
- Is every acceptance criterion accounted for in the description?
- Would this pass a later GrantFox evaluation as complete work?

---

## Examples of incomplete work

These patterns should **fail** the quality gate.

### 1. Tiny stub for a behaviour issue

```ts
// ❌ Issue asked for validation; PR returns input unchanged.
export function validateSendXLMParams(params: SendXLMParams) {
  return { ok: true as const };
}
```

**Why it fails:** no real implementation; acceptance criteria unmet.

### 2. Implementation without tests

```ts
// ❌ New classify path shipped with zero tests.
export function classifySubmitError(error: unknown): PocketPayError { /* ... */ }
```

**Why it fails:** tests section of the gate is empty; regression risk.

### 3. Happy-path-only tests

```ts
it('sends payment', async () => {
  await expect(sendXLM(valid)).resolves.toMatchObject({ success: true });
});
// ❌ Never asserts INVALID_AMOUNT, ACCOUNT_NOT_FOUND, PAYMENT_FAILED, etc.
```

**Why it fails:** failure-path coverage required for payment / error work.

### 4. Docs-only PR for a code issue

```md
<!-- ❌ Issue: "add trustline preflight". PR only edits README. -->
```

**Why it fails:** implementation size/completeness gate — behaviour was required.

### 5. Greenwashed CI

```text
Local: tests fail
PR body: "CI will fix it"
CI: red, unexplained
```

**Why it fails:** CI status gate — checks must be green or pre-existing red must be documented.

### 6. Acceptance criteria ignored

```md
## Acceptance criteria
- [ ] (left blank)
```

**Why it fails:** criteria mapping is mandatory; blank sections fail the gate.

---

## Examples of acceptable work

These patterns should **pass** the quality gate when CI is green.

### 1. Complete behaviour + tests + criteria

- Implements the rule in the owning module (e.g. `src/payments/`).
- Adds `tests/*.test.ts` covering success **and** typed error paths.
- `npm run verify` / `npm run verify:pr` green; GitHub checks green.
- PR description checks every issue acceptance criterion.
- Docs updated if the public contract changed.

### 2. Focused bugfix with regression test

- Minimal diff that fixes the root cause.
- New failing test that would have caught the bug, then made green.
- No unrelated refactors.
- Criterion “regression test added” explicitly checked.

### 3. Docs / DX workflow issue done end-to-end

- When the issue is documentation or contributor tooling (e.g. this quality gate):
  - checklist / guide files exist,
  - PR template and README link them,
  - examples of incomplete vs acceptable work are present,
  - no fake `src/` stubs required.
- Still runs `npm run verify` if package scripts or tests were touched.

### 4. Refactor that preserves behaviour

- Existing tests still pass; new coverage where gaps were found.
- No silent public API break.
- Rationale documented in the PR.

---

## Relationship to other docs

| Doc | Role |
| :--- | :--- |
| [contribution-quality-gate.md](../.github/checklists/contribution-quality-gate.md) | Maintainer checkbox form |
| [Contributor Self-Review](../.github/checklists/contributor-self-review.template.md) | Contributor form before review |
| [Meaningful Change Review](./meaningful-change-review.md) | What “meaningful” SDK work looks like |
| [Pre-PR Verification](./pre-pr-verification.md) | `npm run verify:pr` automated reminders |
| [Local Verification](./local-verification.md) | `npm run verify` pipeline details |

---

## PR template

The [PR template](../.github/PULL_REQUEST_TEMPLATE.md) asks contributors to
acknowledge this quality gate. Maintainers should still run the full checklist
before approval — the template alone is not a pass.
