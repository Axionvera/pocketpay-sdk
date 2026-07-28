# Pre-PR Verification

Before opening a pull request, run the SDK's pre-PR verification script. It
executes the same automated gates as `npm run verify`, surfaces git-based
reminders for tests/docs/CI, and prints your issue acceptance criteria
checklist so nothing is missed.

```bash
npm run verify:pr
```

## When to use it

Run `verify:pr` after you believe your branch is complete and before you push
the final commit or open the PR. It is especially useful for GrantFox and
other contribution campaigns where issues ship explicit acceptance criteria.

## What the script checks

### 1. Automated checks (local CI parity)

| Step | Command | Purpose |
| :--- | :--- | :--- |
| Type check | `npm run lint` | Catch TypeScript errors |
| Circular deps | `npm run check:circular` | Prevent module cycles in `src/` |
| Unit tests | `npm test` | Offline Vitest suite |
| Build | `npm run build` | Confirm the package compiles |

These mirror the core `npm run verify` pipeline. The script exits with a
non-zero code when any step fails.

### 2. Git change reminders

Based on your current working tree and `origin/main...HEAD` diff, the script
may remind you to:

- add tests when `src/` changed without `tests/` updates,
- update docs when public behaviour changed,
- run integration tests when network-sensitive code changed,
- confirm GitHub Actions when workflow files changed.

### 3. Acceptance criteria checklist

Provide an issue-specific checklist so the script can print every criterion:

```bash
# Generate a checklist file from issue metadata
npm run verify:pr -- --generate \
  --issue 369 \
  --title "Add SDK acceptance criteria verification script" \
  --criteria "Script added;Package command available;Docs updated" \
  --out .github/checklists/issue-369.md

# Run verification against that checklist
npm run verify:pr -- --checklist .github/checklists/issue-369.md
```

Shorthand when the file follows the default naming convention:

```bash
npm run verify:pr -- --issue 369
```

Checklist files live in `.github/checklists/`. Start from
[acceptance-criteria.template.md](../.github/checklists/acceptance-criteria.template.md)
if you prefer to copy/paste criteria manually from GitHub.

### 4. Standard pre-PR reminders

The script always prints contributor reminders for:

- mapping acceptance criteria in the PR description,
- tests and documentation,
- pushing and watching CI,
- referencing the issue (`Closes #…`),
- avoiding committed secrets.

## Options

```bash
npm run verify:pr -- --help
```

| Flag | Description |
| :--- | :--- |
| `--checklist <path>` | Load a markdown checklist file |
| `--issue <number>` | Load `.github/checklists/issue-<number>.md` |
| `--generate` | Write a new checklist template |
| `--out <path>` | Output path for `--generate` |
| `--title <text>` | Issue title for generated checklist |
| `--criteria <a;b;c>` | Semicolon-separated criteria for `--generate` |
| `--skip-checks` | Print reminders only; skip automated commands |

## Example output

```text
PocketPay SDK — Pre-PR Acceptance Verification
============================================

1. Automated checks (local CI parity)
───────────────────────────────────

→ TypeScript type check [lint (tsc --noEmit)]
✓ TypeScript type check (4120ms)

→ Unit tests (offline) [vitest unit suite]
✓ Unit tests (offline) (1850ms)

…

4. Acceptance criteria checklist
────────────────────────────────
  Checklist: issue #369
  Title: Add SDK acceptance criteria verification script

  [ ] Verification script or checklist generator is added.
  [ ] Package command is available.
  [ ] Documentation explains how contributors should use it.

  Confirm each unchecked item before opening the PR (3 remaining).

5. Next steps
─────────────
  ✓ Automated checks passed (or were skipped intentionally).
  • Confirm each acceptance criterion is met.
  • Open your PR and paste the checklist into the description.
  • Watch CI on GitHub before requesting review.
```

## Related docs

- [CONTRIBUTING.md](../CONTRIBUTING.md) — contributor setup and PR checklist
- [Pre-submission Verification](./pre-submission-verification.md) — `npm run presubmit` CI-parity gate before opening a PR
- [Contribution Quality Gate](./contribution-quality-gate.md) — maintainer pass/hold checklist before approval
- [testing.md](./testing.md) — unit vs integration test lanes
- [release-checklist.md](./release-checklist.md) — maintainer release gates (`npm run verify`)
