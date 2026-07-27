# SDK Security Readiness Review

This document defines the security review required before publishing a PocketPay SDK release.

It is intended for maintainers reviewing changes that affect wallet secrets, signing, transaction construction, network communication, validation, configuration, logging, dependencies, or other security-sensitive behaviour.

A release must not proceed while an unresolved security concern remains.

## Review record

Record the following information in the release pull request:

- **Target version:**
- **Release owner:**
- **Security reviewer:**
- **Review date:**
- **Security-sensitive changes:** Yes / No
- **Breaking security change:** Yes / No
- **Migration guide required:** Yes / No
- **Outstanding concerns:** None / List concerns

## When this review is required

Complete this review when a release changes any of the following:

- wallet generation, import, recovery, or storage;
- secret keys, seed phrases, signers, or signing methods;
- transaction construction, simulation, authorisation, or submission;
- Horizon, Friendbot, Soroban RPC, or other network communication;
- destination, account, asset, amount, contract, or network validation;
- environment variables or SDK configuration;
- error payloads, debug output, or logging;
- retry, timeout, idempotency, or failure-recovery behaviour;
- dependencies;
- public APIs that influence security decisions;
- React Native or other runtime-specific security behaviour.

For documentation-only changes, record that the security review is not applicable only after confirming that the documentation does not change or weaken security guidance.

## Review principles

Security-sensitive SDK behaviour should:

1. fail safely;
2. validate input at the earliest reliable boundary;
3. avoid exposing secrets;
4. avoid silently changing network or transaction assumptions;
5. provide actionable errors without exposing sensitive details;
6. preserve clear ownership of signing and submission;
7. use secure defaults;
8. document consumer responsibilities;
9. provide migration guidance when security assumptions change.

## 1. Review the change scope

- [ ] Identify all security-sensitive source files changed by the release.
- [ ] Identify all affected public APIs.
- [ ] Identify all affected configuration and environment variables.
- [ ] Identify all affected network endpoints.
- [ ] Identify all affected error codes and logging behaviour.
- [ ] Identify all dependency additions or updates.
- [ ] Identify whether consumers must change any security-sensitive behaviour.
- [ ] Confirm that the selected release version matches the compatibility impact.

Document the security impact in plain language.

Example:

```text
Security impact:
- Adds destination validation before transaction construction.
- Does not change signing or secret-storage behaviour.
- No migration is required.
```

## 2. Review wallet-secret handling

Changes involving wallet creation, import, recovery, or signing must confirm:

- [ ] Secret keys and seed phrases are never logged.
- [ ] Secret values are never included in public error messages.
- [ ] Secret values are never included in telemetry or diagnostic payloads.
- [ ] Secret values are never committed in examples, tests, fixtures, or documentation.
- [ ] Wallet secrets are not stored without explicit consumer action.
- [ ] Secret export behaviour matches the documented wallet-secret export policy.
- [ ] Public APIs clearly distinguish public addresses from secret material.
- [ ] Temporary variables containing secrets are not retained unnecessarily.
- [ ] React Native or mobile-storage guidance does not recommend insecure storage.
- [ ] Error handling does not accidentally stringify secret-bearing objects.

Review related documentation:

- [Wallet Secret Export Policy](./wallet-secret-export.md)
- [Wallet Import Safety](./wallet-import-safety.md)
- [Wallet Recovery Limitations](./wallet-recovery-limitations.md)
- [Security Guidance](./security.md)

## 3. Review signing and transaction construction

For changes involving transactions:

