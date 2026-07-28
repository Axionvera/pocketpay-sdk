# Acceptance Criteria Checklist — Template

> Copy this file to `.github/checklists/issue-<number>.md`, paste the issue
> acceptance criteria, then run:
>
> ```bash
> npm run verify:pr -- --checklist .github/checklists/issue-<number>.md
> ```

## Issue

- **Number:** #<!-- issue number -->
- **Title:** <!-- issue title -->

## Acceptance Criteria

- [ ] <!-- Paste each acceptance criterion from the GitHub issue -->
- [ ] Tests added or updated for behaviour changes
- [ ] Documentation updated when public behaviour changed
- [ ] PR description maps each acceptance criterion to the change

## Contributor confirmations

- [ ] Automated checks passed (`npm run verify:pr`)
- [ ] CI checks pass on the pull request after pushing
- [ ] No secrets or `.env` values committed
