# Test Coverage Baseline Report

Generate and interpret PocketPay SDK test coverage locally. Use this before
opening a PR so reviewers can see whether changed modules are adequately tested.

> **Not legal/financial advice, and not a payment guarantee.** Coverage is one
> signal of completeness alongside the [module test matrix](./module-test-matrix.md)
> and the [contribution quality gate](./contribution-quality-gate.md).

## Quick start

```bash
# Run the unit suite with coverage and print a baseline summary
npm run coverage:baseline
```

Or step by step:

```bash
npm run test:coverage    # Vitest + @vitest/coverage-v8
npm run coverage:report  # Print module baseline from coverage/coverage-summary.json
```

Open the HTML report:

```bash
open coverage/index.html   # macOS
# or: xdg-open coverage/index.html
```

## Tooling (already configured)

| Piece | Location |
| :--- | :--- |
| Provider | `@vitest/coverage-v8` (devDependency) |
| Config | `vitest.config.mts` → `test.coverage` |
| Command | `npm run test:coverage` |
| Baseline printer | `npm run coverage:baseline` / `scripts/print-coverage-baseline.ts` |
| Output dir | `coverage/` (gitignored) |

Reporters written on each coverage run:

| Artifact | Path | Use |
| :--- | :--- | :--- |
| Text | terminal | Local / CI logs |
| HTML | `coverage/index.html` | Drill into uncovered lines |
| JSON summary | `coverage/coverage-summary.json` | Baseline script + CI |
| LCOV | `coverage/lcov.info` | Upload to coverage services |

Coverage is scoped to `src/**/*.ts` only (tests, `dist/`, examples, and scripts
are excluded).

## Sample terminal output

```text
 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   72.15 |    58.40 |   68.20 |   72.10 |
 payments          |   80.10 |    65.00 |   78.00 |   80.00 |
  index.ts         |   82.00 |    70.00 |   80.00 |   82.00 | 112-118
 ...
-------------------|---------|----------|---------|---------|-------------------

PocketPay SDK — Coverage baseline report
========================================

Overall (src/)
  Statements : 72.15%  (...)
  Branches   : 58.40%  (...)
  ...

By module (average file % under src/<module>/)
  Module          Files   Stmts%    Lines%
  -------------   -----   -------   -------
  payments           6    80.10%    80.00%
  wallet             2    88.00%    88.50%
  ...
```

Exact percentages change as the suite grows — treat the **shape** of the report
as the contract, not a frozen number.

## Changed-module coverage expectations

When your PR touches `src/<module>/`, reviewers expect:

| Expectation | Detail |
| :--- | :--- |
| **Tests exist for the change** | New/changed behaviour has unit tests (see [module-test-matrix.md](./module-test-matrix.md)). |
| **Error paths covered** | Validation and network failures assert typed `PocketPayError` codes. |
| **No silent coverage drop** | Avoid shipping large new `src/` code with zero new tests. |
| **Report the baseline** | Paste `npm run coverage:baseline` (or `test:coverage`) summary in the PR template “Commands Run” section. |
| **Justify gaps** | If a file stays low-coverage (dead code, thin wrappers), note why in the PR. |

### Soft baseline (informational today)

Global Vitest thresholds are **`0`** (non-blocking) in `vitest.config.mts` so
coverage always **reports** without failing the suite.

Recommended contributor targets for **changed** modules (soft — not CI-enforced yet):

| Metric | Soft target for changed modules |
| :--- | :--- |
| Statements / lines on new public APIs | Cover success **and** failure paths in tests |
| Untested new `src/` files in a behaviour PR | Should be rare; explain if intentional |
| Docs/DX-only PRs | Coverage N/A — say so in the PR |

When the suite is mature enough, raise `thresholds` in `vitest.config.mts`
(e.g. statements `70`) and flip CI to fail under that floor.

## CI integration guidance

Central automation is triggered via `.github/workflows/trigger-auto-merge.yml`.
Locally and in any future native CI job, mirror coverage like this:

### Recommended CI steps

```yaml
- name: Install dependencies
  run: npm ci

- name: Unit tests with coverage
  run: npm run test:coverage

- name: Print coverage baseline
  run: npm run coverage:report
  if: always()

- name: Upload coverage artifacts
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: coverage-report
    path: |
      coverage/lcov.info
      coverage/coverage-summary.json
      coverage/index.html
```

### Optional: fail CI on threshold

Once soft baselines are trusted:

1. Raise `test.coverage.thresholds` in `vitest.config.mts`.
2. Keep `npm run test:coverage` in `npm run verify` / `npm run presubmit`
   (already included).
3. Document the new floor in this file and in [release-checklist.md](./release-checklist.md).

Do **not** enable hard thresholds in a PR without maintainer agreement — sudden
red CI blocks unrelated contributions.

## Contributor checklist

- [ ] Ran `npm run coverage:baseline` (or at least `npm run test:coverage`)
- [ ] Reviewed uncovered lines in changed modules via `coverage/index.html`
- [ ] Added tests for new behaviour and error paths
- [ ] Pasted coverage summary into the PR (or linked the CI artifact)
- [ ] Noted intentional gaps in the PR description

## Related docs

- [testing.md](./testing.md) — unit vs integration lanes
- [module-test-matrix.md](./module-test-matrix.md) — per-module test expectations
- [local-verification.md](./local-verification.md) — `npm run verify` pipeline
- [pre-submission-verification.md](./pre-submission-verification.md) — `npm run presubmit`
- [contribution-quality-gate.md](./contribution-quality-gate.md) — maintainer pass/hold
