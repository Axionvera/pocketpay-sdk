# SDK Migration System

This document defines how PocketPay SDK maintainers assess compatibility, prepare migration guidance, manage deprecations, and communicate required consumer actions between releases.

The goal is to make upgrades predictable and prevent public API, runtime, configuration, or security-sensitive changes from being released without clear migration instructions.

## Scope

The migration system applies to changes involving:

- package-root exports;
- public functions, classes, constants, and TypeScript types;
- function parameters and return values;
- required and optional object properties;
- documented default values;
- error types, error codes, and error behaviour;
- configuration and environment variables;
- supported Node.js, TypeScript, React Native, or bundler versions;
- Stellar network, Horizon, Friendbot, or Soroban RPC behaviour;
- wallet, signing, transaction, validation, and security behaviour;
- dependencies that affect SDK consumers.

## Supported public API

Only imports exposed through the package root are considered part of the supported public API.

Supported:

```typescript
import { createWallet, sendXLM, getBalance } from "stellar-pocketpay-sdk";
```

Unsupported deep import:

```typescript
import { internalHelper } from "stellar-pocketpay-sdk/dist/internal";
```

The public compatibility boundary is defined by:

- exports from `src/index.ts`;
- the `exports` field in `package.json`;
- generated declaration files under `dist/`;
- documented SDK behaviour.

Undocumented internal files, private helpers, test fixtures, and build artifacts are not covered by the public compatibility promise.

## Change classifications

Every user-visible SDK change must be classified before release.

### Patch change

A patch change is backwards compatible and does not require consumers to modify their code.

Examples:

- fixing behaviour to match existing documentation;
- correcting an internal implementation defect;
- improving performance without changing observable behaviour;
- correcting documentation or examples;
- adding tests;
- fixing an incorrectly generated error message without changing the error contract.

Normally released as a patch version.

A migration guide is not normally required, but the change should still be included in the changelog when it affects consumers.

### Minor change

A minor change adds backwards-compatible functionality.

Examples:

- adding a new package-root export;
- adding an optional parameter;
- adding an optional object property;
- adding a new supported configuration option;
- introducing a deprecated API replacement;
- adding a new error code without removing existing behaviour.

Normally released as a minor version.

A migration guide is recommended when adoption requires configuration, operational, or security changes.

### Deprecation

A deprecation keeps the existing API available while directing consumers to a supported replacement.

A deprecation must include:

- the deprecated API;
- the supported replacement;
- the reason for the change;
- an example showing how to migrate;
- the version in which deprecation begins;
- the earliest version in which removal may occur;
- a changelog entry.

Deprecations are normally introduced in a minor release.

### Breaking change

A breaking change requires consumers to modify their code, configuration, runtime, operational process, or security assumptions.

Examples:

- removing or renaming an export;
- changing parameter order;
- introducing a new required parameter;
- changing a return type;
- removing or renaming an object property;
- changing a documented default;
- changing error behaviour relied upon by consumers;
- dropping support for a Node.js or TypeScript version;
- changing network, retry, timeout, or validation behaviour;
- changing wallet-secret, signing, or transaction-authorisation behaviour;
- changing configuration or environment-variable names;
- removing a previously supported capability.

Breaking changes require:

1. a major-version release;
2. a changelog entry;
3. a migration guide;
4. updated API documentation;
5. updated examples;
6. a public API review;
7. a security review where applicable;
8. explicit maintainer approval.

## When a migration guide is required

A migration guide is mandatory when consumers must change:

- imports;
- function calls;
- application types;
- configuration;
- environment variables;
- runtime or dependency versions;
- validation logic;
- error handling;
- wallet-secret storage;
- signing or transaction submission;
- deployment procedures;
- operational or security processes.

A migration guide should also be created for complex minor releases where behaviour remains backwards compatible but adoption requires coordinated work.

## Migration-guide location

Create completed migration guides under:

```text
docs/migrations/
```

Use the target version as the filename:

```text
docs/migrations/2.0.0.md
```

Create each guide from:

```text
docs/migration-note-template.md
```

The migration guide must be committed in the same release pull request as the breaking or migration-sensitive change.

## Migration workflow

### 1. Identify compatibility impact

The change author must compare the proposed implementation against the currently released public contract.

Review:

- `src/index.ts`;
- `package.json` exports;
- generated declaration files;
- API documentation;
- README examples;
- error documentation;
- configuration documentation;
- runtime compatibility documentation.

Record whether the release contains:

- no public API change;
- a backwards-compatible addition;
- a deprecation;
- a breaking change;
- a security-sensitive behavioural change.

### 2. Select the release version

Use Semantic Versioning:

| Change                        | Version level                                            |
| ----------------------------- | -------------------------------------------------------- |
| Backwards-compatible fix      | Patch                                                    |
| Backwards-compatible addition | Minor                                                    |
| Deprecation                   | Minor                                                    |
| Breaking change               | Major                                                    |
| Urgent security fix           | Patch, minor, or major depending on compatibility impact |

A security fix does not automatically justify breaking compatibility. Where a breaking change is necessary to address a vulnerability, maintainers must document why the compatibility break is required.

### 3. Create the migration guide

Copy:

```text
docs/migration-note-template.md
```

To:

```text
docs/migrations/<version>.md
```

Complete every applicable section.

The guide must explain:

- who is affected;
- what changed;
- why it changed;
- whether the change is breaking;
- the exact required actions;
- before-and-after examples;
- configuration changes;
- runtime and dependency changes;
- error-handling changes;
- security implications;
- rollback or temporary compatibility options.

Remove template sections that genuinely do not apply rather than leaving unresolved placeholders.

