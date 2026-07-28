<!--
  SDK PR Template — testing-evidence edition.
  Fill every section. PRs without testing evidence may be returned for revision.
-->

## Related Issue

<!-- Reference the issue this PR resolves. Use "Closes #NNN" to auto-close. -->
- Closes #

## Implementation Scope

<!-- What problem does this solve, and which modules did you touch? Be specific. -->
- **Problem addressed:**
- **Modules changed:** (e.g. `src/payments/validation.ts`, `src/errors/index.ts`)
- **Public API impact:** (none / new export / breaking change — explain if breaking)

## Tests Added / Changed

<!-- REQUIRED. If tests are genuinely not applicable (docs-only, config-only),
     state why clearly — do not leave this blank. -->
- [ ] New tests added: (list files, e.g. `tests/validation.test.ts`)
- [ ] Failure paths covered: (negative inputs, error classification, edge cases)
- [ ] Docs-only / config-only PR — tests not applicable because:

## Commands Run (local verification)

<!-- Run `npm run verify` and paste the result. This is the single gate that
     mirrors CI: lint -> circular check -> tests -> coverage -> build. -->
- [ ] `npm run verify` passed locally

```
<paste `npm run verify` output summary here>
```

## CI Status

<!-- Confirm the checks on the PR are green. If any are red, explain why and
     link the run. -->
- [ ] All CI checks are passing (or red-only for a documented, pre-existing reason)
- CI run link (if needed):

## Acceptance Criteria Coverage

<!-- Map the issue's acceptance criteria to what you did. Check each, or note
     it as out-of-scope with rationale. -->
- [ ] Criterion 1:
- [ ] Criterion 2:
- [ ] Criterion 3:

## Contributor Self-Review

<!-- Complete the self-review form before requesting review.
     See .github/checklists/contributor-self-review.template.md -->
- [ ] Self-review form completed and attached

## Contribution Quality Gate

<!-- Contributors: confirm your PR is ready for the maintainer quality gate.
     Maintainers: run the checklist before approving.
     See docs/contribution-quality-gate.md and
     .github/checklists/contribution-quality-gate.md -->
- [ ] I reviewed the [Contribution Quality Gate](../docs/contribution-quality-gate.md) and believe this PR meets it
- [ ] Implementation is complete (not a stub / docs-only when behaviour was required)
- [ ] Tests, CI, docs, and acceptance criteria sections above are filled

## Reviewer Notes

<!-- Anything a reviewer should know: design decisions, trade-offs, follow-ups,
     or areas you're unsure about. -->
-

<!--
  Reminder: a merged PR is NOT automatically payment-approved. Reward
  eligibility is assessed separately (see the campaign's contribution terms).
  Maintainers: do not approve until the Contribution Quality Gate checklist
  passes (.github/checklists/contribution-quality-gate.md).
-->
