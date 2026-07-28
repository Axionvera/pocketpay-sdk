# Contribution Quality Gate Checklist

> **Audience:** maintainers (and contributors preparing for review).
> Use this checklist **before approving** an SDK issue PR.
> Completing it does **not** approve GrantFox payment — that is assessed separately.

**PR:** #
**Issue:** #
**Reviewer:**
**Date:**

---

## 1. Meaningful implementation (size vs completeness)

Size alone does not pass the gate. A small, complete fix can pass; a large
incomplete patch must not.

- [ ] The PR solves the issue's stated problem (not a stub, comment-only, or symptom-only patch)
- [ ] Changes touch the necessary implementation modules (not docs-only when behaviour was required)
- [ ] Scope matches the issue — no unrelated drive-by refactors without rationale
- [ ] No leftover `TODO` / `FIXME` that block the acceptance criteria
- [ ] Public API changes (if any) are intentional and documented

**Notes:**

---

## 2. Tests

- [ ] Behaviour changes include unit tests under `tests/`
- [ ] Failure / error paths are covered (not happy-path only)
- [ ] Bug fixes include a regression test
- [ ] Tests are offline-safe (no unmocked live Horizon / Friendbot calls)
- [ ] Docs-only / config-only PRs explicitly justify why tests are N/A

**Test evidence (files or PR section):**

---

## 3. CI status

- [ ] Local gate was run (`npm run verify` and/or `npm run verify:pr`)
- [ ] All required GitHub CI checks on the PR are green
- [ ] Any red check is pre-existing, documented, and unrelated to this PR
- [ ] No secrets, `.env`, or credentials in the diff

**CI notes / links:**

---

## 4. Documentation

- [ ] Public behaviour / API / error-code changes update `docs/` (or README) as needed
- [ ] Contributor-facing workflow changes update `CONTRIBUTING.md` when applicable
- [ ] Changelog / migration notes considered for user-facing changes
- [ ] Docs are accurate for the shipped behaviour (no aspirational-only text)

**Docs touched:**

---

## 5. Issue acceptance criteria

- [ ] Every acceptance criterion from the issue is mapped in the PR description
- [ ] Each criterion is either satisfied or explicitly out-of-scope with rationale
- [ ] Contributor self-review form completed
      (see [contributor-self-review.template.md](./contributor-self-review.template.md))
- [ ] Pre-PR verification completed when applicable
      (see [pre-pr-verification.md](../../docs/pre-pr-verification.md))

**Criteria gaps (if any):**

---

## Gate decision

- [ ] **PASS** — ready to approve / merge from a quality standpoint
- [ ] **HOLD** — missing items listed below; do not approve yet

**Hold reasons / requested follow-ups:**

---

## Related guides

- [Contribution Quality Gate](../../docs/contribution-quality-gate.md) — full guidance and examples
- [Meaningful Change Review](../../docs/meaningful-change-review.md) — what counts as real SDK work
- [Contributor Self-Review Form](./contributor-self-review.template.md) — contributor-facing form
