# SDK Dependency Review Standards

This document outlines the guidelines and review process for introducing, evaluating, and updating third-party dependencies in the Stellar PocketPay SDK.

---

## Core Philosophy

The PocketPay SDK targets mobile applications (React Native / Expo), web apps, and server environments. Every runtime dependency added to the SDK directly impacts consumer bundle size, attack surface, startup performance, and long-term maintenance overhead.

**Key Principles:**
1. **Minimal Runtime Footprint**: Keep `dependencies` as lean as possible. Prefer standard JavaScript/Node.js/Web APIs or standard Stellar SDK primitives over external utility libraries.
2. **Security & Supply Chain Protection**: Every dependency is code executed inside consuming applications. We rigorously audit dependency maintainership, transitive trees, and security track records.
3. **Strict License Compliance**: Only open-source licenses compatible with MIT (such as MIT, Apache 2.0, or BSD) are permitted.

---

## Criteria for Adding Dependencies

Before proposing or adding a new third-party dependency, contributors and maintainers must evaluate the request against the following criteria:

### 1. Runtime (`dependencies`) vs. Development (`devDependencies`)

- **Runtime Dependencies (`dependencies`)**: Require the highest bar for approval. A new runtime dependency will only be considered if:
  - It solves a complex domain problem (e.g. core cryptography, official protocol bindings) that cannot be safely implemented internally in under ~100 lines of code.
  - The functionality cannot be fulfilled by `@stellar/stellar-sdk` or standard ES2022+ features.
  - It adds negligible transitive dependencies (preferably 0 sub-dependencies).

- **Development Dependencies (`devDependencies`)**: Evaluated for build performance, developer experience, and test reliability. They must not pollute the published SDK package (`dist/`).

### 2. Evaluation Criteria Checklist

When requesting a new dependency, contributors should provide justification covering:

| Criterion | Requirement |
|---|---|
| **Purpose & Justification** | Clear explanation of why the package is necessary and what SDK capability it enables. |
| **Alternatives Analysis** | Demonstration that native implementations or existing SDK helpers are insufficient or unsafe. |
| **Maintenance Health** | Active maintenance history, recent releases within the last 6 months, responsive issue tracker, and multiple active maintainers. |
| **Security Track Record** | Zero unpatched Known Vulnerabilities (CVEs). Proven history of prompt security patching. |
| **Transitive Weight** | Small install size and minimal tree of nested dependencies. |
| **License Compatibility** | Permissive open-source license (MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause). Copyleft licenses (GPL, AGPL) are **prohibited**. |

---

## Criteria for Updating Dependencies

Dependency updates ensure security fixes, performance improvements, and compatibility with modern JS runtimes, but must be managed to prevent unexpected regressions.

### 1. Patch and Minor Updates (`x.Y.Z`)
- **Frequency**: Regular background review (e.g. monthly or via automated dependency PRs).
- **Requirements**:
  - Full test suite (`npm run verify`) must pass without warnings.
  - No breaking changes to public API signatures or peer dependency constraints.
  - TypeScript definitions (`dist/index.d.ts`) must remain identical or strictly additive.

### 2. Major Version Updates (`X.0.0`)
- **Requirements**:
  - Thorough review of upstream changelogs and breaking change notices.
  - Evaluation of runtime compatibility (Node.js ≥ 18, React Native Metro bundling, web browsers).
  - Explicit testing against consuming applications (e.g. `pocketpay-mobile`).
  - Documentation of any required migration steps in `CHANGELOG.md`.

### 3. Emergency Security Patches
- **Protocol**: When a vulnerability (CVE) is reported in an ambient dependency:
  - Immediate priority: patch or override affected sub-dependencies.
  - Run full verification (`npm run verify` and integration tests).
  - Release a patch SDK version immediately.

---

## Review and Approval Process for Contributors

When submitting a Pull Request that modifies `package.json` or `package-lock.json`:

1. **State the Justification**: Describe in the PR description why the dependency change is needed and reference the issue discussion.
2. **Verify License & Vulnerabilities**: Run `npm audit` to verify zero vulnerabilities exist.
3. **Check Lockfile Integrity**: Ensure `package-lock.json` changes are cleanly generated and minimal.
4. **Maintainer Sign-Off**: PRs introducing new `dependencies` require explicit review and approval from at least two SDK maintainers.

---

## Periodic Audits

Maintainers conduct periodic reviews of the dependency graph:
- **Audit Command**: `npm audit` run in CI on every push and PR.
- **Circular & Size Audits**: `npm run check:circular` and build size inspection.
- **Unused Dependencies**: Periodic pruning of unused packages to keep the SDK clean and maintainable.