- [ ] The SDK does not sign without explicit caller intent.
- [ ] The network passphrase is explicit and validated.
- [ ] Source and destination accounts are validated.
- [ ] Asset identifiers and contract addresses are validated.
- [ ] Amounts reject invalid, negative, zero, malformed, or unsafe values where applicable.
- [ ] Memo or metadata handling is bounded and validated.
- [ ] Transaction time bounds are handled safely.
- [ ] Fees and sequence-number assumptions are documented.
- [ ] Transaction simulation does not silently become submission.
- [ ] Submission responses distinguish accepted, pending, failed, and unknown outcomes.
- [ ] Retried operations cannot unintentionally create duplicate payments.
- [ ] Offline transaction preparation preserves clear signing responsibility.
- [ ] Errors do not expose signed envelopes or secret-bearing payloads unnecessarily.

Review related documentation:

- [Offline Transaction Preparation](./offline-transaction-preparation.md)
- [Idempotency](./idempotency.md)
- [Transaction Timestamps](./transaction-timestamps.md)
- [Destination Validation](./destination-validation.md)
- [Issued-Asset Payments](./issued-asset-payments.md)

## 4. Review input validation

Validate input at the earliest reliable SDK boundary.

Review:

- [ ] Stellar account addresses.
- [ ] Contract addresses.
- [ ] Asset codes and issuers.
- [ ] Payment amounts.
- [ ] Network names and network passphrases.
- [ ] URLs and RPC endpoints.
- [ ] Pagination or query parameters.
- [ ] Transaction filters.
- [ ] Retry and timeout configuration.
- [ ] Optional object properties.
- [ ] Unsupported enum or string values.

Validation failures should:

- use documented error types or codes;
- avoid exposing sensitive input;
- explain the consumer action needed;
- behave consistently across public APIs.

New validation behaviour that may reject previously accepted input must be reviewed as a potential breaking change.

## 5. Review network communication

For Horizon, Friendbot, Soroban RPC, or other endpoints:

- [ ] HTTPS is required for production-facing defaults.
- [ ] Network selection is explicit.
- [ ] Testnet and mainnet behaviour cannot be confused silently.
- [ ] Custom endpoints are validated.
- [ ] Timeout behaviour is bounded.
- [ ] Retry behaviour is documented.
- [ ] Non-idempotent operations are not retried unsafely.
- [ ] Remote errors are mapped to stable SDK errors.
- [ ] Response data is validated before use.
- [ ] Connection failures do not expose credentials or signed payloads.
- [ ] Debug output does not include sensitive request bodies.
- [ ] Consumers can distinguish temporary network failures from permanent validation failures.

Review related documentation:

- [Network Errors](./network-errors.md)
- [Retry Policy](./retry-policy.md)
- [Configuration](./configuration.md)
- [Runtime Compatibility](./runtime-compatibility.md)

## 6. Review logging and diagnostic output

Logging must be useful without exposing secrets or sensitive transaction details.

Confirm:

- [ ] No secret key, seed phrase, credential, token, or private material is logged.
- [ ] Errors do not serialize complete wallet objects.
- [ ] Signed transaction envelopes are not logged by default.
- [ ] Account addresses are logged only where necessary and documented.
- [ ] Diagnostic mode is opt-in where it increases data exposure.
- [ ] Logging payloads use documented fields.
- [ ] Unknown objects are not blindly stringified.
- [ ] Consumer-provided callbacks cannot receive secret-bearing internal state.
- [ ] Examples do not encourage logging complete wallet or transaction objects.
- [ ] Security-sensitive fields are redacted consistently.

Review:

- [Logging](./logging.md)
- [Logging Payloads and Debug Mode](./logging-payloads-and-debug.md)

## 7. Review errors and failure behaviour

Security-sensitive failures should be explicit and stable.

Confirm:

- [ ] Errors use the documented taxonomy.
- [ ] Errors distinguish validation, configuration, network, authorisation, and submission failures.
- [ ] Error messages do not expose secret values.
- [ ] Error causes do not expose full sensitive request payloads.
- [ ] Consumers receive enough information to take safe corrective action.
- [ ] Unknown transaction outcomes are not reported as confirmed failures or successes.
- [ ] Retry guidance is safe for the operation.
- [ ] Breaking error-code changes are documented.
- [ ] Migration guidance is included where consumer handling must change.

