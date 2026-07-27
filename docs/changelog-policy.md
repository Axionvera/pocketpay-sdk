# SDK Changelog Policy

This policy defines how PocketPay SDK maintainers document user-visible changes in `CHANGELOG.md`.

The changelog helps SDK consumers understand:

- what changed;
- whether an upgrade is safe and backwards compatible;
- whether source-code or configuration changes are required;
- whether a migration guide exists;
- whether a release contains security-sensitive changes.

## Changelog format

PocketPay SDK follows:

- [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
- [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Every release must have a versioned changelog section.

Unreleased changes must first be added under:

```markdown
## [Unreleased]
```

When a release is prepared, move the relevant entries into:

```markdown
## [X.Y.Z] - YYYY-MM-DD
```

Use the release date in ISO format.

Example:

```markdown
## [1.2.0] - 2026-08-10
```

## Required categories

Use only the categories that apply to the release.

### Added

Use `Added` for new backwards-compatible functionality.

Examples:

- new package-root exports;
- new optional configuration;
- new supported wallet or payment functionality;
- new public TypeScript types;
- new documentation for an existing capability.

Example:

```markdown
### Added

- Added `validateDestination()` for validating Stellar payment destinations before transaction construction.
```

### Changed

Use `Changed` for modifications to existing behaviour that are not primarily bug fixes.

Examples:

- changed documented defaults;
- updated retry behaviour;
- revised public method behaviour;
- runtime or dependency requirement changes;
- improved validation that changes observable results.

Example:

```markdown
### Changed

- Changed payment-preview validation to reject unsupported issued-asset formats before network submission.
```

### Deprecated

Use `Deprecated` when an API remains available but consumers should migrate to a replacement.

Every deprecation entry must identify:

- the deprecated API;
- the supported replacement;
- the version in which deprecation begins;
- the earliest planned removal version, where known;
- a link to migration guidance where appropriate.

Example:

```markdown
### Deprecated

- Deprecated `sendPaymentLegacy()` in favour of `sendAsset()`. Removal is planned for version `3.0.0`.
```

### Removed

Use `Removed` for public APIs, behaviours, runtime support, configuration, or capabilities that are no longer available.

Removed public functionality normally requires:

- a major-version release;
- a migration guide;
- updated API documentation;
- explicit public API review.

Example:

```markdown
### Removed

- Removed the deprecated `sendPaymentLegacy()` export. See the [2.0.0 migration guide](./migrations/X.Y.Z.md).
```

### Fixed

Use `Fixed` for backwards-compatible corrections.

Examples:

- corrected transaction mapping;
- fixed balance calculation;
- fixed an incorrect error code;
- corrected a documented or implemented validation rule;
- fixed an exported type that did not match runtime behaviour.

Example:

```markdown
### Fixed

- Fixed transaction timestamps being interpreted as local time instead of UTC.
```

### Security

Use `Security` for changes that address vulnerabilities or strengthen security-sensitive behaviour.

Examples:

- secret-redaction fixes;
- validation bypass fixes;
- unsafe signing or transaction-construction fixes;
- vulnerable dependency upgrades;
- logging changes that prevent sensitive-data exposure;
- unsafe network-default changes.

Example:

```markdown
### Security

- Redacted wallet-secret fields from SDK diagnostic output.
```

Do not include exploit details that would place users at unnecessary risk before a safe upgrade is available.

## What must be included

Add a changelog entry for changes that affect SDK consumers, including:

- public API additions;
- public API changes;
- deprecations;
- removed APIs;
- behaviour changes;
- bug fixes;
- security fixes;
- configuration changes;
- runtime compatibility changes;
- dependency changes that affect consumers;
- error-code or error-behaviour changes;
- migration requirements;
- significant documentation corrections.

## What should normally be excluded

Do not add changelog entries for changes with no meaningful consumer impact, such as:

- internal refactoring with identical public behaviour;
- test-only changes;
- formatting;
- spelling corrections with no change in meaning;
- CI maintenance;
- repository housekeeping;
- contributor-only tooling changes.

A documentation change should still be included when it corrects guidance that could affect security, compatibility, transaction behaviour, or successful SDK usage.

## Writing changelog entries

Each entry must:

- begin with an action or outcome;
- identify the affected public feature or behaviour;
- describe consumer impact;
- use plain language;
- avoid internal ticket language;
- avoid implementation details unless consumers need them;
- link migration guidance where required;
- identify breaking changes clearly.

Prefer:

```markdown
- Added `prepareOfflineTransaction()` for building unsigned transactions without submitting them.
```

Avoid:

```markdown
- Refactored the transaction module and updated several files.
```

Prefer:

```markdown
- Fixed issued-asset payment validation so malformed asset codes are rejected before submission.
```

Avoid:

```markdown
- Fixed validation bug.
```

## Public API changes

Every changelog entry involving the public API should state whether the change:

- adds an API;
- changes an API;
- deprecates an API;
- removes an API;
- changes public types;
- changes error behaviour.

Breaking public API entries must include a migration-guide link.

Example:

```markdown
### Removed

- Removed `createLegacyWallet()`. Use `createWallet()` instead. See the [3.0.0 migration guide](./migrations/X.Y.Z.md).
```

## Breaking changes

Breaking changes must:

1. appear under `Changed`, `Removed`, or `Security`;
2. begin with **Breaking:**;
3. identify affected consumers;
4. describe the required action;
5. link to a migration guide;
6. correspond to a major-version release unless an urgent security exception is documented.

Example:

```markdown
### Changed

- **Breaking:** `sendXLM()` now accepts an options object instead of positional arguments. See the [2.0.0 migration guide](./migrations/X.Y.Z.md).
```

## Deprecation entries

Deprecation entries must include a replacement whenever one exists.

Example:

```markdown
### Deprecated

- Deprecated `getLegacyBalance()` in favour of `getBalance()`. The deprecated API will remain available until at least version `2.0.0`.
```

Deprecations must not be hidden under `Changed`.

## Security entries

Security entries should communicate:

- the affected behaviour;
- the safe version;
- required consumer action;
- whether rollback is unsafe;
- migration or mitigation guidance.

Avoid publishing:

- private keys;
- seed phrases;
- credentials;
- live exploit payloads;
- unnecessary vulnerability details before coordinated disclosure is complete.

Example:

```markdown
### Security

- Prevented secret-key values from appearing in debug logs. Consumers using debug logging should upgrade immediately.
```

Where a security change is breaking, identify it as such and link migration guidance.

## Migration-guide links

A migration guide is required when consumers must change:

- source code;
- imports;
- configuration;
- environment variables;
- runtime versions;
- dependency versions;
- error handling;
- wallet or signing behaviour;
- deployment or operational procedures.

Link migration guides using repository-relative paths.

Example:

```markdown
See the [2.0.0 migration guide](./migrations/X.Y.Z.md).
```

Completed migration guides must be created from:

```text
docs/migration-note-template.md
```

## Versioning rules

Changelog content must agree with the selected Semantic Versioning level.

### Patch

Appropriate for:

- backwards-compatible fixes;
- security fixes without compatibility breaks;
- documentation corrections;
- internal improvements without public behaviour changes.

### Minor

Appropriate for:

- backwards-compatible public API additions;
- new optional configuration;
- deprecations;
- new supported functionality.

### Major

Required for:

- removed public APIs;
- incompatible parameter or return-type changes;
- new required configuration;
- removed runtime support;
- incompatible default changes;
- breaking security or behavioural changes.

Where uncertainty exists, maintainers must complete the public API review before selecting the version.

## Preparing a release section

Before:

```markdown
## [Unreleased]

### Added

- Added a new public helper.

### Fixed

- Fixed transaction-date parsing.
```

After release preparation:

```markdown
## [Unreleased]

## [1.1.0] - 2026-08-10

### Added

- Added a new public helper.

### Fixed

- Fixed transaction-date parsing.
```

Do not leave released entries duplicated under `Unreleased`.

## Comparison links

Maintain comparison links at the bottom of `CHANGELOG.md`.

Example:

```markdown
[Unreleased]: https://github.com/Axionvera/pocketpay-sdk/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Axionvera/pocketpay-sdk/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Axionvera/pocketpay-sdk/releases/tag/v1.0.0
```

Verify:

- repository ownership is correct;
- tags exist;
- version ranges are correct;
- the `Unreleased` link starts from the latest release tag.

## Changelog review checklist

Before approving a release, confirm:

- [ ] All user-visible changes are represented.
- [ ] Entries are under the correct categories.
- [ ] Entries describe consumer impact.
- [ ] Breaking changes begin with **Breaking:**.
- [ ] Breaking changes link to migration guides.
- [ ] Deprecations identify replacements.
- [ ] Security changes are included under `Security`.
- [ ] Sensitive or exploit-enabling information is excluded.
- [ ] The selected version matches the compatibility impact.
- [ ] The release date uses `YYYY-MM-DD`.
- [ ] Comparison links are accurate.
- [ ] Released entries are removed from `Unreleased`.
- [ ] At least one maintainer has reviewed the changelog.

## Pull-request expectations

Feature and bug-fix pull requests should add an entry under `Unreleased` when they introduce a user-visible change.

A pull request may omit a changelog entry when it only changes:

- tests;
- internal refactoring;
- repository tooling;
- formatting;
- contributor-only documentation.

Where a changelog entry is omitted, the pull-request author should briefly explain why there is no consumer-visible change.

## Related documentation

- [SDK Release Readiness Checklist](./release-checklist.md)
- [SDK Migration System](./sdk_migration_system.md)
- [Migration Note Template](./migration-note-template.md)
- [SDK Security Readiness Review](./sdk_security_readiness_review.md)
- [Support Policy](./support-policy.md)
