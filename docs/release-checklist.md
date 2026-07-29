# SDK Release Readiness Checklist

This checklist defines the required release gates for PocketPay SDK maintainers.

A release must not be tagged or published until every applicable check is completed, any exception is documented, and a maintainer has approved the release.

## Release record

Record the following information in the release pull request:

- **Release version:**
- **Release type:** Patch / Minor / Major
- **Release owner:**
- **Target release date:**
- **Release commit:**
- **Migration note required:** Yes / No
- **Security-sensitive changes:** Yes / No

## 1. Confirm the release scope

- [ ] Confirm that all intended changes are merged.
- [ ] Confirm that unfinished or unrelated changes are excluded.
- [ ] Confirm that the release branch has a clean working tree.
- [ ] Confirm that the proposed version follows Semantic Versioning.
- [ ] Identify all public API additions, changes, deprecations, and removals.
- [ ] Identify any changes to supported runtimes, dependencies, configuration, or network behaviour.
- [ ] Identify any security-sensitive changes.

Use the following versioning guidance:

| Release type | Use when                                                                             |
| ------------ | ------------------------------------------------------------------------------------ |
| Patch        | Backwards-compatible bug fixes, documentation corrections, and internal improvements |
| Minor        | Backwards-compatible public API additions and deprecations                           |
| Major        | Breaking API, runtime, configuration, behaviour, or security-contract changes        |

## 2. Install locked dependencies

Use the committed lockfile so release verification runs against the expected dependency versions:

```bash
npm ci
```

- [ ] Dependency installation completes successfully.
- [ ] No unexpected changes are made to `package-lock.json`.
- [ ] No unreviewed dependency is introduced.

## 3. Run automated verification

Run the complete verification command:

```bash
npm run verify
```

This executes:

| Check                     | Command                  | Expected result                     |
| ------------------------- | ------------------------ | ----------------------------------- |
| Type checking             | `npm run lint`           | No TypeScript errors                |
| Circular dependency check | `npm run check:circular` | No prohibited circular dependencies |
| Unit tests                | `npm run test`           | All tests pass                      |
| Package build             | `npm run build`          | The SDK builds successfully         |

Where the release changes integration behaviour, also run:

```bash
npm run test:integration
```

Where the release changes published exports or build output, run:

```bash
npm run test:smoke
npm pack --dry-run
```

- [ ] `npm run verify` passes.
- [ ] Applicable integration tests pass.
- [ ] Applicable smoke tests pass.
- [ ] New and changed behaviour has appropriate test coverage.
- [ ] The package preview contains only intended publishable files.
- [ ] Generated declaration files reflect the intended public API.

## 4. Review the public API

The supported public API is defined by:

- exports from `src/index.ts`;
- package entry points in the `exports` field of `package.json`;
- generated TypeScript declarations under `dist/`;
- documented SDK behaviour.

Review the release for:

- [ ] New exported functions, classes, constants, or types.
- [ ] Removed or renamed exports.
- [ ] Changed function parameters.
- [ ] Changed return types.
- [ ] Changed required or optional object properties.
- [ ] Changed default values.
- [ ] Changed error codes or error behaviour.
- [ ] Changed validation, retry, timeout, or network behaviour.
- [ ] Changed runtime or dependency requirements.
- [ ] Accidental exports of internal implementation details.
- [ ] Deep-import examples that should use package-root imports.

Any breaking public API change requires:

1. a major-version release;
2. an entry in `CHANGELOG.md`;
3. a migration guide based on the migration-note template;
4. updated API documentation and examples;
5. explicit maintainer approval.

See [SDK Migration System](./sdk_migration_system.md).

## 5. Complete the security review

A security review is required for changes involving:

- wallet creation, import, recovery, or secret handling;
- transaction construction, signing, simulation, or submission;
- Horizon, Friendbot, or Soroban RPC communication;
- environment variables or SDK configuration;
- account, asset, amount, contract, or destination validation;
- logs, debugging information, or error payloads;
- retry, idempotency, timeout, or network-failure behaviour;
- new or updated dependencies.

Complete the checks in [SDK Security Readiness Review](./sdk_security_readiness_review.md).

At minimum, confirm:

- [ ] No secret keys, seed phrases, credentials, tokens, or `.env` files are included.
- [ ] Sensitive values cannot appear in logs or public errors.
- [ ] Package provenance and publishing-integrity guidance in [Package Provenance](./package-provenance.md) has been reviewed for any publishing or release automation changes.
- [ ] Security-sensitive inputs are validated.
- [ ] Network and transaction assumptions are documented.
- [ ] Dependency additions or updates have been reviewed.
- [ ] Security-sensitive behaviour has focused tests.
- [ ] Security-impacting migration guidance is included.
- [ ] No unresolved security concern remains.

An unresolved security concern blocks the release.

