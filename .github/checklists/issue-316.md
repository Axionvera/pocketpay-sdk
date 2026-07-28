# Acceptance Criteria Checklist — Issue #316

> Generated for pre-PR verification. Confirm each item, then run:
>
> ```bash
> npm run verify:pr -- --checklist .github/checklists/issue-316.md
> ```

## Issue

- **Number:** #316
- **Title:** Implement SDK feature flag framework

## Acceptance Criteria

- [x] Feature flag framework is implemented
- [x] Configuration source metadata is represented safely
- [x] Experimental features can be disabled by default
- [x] Unsupported disabled states return typed errors
- [x] Diagnostics include non-sensitive config source information
- [x] Tests cover enabled and disabled feature paths
- [x] Documentation explains feature stability

## Contributor confirmations

- [x] Automated checks passed (`npm run verify:pr`)
- [x] Tests added or updated for behaviour changes
- [x] Documentation updated when public behaviour changed
- [x] PR description maps each acceptance criterion to the change
- [x] No secrets or `.env` values committed