### 4. Add before-and-after examples

Every breaking source-code change must include a practical before-and-after example.

Before:

```typescript
import { oldApi } from "stellar-pocketpay-sdk";

const result = await oldApi(value);
```

After:

```typescript
import { newApi } from "stellar-pocketpay-sdk";

const result = await newApi({
  value,
});
```

Examples must:

- use package-root imports;
- compile against the relevant SDK version;
- use valid public types;
- avoid real secret keys or credentials;
- reflect supported production behaviour.

### 5. Document configuration changes

For renamed or removed settings, include:

| Previous setting | New setting   | Default              | Required action                 |
| ---------------- | ------------- | -------------------- | ------------------------------- |
| `OLD_SETTING`    | `NEW_SETTING` | Document the default | Describe the required migration |

For changed defaults, explain both the previous and new behaviour.

Security-sensitive defaults must not be weakened silently.

### 6. Document error changes

Migration guidance must identify changes to:

- error classes;
- error codes;
- validation failures;
- retry behaviour;
- submission outcomes;
- timeout behaviour;
- network-error handling.

Where consumer error-handling code must change, include an updated example.

### 7. Complete API and security review

The public API reviewer must confirm:

- every breaking API change is documented;
- removed APIs have replacements or an explicit removal explanation;
- versioning matches the compatibility impact;
- examples use supported package-root imports;
- accidental internal exports have not been introduced.

The security reviewer must confirm:

- sensitive values remain protected;
- validation changes are documented;
- network and transaction assumptions are explicit;
- migration steps do not encourage insecure practices;
- dependency and runtime changes have been reviewed;
- rollback instructions do not reintroduce known vulnerabilities.

### 8. Link the migration guide

Link the completed guide from:

- `CHANGELOG.md`;
- GitHub release notes;
- affected API documentation;
- README sections where the change affects common usage;
- deprecation notices where practical.

A breaking change must not be released with an unlinked migration guide.

### 9. Validate the migration instructions

Before release, a maintainer other than the original author should follow the guide from the perspective of an SDK consumer.

Verify that:

- the affected audience is clear;
- the steps are ordered;
- required package versions are accurate;
- examples compile;
- configuration names are correct;
- security guidance is safe;
- rollback limitations are explicit;
- no internal repository knowledge is required.

## Deprecation policy

Unless an urgent security issue requires faster action, maintainers should follow this lifecycle:

1. introduce the replacement API;
2. mark the old API as deprecated;
3. document the migration path;
4. add the deprecation to the changelog;
5. retain the deprecated API for at least one minor-release cycle;
6. remove it only in a major release;
7. document removal in the migration guide.

Deprecation notices should identify:

- the replacement;
- the deprecation version;
- the earliest planned removal version;
- a link to migration guidance.

## Security-driven migrations

Some security issues may require immediate changes that do not follow the normal deprecation lifecycle.

Examples include:

- unsafe secret handling;
- exposure of signing material;
- insecure transaction construction;
- validation bypasses;
- vulnerable dependencies;
- unsafe logging behaviour.

When immediate action is required:

1. document why the normal compatibility lifecycle cannot be followed;
2. provide the safest available migration path;
3. avoid publishing exploit details before users can upgrade safely;
4. identify affected versions;
5. describe temporary mitigations where appropriate;
6. clearly state whether rollback is unsafe;
7. include the change under the changelog’s `Security` category.

## Rollback guidance

Migration guides must state whether consumers can safely return to the previous SDK version.

Rollback may be unsafe when the new release:

- fixes a security vulnerability;
- changes transaction or signing assumptions;
- changes stored data or configuration;
- removes support for an unsafe network endpoint;
- corrects behaviour that previously produced invalid transactions.

Where rollback is unsafe, the guide must say so explicitly.

## Compatibility aliases

Temporary compatibility aliases may be used to ease migration when they do not create security or maintenance risks.

Aliases must:

- be documented as temporary;
- identify the replacement API;
- include a planned removal version;
- produce deprecation guidance where practical;
- be removed only through the documented major-release process.

Compatibility aliases must not preserve insecure behaviour.

## Migration quality checklist

Before approving a migration guide, confirm:

- [ ] The affected consumers are identified.
- [ ] The release version and compatibility impact are explicit.
- [ ] Required actions are complete and ordered.
- [ ] Before-and-after examples are included.
- [ ] Examples use package-root imports.
- [ ] Runtime changes are documented.
- [ ] Dependency changes are documented.
- [ ] Configuration changes are documented.
- [ ] Error-handling changes are documented.
- [ ] Security implications are documented.
- [ ] Rollback guidance is provided.
- [ ] Temporary compatibility options are explained.
- [ ] The guide is linked from the changelog.
- [ ] API review is complete.
- [ ] Security review is complete where applicable.
- [ ] A maintainer has validated the instructions.

## Release pull-request evidence

The release pull request should include:

```text
Migration review:
- Migration guide required: Yes / No
- Compatibility classification:
- Target version:
- Migration guide:
- Public API reviewer:
- Security reviewer:
- Validation completed:
```

Where no migration guide is required, explain why the release does not require consumer action.

## Related documents

- [SDK Release Readiness Checklist](./release-checklist.md)
- [Migration Note Template](./migration-note-template.md)
- [Changelog Policy](./changelog-policy.md)
- [SDK Security Readiness Review](./sdk_security_readiness_review.md)
- [API Reference](./api-reference.md)
- [Runtime Compatibility](./runtime-compatibility.md)
- [Error Handling](./error-handling.md)
- [Security Guidance](./security.md)
- [Support Policy](./support-policy.md)