## 6. Review documentation and examples

- [ ] README guidance remains accurate.
- [ ] Public API documentation matches the released implementation.
- [ ] Configuration and runtime requirements are documented.
- [ ] Examples use supported package-root imports.
- [ ] New features include usage examples.
- [ ] Deprecated APIs include replacement guidance.
- [ ] Breaking changes include before-and-after examples.
- [ ] Removed APIs are no longer presented as supported.
- [ ] Security guidance reflects the released behaviour.
- [ ] Documentation links resolve to valid files and headings.

## 7. Update the changelog

Follow the [Changelog Policy](./changelog-policy.md).

Add all user-visible changes under `## [Unreleased]` using the appropriate categories:

- `Added`

- `Changed`

- `Deprecated`

- `Removed`

- `Fixed`

- `Security`

- [ ] Entries describe consumer impact rather than internal implementation details.

- [ ] Breaking changes are clearly identified.

- [ ] Security-relevant changes are listed under `Security`.

- [ ] Deprecations identify the supported replacement.

- [ ] Related migration guides are linked.

- [ ] The changelog matches the selected Semantic Versioning level.

## 8. Prepare migration guidance

A migration guide is required when consumers must change:

- imports or application source code;
- configuration or environment variables;
- runtime or dependency versions;
- validation or error-handling logic;
- wallet, signing, or secret-storage behaviour;
- deployment or operational procedures.

Create migration guidance from:

```text
docs/migration-note-template.md
```

Store completed migration guides as:

```text
docs/migrations/<version>.md
```

For example:

```text
docs/migrations/2.0.0.md
```

- [ ] The affected consumer group is identified.
- [ ] Required actions are presented in order.
- [ ] Before-and-after examples are included.
- [ ] Runtime and configuration changes are documented.
- [ ] Security implications are documented.
- [ ] Rollback or temporary compatibility options are described.
- [ ] The migration guide is linked from the changelog.

See [SDK Migration System](./sdk_migration_system.md).

## 9. Record release-readiness evidence

The release pull request must include evidence for each applicable gate:

| Gate                   | Required evidence                                                     | Approved |
| ---------------------- | --------------------------------------------------------------------- | -------- |
| Automated verification | CI results or command output                                          | [ ]      |
| Public API review      | Summary of additions, changes, removals, or confirmation of no change | [ ]      |
| Security review        | Completed review or documented reason it is not applicable            | [ ]      |
| Documentation review   | Updated documentation and examples                                    | [ ]      |
| Changelog review       | Changelog entry                                                       | [ ]      |
| Migration review       | Migration guide or documented reason it is not required               | [ ]      |

At least one maintainer must confirm that the release evidence is complete.

## 10. Prepare the release version

Update the package version using the appropriate Semantic Versioning level:

```bash
npm version patch --no-git-tag-version
```

Replace `patch` with `minor` or `major` where appropriate.

Review the version changes:

```bash
git diff -- package.json package-lock.json
```

- [ ] `package.json` contains the intended version.
- [ ] `package-lock.json` contains the same version.
- [ ] No unrelated package metadata changed.

Run final verification after the version update:

```bash
npm run verify
npm pack --dry-run
```

## 11. Tag and publish

Only perform these steps after the release pull request has been approved and merged:

```bash
git switch main
git pull --ff-only
git tag v<version>
git push origin v<version>
npm publish
```

Replace `<version>` with the exact version from `package.json`.

- [ ] The tag points to the approved release commit.
- [ ] The published npm version matches the Git tag.
- [ ] The package was published from a clean checkout.
- [ ] Publishing credentials were handled securely.

## 12. Perform post-release verification

- [ ] Confirm that npm displays the intended version.
- [ ] Confirm that the Git tag points to the released commit.
- [ ] Install the published package in a clean temporary project.
- [ ] Confirm that package-root imports work.
- [ ] Run a basic SDK smoke test.
- [ ] Confirm that release notes link to the changelog.
- [ ] Confirm that any required migration guide is linked.
- [ ] Announce required consumer actions.

## 13. Handle a failed release

If a release is incorrect or unsafe:

1. stop further promotion or announcements;
2. document the affected version and impact;
3. prepare a corrective release;
4. deprecate the affected npm version where appropriate;
5. do not overwrite or reuse a published version number;
6. add remediation instructions to the changelog and migration documentation.

A release with unresolved API, security, testing, documentation, or migration concerns is not release-ready.

## Related documentation

- [SDK Migration System](./sdk_migration_system.md)
- [Migration Note Template](./migration-note-template.md)
- [Changelog Policy](./changelog-policy.md)
- [SDK Security Readiness Review](./sdk_security_readiness_review.md)
- [API Reference](./api-reference.md)
- [Security Guidance](./security.md)
- [Support Policy](./support-policy.md)
