# Dependency Review

How the PocketPay SDK evaluates, adds, updates, and justifies its dependencies. This SDK handles wallet keys and payment data, so every dependency is a potential security and supply-chain risk. The goal is a small, auditable dependency tree.

## Guiding Principles

- Prefer zero new dependencies. Most helpers can be written in a few lines of first-party TypeScript.
- Keep the runtime dependency tree as small as possible. Every runtime dependency ships to consumers and adds to their bundle.
- A dependency is a long-term maintenance commitment, not a one-time convenience.
- Development-only tooling is held to a lighter standard than runtime dependencies, but is still reviewed.

## Current Dependencies

Runtime dependencies (shipped to consumers):

| Package | Version | Purpose |
| --- | --- | --- |
| @stellar/stellar-sdk | ^13.1.0 | Core Stellar client for Horizon and Soroban: wallets, payments, transactions, and vault calls |
| dotenv | ^16.5.0 | Loads local .env configuration for examples and tests |

Development dependencies (not shipped to consumers):

| Package | Version | Purpose |
| --- | --- | --- |
| typescript | ^5.8.3 | Type checking and build |
| tsx | ^4.19.4 | Runs TypeScript examples and scripts without a separate build step |
| vitest | ^3.1.4 | Unit and integration test runner |
| @types/node | ^22.15.17 | Node.js type definitions |

## Criteria for Adding a Dependency

Open the issue first. As stated in CONTRIBUTING, no new runtime dependency should be added without discussion on the relevant issue. Before proposing one, answer every question below in the pull request description:

1. Purpose: What specific problem does it solve, and why can it not be solved with a small amount of first-party code or an existing dependency?
2. Runtime vs development: Is it needed at runtime, or only for building and testing? Prefer devDependencies wherever possible.
3. Maintenance status: Is it actively maintained? Check the last release date, the open-to-closed issue ratio, and whether maintainers are responsive.
4. Security risk: Review known advisories with npm audit and the GitHub advisory database. Prefer packages with no outstanding high or critical advisories, and note how large a transitive tree it pulls in.
5. Size and footprint: How much does it add to install size and to a consumer bundle? Smaller is better for an SDK.
6. License: Must be compatible with this project's MIT license (for example MIT, ISC, BSD, or Apache-2.0). Avoid copyleft licenses such as GPL for runtime code.
7. Alternatives: What other packages or first-party approaches were considered, and why was this one chosen?

Add a new dependency only when the answers clearly justify the cost.

## Criteria for Updating a Dependency

1. Read the changelog: Understand what changed between the current and target versions before updating.
2. Respect semantic versioning:
   - Patch and minor updates are usually safe and are encouraged, especially security patches.
   - Major updates are breaking by definition. Review the migration notes and update code and docs to match.
3. Security first: Security patches take priority and should be applied promptly, even outside the normal update cadence.
4. One logical update per pull request: Avoid bundling unrelated dependency bumps together, so reviews and rollbacks stay simple.
5. Verify locally: After any update, run npm run verify (lint, circular-dependency check, tests, and build) and confirm everything passes.
6. Update the lockfile: Commit the resulting package-lock.json change alongside the package.json change.

## Removing a Dependency

Prefer removing a dependency when its functionality is no longer used, can be replaced by a small amount of first-party code, or is already provided by another package in the tree. Removing runtime dependencies is always welcome.

## Review Checklist

Before merging any dependency change, confirm that:

- The change is justified in the pull request description using the criteria above.
- Runtime versus development placement is correct.
- npm run verify passes locally.
- Both package.json and package-lock.json are updated and committed.
- No new high or critical security advisories are introduced.
- The dependency license is compatible with MIT.

See also [Security Best Practices](./security.md) and the [Contributing Guide](../CONTRIBUTING.md).
