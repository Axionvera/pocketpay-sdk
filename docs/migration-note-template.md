# SDK Migration Guide Template

Use this template when an SDK release requires consumers to change their code, configuration, runtime, dependencies, operational process, or security assumptions.

Copy this file to:

```text
docs/migrations/<version>.md
```

For example:

```text
docs/migrations/2.0.0.md
```

Replace every placeholder before publishing. Remove sections that genuinely do not apply rather than leaving unresolved template text.

# Migrating to PocketPay SDK X.Y.Z

## Release summary

Briefly describe the release and why consumers may need to take action.

| Release detail             | Value                 |
| -------------------------- | --------------------- |
| Target version             | `X.Y.Z`               |
| Previous supported version | `X.Y.Z`               |
| Release type               | Patch / Minor / Major |
| Breaking change            | Yes / No              |
| Security-sensitive change  | Yes / No              |
| Migration required         | Yes / No              |

## Who is affected?

Describe the applications, integrations, runtimes, configurations, or usage patterns affected by this release.

Examples:

- applications using a renamed package-root export;
- applications relying on a changed return type;
- React Native applications using a changed runtime requirement;
- integrations using an updated environment variable;
- applications handling an error code whose behaviour changed;
- wallet or transaction flows affected by new validation rules.

### Consumers not affected

List confirmed usage patterns that do not require migration.

For example:

- consumers that do not use the changed API;
- applications already using the replacement API;
- consumers running on supported runtime versions;
- integrations that do not use the affected configuration.

## Compatibility classification

Select the classification that applies:

- [ ] Backwards-compatible patch
- [ ] Backwards-compatible addition
- [ ] Deprecation
- [ ] Breaking public API change
- [ ] Runtime or dependency change
- [ ] Configuration change
- [ ] Security-sensitive behavioural change

Explain why this classification was selected.

## What changed?

Describe each relevant public API, behaviour, configuration, runtime, dependency, or security-contract change.

### Change 1: Descriptive title

**Previous behaviour**

Describe the previous public behaviour.

**New behaviour**

Describe the new public behaviour.

**Consumer impact**

Explain what consumers must change, verify, or understand.

### Change 2: Descriptive title

Remove this section when the release contains only one migration-sensitive change.

**Previous behaviour**

Describe the previous public behaviour.

**New behaviour**

Describe the new public behaviour.

**Consumer impact**

Explain what consumers must change, verify, or understand.

## Why did it change?

Explain the user-facing, architectural, compatibility, maintenance, or security reason for the change.

Avoid relying on internal implementation details that SDK consumers would not understand.

## Required migration steps

Complete these steps in the order shown.

### 1. Upgrade the package

```bash
npm install stellar-pocketpay-sdk@X.Y.Z
```

Where reproducible dependency installation is required:

```bash
npm install
npm ci
```

### 2. Update affected source code

Describe the exact imports, calls, arguments, types, or error-handling code that consumers must update.

### 3. Update configuration

Describe required environment-variable, network, endpoint, timeout, retry, or runtime configuration changes.

State “No configuration changes are required” when applicable.

### 4. Validate the migration

Run the consuming application’s:

- type checks;
- unit tests;
- integration tests;
- build;
- wallet, payment, transaction, or Soroban test flows where applicable.

Use a safe test environment before production adoption.

## Before and after

Every breaking source-code change must include a practical before-and-after example.

### Before

```typescript
import { oldApi } from "stellar-pocketpay-sdk";

const result = await oldApi(value);
```

### After

```typescript
import { newApi } from "stellar-pocketpay-sdk";

const result = await newApi({
  value,
});
```

Examples must:

- use package-root imports;
- use supported public types;
- reflect the target release;
- avoid real secrets, credentials, or private keys;
- demonstrate any required error handling.

## Public API changes

Document all added, changed, deprecated, renamed, or removed public APIs.

| Previous API | New or replacement API | Status                         | Required action                        |
| ------------ | ---------------------- | ------------------------------ | -------------------------------------- |
| `oldApi`     | `newApi`               | Removed / Deprecated / Changed | Replace calls and update related types |

State “No public API changes” when applicable.

## Type changes

Document changes to:

- function parameters;
- return types;
- required object properties;
- optional object properties;
- exported interfaces;
- exported type aliases;
- generic constraints;
- error types.

### Previous type

```typescript
type PreviousOptions = {
  value: string;
};
```

### New type

```typescript
type NewOptions = {
  value: string;
  network?: "testnet" | "mainnet";
};
```

State “No public type changes” when applicable.

## Configuration changes

| Previous setting | New setting   | Default              | Required action        |
| ---------------- | ------------- | -------------------- | ---------------------- |
| `OLD_SETTING`    | `NEW_SETTING` | Describe the default | Describe the migration |