Review:

- [Error Standard](./error-standard.md)
- [Error Handling](./error-handling.md)
- [Capability Error Standard](./capability_error_standard.md)
- [Contract Error Taxonomy](./contract_error_taxonomy.md)

## 8. Review configuration and defaults

Configuration changes must not weaken security silently.

Confirm:

- [ ] Required settings are validated at startup or first use.
- [ ] Network defaults are documented.
- [ ] Mainnet behaviour requires deliberate consumer configuration where appropriate.
- [ ] URLs are validated.
- [ ] Timeouts and retries have safe bounds.
- [ ] Secret values are not given insecure defaults.
- [ ] Environment-variable names are documented.
- [ ] Removed or renamed settings include migration guidance.
- [ ] Changed defaults are included in the changelog.
- [ ] Configuration errors do not reveal sensitive values.

A change from a safer default to a less restrictive default requires explicit security justification and maintainer approval.

## 9. Review dependencies

For every new or updated dependency:

- [ ] Confirm that the dependency is necessary.
- [ ] Confirm that its licence is compatible with the project.
- [ ] Review its maintenance status.
- [ ] Review known security advisories.
- [ ] Review transitive dependency impact.
- [ ] Confirm that package scripts do not execute unexpected operations.
- [ ] Confirm that the dependency does not expand published package contents unnecessarily.
- [ ] Confirm that runtime compatibility remains documented.
- [ ] Confirm that the lockfile contains only expected changes.
- [ ] Confirm that no duplicate dependency is introduced without justification.

Use the project’s [Dependency Review](./dependency-review.md).

Security-sensitive dependency changes must be included in the changelog.

## 10. Review the public API

Security behaviour exposed through the public API must remain intentional and documented.

Review:

- `src/index.ts`;
- package exports;
- generated declaration files;
- README examples;
- API reference;
- configuration documentation.

Confirm:

- [ ] No secret-bearing internal helper is exported.
- [ ] No unsafe low-level method is exposed without clear warnings.
- [ ] New options use secure defaults.
- [ ] Security-sensitive parameters are typed and validated.
- [ ] Deprecations identify safer replacements.
- [ ] Removed APIs have migration guidance.
- [ ] Error behaviour is documented.
- [ ] New APIs do not bypass established validation or safety controls.
- [ ] Deep imports are not presented as supported APIs.
- [ ] The selected Semantic Versioning level is appropriate.

## 11. Review tests

Security-sensitive changes require focused tests.

Tests should cover applicable cases such as:

- invalid accounts;
- invalid destinations;
- malformed assets;
- invalid amounts;
- wrong networks;
- invalid contract addresses;
- configuration errors;
- secret redaction;
- logging behaviour;
- retry safety;
- duplicate-submission protection;
- timeout behaviour;
- transaction-authorisation boundaries;
- unexpected remote responses;
- dependency or runtime edge cases.

Confirm:

- [ ] Positive behaviour is tested.
- [ ] Invalid input is tested.
- [ ] Boundary values are tested.
- [ ] Failure behaviour is tested.
- [ ] Sensitive values are absent from errors and logs.
- [ ] Tests do not use real secrets.
- [ ] Tests avoid unnecessary live-network reliance.
- [ ] Regression tests exist for fixed vulnerabilities.
- [ ] Tests use supported public APIs where appropriate.

## 12. Review documentation and examples

Security documentation must agree with released behaviour.

Confirm:

- [ ] README examples are safe.
- [ ] Examples contain no real secrets.
- [ ] Mainnet and testnet guidance is clear.
- [ ] Wallet-backup responsibility is explicit.
- [ ] Secret-export limitations are documented.
- [ ] Signing responsibility is explicit.
- [ ] Transaction examples validate destinations and amounts.
- [ ] Logging examples avoid sensitive payloads.
- [ ] Error-handling examples recommend safe recovery.
- [ ] Configuration guidance uses secure defaults.
- [ ] Deprecated insecure patterns are removed.
- [ ] Security-impacting changes link to migration guidance.

