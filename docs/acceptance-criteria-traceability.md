# Acceptance Criteria Traceability

To ensure that pull requests fully address the issues they claim to resolve, the PocketPay SDK uses a **Traceability Table**. This format makes it easy for maintainers to verify how each acceptance criterion was satisfied without guessing.

## Traceability Table Format

In your PR description (under the **Acceptance Criteria Coverage** section), you must map each criterion from the issue to the specific files, tests, or documentation changes that implement it.

The format is a Markdown table with three columns:
- **Criterion**: The exact text of the acceptance criterion from the issue.
- **Status**: E.g., ✅ Complete, 🚧 Partial, ❌ Out of Scope, ⏭️ Skipped.
- **Evidence / Location**: Links to the specific files, lines of code, or test cases that prove the criterion was met.

### Example Completed Table

| Criterion | Status | Evidence / Location |
| :--- | :---: | :--- |
| Create `safeCheckDestinationTrustline` wrapper | ✅ Complete | Implemented in `src/payments/trustline.ts` |
| Add unit tests for successful and failed trustline checks | ✅ Complete | Tests added in `tests/payments/trustline.test.ts` |
| Document error handling for missing trustlines | ✅ Complete | Updated `docs/issued-asset-payments.md` |

## Incomplete Criterion Handling

If an issue's criterion is not fully completed in your PR:
1. Mark the status as **🚧 Partial**, **❌ Out of Scope**, or **⏭️ Skipped**.
2. In the **Evidence / Location** column, explicitly explain *why* it was not completed.
3. If applicable, provide a link to a follow-up issue or explain why it was deferred.

Partial implementations without justification will block PR approval.

## Review Guidance (For Maintainers)

When reviewing a PR, maintainers should:
1. **Verify Evidence**: Check the references provided in the traceability table. Does the linked code actually implement the criterion?
2. **Check Tests**: Ensure that behavior-related criteria have corresponding test evidence.
3. **Reject Unjustified Skips**: If a criterion is marked incomplete without a valid explanation (e.g., technical blocker, deferred to a separate planned issue), request changes from the author.
