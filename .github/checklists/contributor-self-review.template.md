# Contributor Self-Review Form

> Complete this form **before** requesting review or expecting payment approval.
> This helps you evaluate your work objectively and ensures nothing is missed.

## Issue

- **Number:** #<!-- issue number -->
- **Title:** <!-- issue title -->
- **Contributor:** <!-- your GitHub username -->

---

## 1. Requirements Review

Verify you have addressed every requirement from the issue.

- [ ] All acceptance criteria from the issue are satisfied
- [ ] No requirements were silently dropped or deferred
- [ ] Edge cases mentioned in the issue are handled
- [ ] Scope creep is avoided — changes are limited to what was requested

**Notes:**
<!-- List any requirements you could not fully address and why -->

---

## 2. Implementation Completeness

Confirm the implementation is production-ready.

- [ ] Code compiles without errors (`npm run build`)
- [ ] No `TODO` or `FIXME` comments left in the changes
- [ ] Error handling follows the SDK's [error standard](../../docs/error-standard.md)
- [ ] Public APIs have JSDoc comments
- [ ] No secret keys, seed phrases, or `.env` values are committed
- [ ] Dependencies were not added without discussion (see [Dependency Review](../../docs/dependency-review.md))

**Modules changed:**
<!-- List the files/modules you modified -->

**Notes:**
<!-- Any design decisions or trade-offs worth mentioning -->

---

## 3. Testing Evidence

Provide concrete evidence that your changes work correctly.

- [ ] Unit tests added or updated for all behaviour changes
- [ ] Bug fix includes a regression test
- [ ] Tests pass locally (`npm test`)
- [ ] Tests are isolated — no live network calls required
- [ ] Edge cases and error paths are covered

**Test files added/modified:**
<!-- List test files -->

**Test output summary:**
```
<paste `npm test` output summary here>
```

---

## 4. CI Status

Confirm automated checks will pass.

- [ ] `npm run lint` passes with no errors
- [ ] `npm test` passes with no failures
- [ ] `npm run verify:pr` passes (recommended)
- [ ] No circular dependency issues introduced

**Local verification output:**
```
<paste `npm run verify:pr` output here, or at minimum `npm run lint && npm test`>
```

---

## 5. Documentation

Verify documentation is updated where needed.

- [ ] Public API changes are reflected in docs
- [ ] README updated if usage patterns changed
- [ ] Chelog entry added for user-facing changes (see [Changelog Policy](../../docs/changelog-policy.md))
- [ ] Any new error codes added to the [error taxonomy](../../docs/public_error_taxonomy.md)

**Docs updated:**
<!-- List any documentation files you modified -->

---

## 6. Known Limitations

Be honest about what your implementation does not cover.

- [ ] I have documented any known limitations in the PR description
- [ ] I have identified follow-up work that may be needed
- [ ] I have noted any performance considerations
- [ ] I have flagged any areas where I am uncertain about the approach

**Limitations:**
<!-- Describe known limitations, follow-ups, or areas of uncertainty -->

---

## 7. Final Confirmation

- [ ] I have reviewed my own PR diff objectively, as if I were the reviewer
- [ ] I have verified no secrets or sensitive data are committed
- [ ] I have confirmed the PR description explains **what** changed and **why**
- [ ] I understand that a merged PR is **not** automatically payment-approved

---

## Submitting

1. Complete this form and attach it to your PR description or include it as a comment
2. Run `npm run verify:pr` one final time before requesting review
3. Request review from a maintainer

> **Remember:** This self-review is for your benefit. Taking 10 minutes to complete it
> can save days of back-and-forth during review.
