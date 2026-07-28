# Acceptance Criteria Checklist — Issue #305

> Generated for pre-PR verification. Confirm each item, then run:
>
> ```bash
> npm run verify:pr -- --checklist .github/checklists/issue-305.md
> ```

## Issue

- **Number:** #305
- **Title:** Implement SDK transaction lifecycle orchestrator

## Acceptance Criteria

- [x] Transaction lifecycle states are implemented
- [x] Intent, validation, signing, submission, polling, and reconciliation are separated
- [x] Duplicate submission risk is guarded
- [x] Timeout, failed, pending, and unknown states are typed
- [x] Payment helpers integrate with the orchestrator
- [x] Tests cover success, failure, timeout, and unknown-status flows
- [x] Documentation explains consumer responsibilities

## Contributor confirmations

- [ ] Automated checks passed (`npm run verify:pr`)
- [ ] Tests added or updated for behaviour changes
- [ ] Documentation updated when public behaviour changed
- [ ] PR description maps each acceptance criterion to the change
- [ ] No secrets or `.env` values committed
