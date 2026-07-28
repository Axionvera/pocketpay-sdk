# Pre-submission Verification

Run **one command** before opening or updating an SDK pull request. It mirrors
the local CI-parity pipeline so lint, typecheck, tests, coverage, and build
failures are caught on your machine instead of in CI.

```bash
npm run presubmit
```

Aliases (same behaviour):

```bash
npm run verify:presubmit
npm run verify          # same checks, quieter (no step banners)
```

## What it runs

`npm run presubmit` executes these steps **in order** and **stops at the first failure**:

| Step | Command | Purpose |
| :--- | :--- | :--- |
| Lint / typecheck | `npm run lint` | `tsc --noEmit` — no type errors |
| Circular deps | `npm run check:circular` | No illegal import cycles in `src/` |
| Unit tests | `npm test` | Offline Vitest suite |
| Coverage | `npm run test:coverage` | Coverage report (v8; thresholds informational) |
| Build | `npm run build` | Package compiles to `dist/` |

This is the contributor-facing pre-submission command for issue work. Use it
after your change is complete and before `git push` / opening the PR.

## When to run it

- After finishing a feature or bugfix, **before** submitting a PR
- After rebasing onto `main`
- Before requesting review on an updated PR

For acceptance-criteria reminders and git-based docs/CI hints, also run
`npm run verify:pr` (see [Pre-PR Verification](./pre-pr-verification.md)).

## Failure guidance

| Failed step | What it means | How to fix |
| :--- | :--- | :--- |
| Lint / typecheck | TypeScript errors under `tsc --noEmit` | Fix the reported types; do not hide them with `@ts-ignore` |
| Circular dependency check | A new import cycle was introduced | Break the cycle — move shared code to a leaf module ([dependency map](./dependency_direction_map.md)) |
| Unit tests | A unit test failed | Read Vitest output; fix the cause (or the assertion). Keep tests offline ([testing.md](./testing.md)) |
| Coverage | Coverage runner failed | Run `npm install` so `@vitest/coverage-v8` is present |
| Build | `tsc` cannot emit `dist/` | Usually the same root cause as lint — resolve types first |

After fixing, re-run:

```bash
npm run presubmit
```

A green local run does **not** replace watching GitHub CI on the PR, but it
prevents most avoidable red checks.

## Example success output

```text
PocketPay SDK — Pre-submission verification
==========================================
…

→ [1/5] Lint / typecheck (`npm run lint`)
✓ Lint / typecheck (4120ms)

…

✓ Pre-submission verification passed.
  You are ready to push and open/update your PR.
```

## Example failure output

```text
→ [3/5] Unit tests (offline) (`npm run test`)
…

✗ Failed: Unit tests (offline) (1850ms)
  Fix: Read the Vitest failure output and fix the cause …

See docs/pre-submission-verification.md#failure-guidance for the full table.
Re-run `npm run presubmit` after fixing.
```

## Related docs

- [Local Verification Workflow](./local-verification.md) — details of the `npm run verify` pipeline
- [Pre-PR Verification](./pre-pr-verification.md) — `npm run verify:pr` checklist / acceptance criteria
- [Contribution Quality Gate](./contribution-quality-gate.md) — maintainer pass/hold before approval
- [CONTRIBUTING.md](../CONTRIBUTING.md) — contributor setup
- [testing.md](./testing.md) — unit vs integration lanes