## 13. Determine migration impact

A migration guide is required when consumers must change:

- wallet-secret storage;
- signing;
- transaction construction;
- validation;
- logging;
- configuration;
- runtime versions;
- dependency versions;
- error handling;
- network endpoints;
- retry or idempotency behaviour.

Create the migration guide from:

```text
docs/migration-note-template.md
```

Store it as:

```text
docs/migrations/<version>.md
```

The security reviewer must confirm that:

- required consumer actions are complete;
- examples are safe;
- temporary mitigations are accurate;
- rollback guidance does not reintroduce a vulnerability;
- affected versions are clearly identified.

## 14. Document security changes in the changelog

Follow the [Changelog Policy](./changelog-policy.md).

Security entries should state:

- the affected behaviour;
- the safe version;
- required consumer action;
- whether rollback is unsafe;
- whether a migration guide exists.

Do not include unnecessary exploit details before users can upgrade safely.

Example:

```markdown
### Security

- Prevented wallet-secret values from appearing in SDK diagnostic output. Consumers using debug logging should upgrade immediately.
```

A breaking security change must begin with **Breaking:** and link to a migration guide.

## 15. Decide release readiness

Classify the review result as one of the following.

### Approved

Use when:

- all applicable checks pass;
- documentation and tests are complete;
- no unresolved concern remains;
- migration guidance is complete where required.

### Approved with documented exception

Use only when:

- the exception does not expose consumers to unacceptable risk;
- the limitation is documented;
- follow-up work has an owner;
- maintainers agree that release remains safe.

Record:

- the exception;
- the rationale;
- the owner;
- the follow-up issue;
- the deadline.

### Blocked

Block the release when:

- secrets may be exposed;
- signing or submission behaviour is unsafe or unclear;
- validation can be bypassed;
- a known vulnerable dependency remains without an accepted mitigation;
- tests do not cover a security-sensitive change;
- documentation encourages unsafe behaviour;
- migration guidance is missing;
- rollback guidance is unsafe or misleading;
- any significant security concern remains unresolved.

## Security approval template

Include this in the release pull request:

```text
Security readiness review:
- Security-sensitive changes: Yes / No
- Areas reviewed:
- Public API impact:
- Configuration impact:
- Dependency impact:
- Tests completed:
- Documentation updated:
- Migration guide required: Yes / No
- Migration guide:
- Outstanding concerns: None / Details
- Security reviewer:
- Decision: Approved / Approved with exception / Blocked
```

## Final security checklist

- [ ] Change scope has been reviewed.
- [ ] Wallet-secret handling has been reviewed.
- [ ] Signing and transaction behaviour has been reviewed.
- [ ] Input validation has been reviewed.
- [ ] Network communication has been reviewed.
- [ ] Logging and diagnostic output have been reviewed.
- [ ] Error and failure behaviour has been reviewed.
- [ ] Configuration and defaults have been reviewed.
- [ ] Dependencies have been reviewed.
- [ ] Public API impact has been reviewed.
- [ ] Security-sensitive tests pass.
- [ ] Documentation and examples are safe.
- [ ] Changelog requirements are satisfied.
- [ ] Migration guidance is complete where required.
- [ ] Rollback guidance is safe.
- [ ] No unresolved security concern remains.
- [ ] A maintainer has approved the review.

## Related documentation

- [SDK Release Readiness Checklist](./release-checklist.md)
- [SDK Migration System](./sdk_migration_system.md)
- [Migration Note Template](./migration-note-template.md)
- [Changelog Policy](./changelog-policy.md)
- [Security Guidance](./security.md)
- [Security Threat Model](./security_threat_model.md)
- [Dependency Review](./dependency-review.md)
- [Runtime Compatibility](./runtime-compatibility.md)
- [Error Handling](./error-handling.md)