Document:

- renamed settings;
- removed settings;
- new required settings;
- changed defaults;
- supported values;
- validation rules.

State “No configuration changes” when applicable.

## Runtime and dependency changes

Document changes to:

- supported Node.js versions;
- TypeScript versions;
- React Native versions;
- bundlers;
- module formats;
- direct dependencies;
- peer dependencies;
- Stellar SDK compatibility;
- Horizon or Soroban RPC compatibility.

| Requirement | Previous | New   | Required action                 |
| ----------- | -------- | ----- | ------------------------------- |
| Node.js     | `>=X`    | `>=Y` | Upgrade the application runtime |

State “No runtime or dependency changes” when applicable.

## Error-handling changes

Document changes to:

- error classes;
- error codes;
- validation errors;
- retry guidance;
- timeout behaviour;
- transaction-submission outcomes;
- network-failure handling.

### Previous handling

```typescript
try {
  await oldApi();
} catch (error) {
  // Previous handling
}
```

### New handling

```typescript
try {
  await newApi();
} catch (error) {
  // Updated handling
}
```

State “No error-handling changes” when applicable.

## Deprecations

For every deprecated API, document:

| Deprecated API | Replacement | Deprecated in | Earliest removal |
| -------------- | ----------- | ------------- | ---------------- |
| `oldApi`       | `newApi`    | `X.Y.Z`       | `Y.0.0`          |

Explain how to migrate before removal.

State “No new deprecations” when applicable.

## Security considerations

Explain changes involving:

- wallet-secret handling;
- private keys or signing;
- transaction construction or submission;
- logs and diagnostic output;
- input validation;
- network endpoints;
- dependencies;
- retry and idempotency;
- storage;
- account or asset verification.

Confirm:

- [ ] Migration examples contain no real secrets.
- [ ] Logging guidance does not expose sensitive values.
- [ ] New validation requirements are documented.
- [ ] Network and transaction assumptions are explicit.
- [ ] Dependency security impact has been reviewed.
- [ ] Rollback guidance does not reintroduce a known vulnerability.

State “No security-impacting changes” only after the security readiness review has been completed.

## Data, wallet, and transaction compatibility

Explain whether the new SDK version remains compatible with:

- previously created wallets;
- imported wallet credentials;
- existing Stellar addresses;
- existing trustlines;
- issued assets;
- historical transaction records;
- previously prepared transactions;
- deployed Soroban contracts;
- saved application configuration.

State any required regeneration, migration, or revalidation.

## Rollback guidance

State whether consumers can safely return to the previous SDK version.

### Safe rollback

Describe how to reinstall and restore the previous configuration.

```bash
npm install stellar-pocketpay-sdk@PREVIOUS_VERSION
```

### Unsafe rollback

Where rollback is unsafe, explain why.

Examples:

- the release fixes a security vulnerability;
- the new release changes stored configuration;
- the old release may create invalid transactions;
- the old release exposes sensitive values;
- the application has already adopted an incompatible public API.

## Temporary compatibility options

Describe any temporary:

- compatibility aliases;
- deprecated APIs;
- feature flags;
- dual configuration support;
- staged rollout options.

For each temporary option, document:

- the replacement;
- the planned removal version;
- limitations;
- security implications.

State “No temporary compatibility option is provided” when applicable.

## Validation checklist

After migration, confirm:

- [ ] The consuming application installs the target SDK version.
- [ ] Package-root imports resolve.
- [ ] Type checking passes.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] The production build succeeds.
- [ ] Updated configuration is loaded correctly.
- [ ] Error handling reflects the new behaviour.
- [ ] Wallet creation or import is verified where applicable.
- [ ] Payment and transaction flows are verified where applicable.
- [ ] Soroban interactions are verified where applicable.
- [ ] Logs do not expose secrets.
- [ ] The correct Stellar network is configured.
- [ ] Security-sensitive flows have been reviewed.
- [ ] Rollback limitations are understood.

## Known limitations

List any unresolved limitations, compatibility restrictions, or follow-up work.

Do not use this section to hide release-blocking defects.

State “No known migration limitations” when applicable.

## Support and references

- **Changelog entry:**
- **Release notes:**
- **API documentation:**
- **Security documentation:**
- **Related issue:**
- **Related pull request:**
- **Support channel:**

## Maintainer approval

| Review               | Reviewer | Status                              |
| -------------------- | -------- | ----------------------------------- |
| Public API review    |          | Pending / Approved                  |
| Security review      |          | Pending / Approved / Not applicable |
| Documentation review |          | Pending / Approved                  |
| Migration validation |          | Pending / Approved                  |

The migration guide is ready only when all applicable reviews are approved.
