# Local Verification Workflow

Run **one command** before pushing SDK changes to catch lint, type, test, and
coverage regressions locally instead of in CI.

```bash
npm run verify
```

## What it runs

`npm run verify` executes, in order, and stops at the first failure:

| Step | Script | Checks |
|------|--------|--------|
| Lint / typecheck | `npm run lint` (`tsc --noEmit`) | No type errors across the SDK. |
| Circular deps | `npm run check:circular` | No illegal import cycles (`scripts/check-circular-deps.ts`). |
| Tests | `npm run test` (`vitest run`) | The unit suite passes (offline-safe; see [testing.md](./testing.md)). |
| Coverage | `npm run test:coverage` (`vitest run --coverage`) | Coverage report generated (v8). Non-blocking by default. |
| Build | `npm run build` (`tsc`) | The package compiles to `dist/`. |

All steps must pass locally before opening or updating a PR.

## When to run it

- After finishing a change, **before** `git push`.
- After rebasing onto `main` (catches drift from upstream types/tests).
- Before requesting a review.

This mirrors what the automation checks when a PR is opened (the repo's
`trigger-auto-merge.yml` dispatches validation to the central automation).
Running it locally first is the fastest way to avoid a red ✗ on the PR.

## Failure handling

| Failure | What it means | Fix |
|---------|---------------|-----|
| `lint` (tsc) errors | Type errors / unused vars with `noEmit`. | Fix the type errors; don't `@ts-ignore` to hide them. |
| `check:circular` fails | A new import cycle was introduced. | Break the cycle (move shared code to a leaf module). |
| `test` fails | A unit test broke. | Read the vitest output; fix the cause, not the assertion. |
| `test:coverage` fails to run | `@vitest/coverage-v8` not installed. | `npm install` (it's a devDependency). |
| `build` fails | `tsc` cannot emit `dist/`. | Usually the same root cause as `lint`; resolve types. |

## Coverage notes

- Coverage uses the **v8** provider (`@vitest/coverage-v8`).
- Thresholds are set to `0` (non-blocking) so the report is informational.
  Once the suite matures, raise them (e.g. `statements: 80`) to enforce a floor.
- The HTML report is written to `coverage/` (gitignored).

## Related

- `npm run test:watch` — re-run tests on change during development.
- `npm run test:integration` — integration lane (needs Testnet; separate config).
- [testing.md](./testing.md) — unit vs integration lanes and the offline guarantee.
