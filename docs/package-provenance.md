# Package Provenance and Publishing Integrity

This guide explains how PocketPay SDK releases should preserve package
provenance and how consumers can verify that an installed package came from the
official repository and release process.

## Maintainer Release Practices

- Publish only from the official `Axionvera/pocketpay-sdk` repository or a
  documented release workflow owned by the project.
- Keep the package name, version, git tag, and changelog entry aligned before
  publishing.
- Run the release checklist and verification script before any publish attempt.
- Prefer npm trusted publishing or provenance-enabled publishing when the
  project adds an automated release workflow.
- Require maintainer review before changing package metadata, build scripts,
  publish scripts, or release workflow files.

## What Maintainers Should Avoid

- Do not publish from an unreviewed local checkout, personal fork, or dirty
  working tree.
- Do not paste npm tokens, one-time passwords, signing keys, or registry
  credentials into issues, pull requests, logs, or documentation.
- Do not bypass `prepublishOnly`, build output review, or test verification to
  speed up a release.
- Do not change `package.json` scripts or package entrypoints in the same PR as
  an emergency publish unless reviewers explicitly approve the combined scope.

## Consumer Verification

Consumers can perform lightweight checks before upgrading:

1. Confirm the package name and version match the release notes or git tag.
2. Inspect the npm package metadata for repository and provenance information
   when available.
3. Compare the package contents against the documented public entrypoints and
   expected `dist/` output.
4. Review dependency changes before installing in production applications.
5. Pin versions in lockfiles and upgrade through reviewed pull requests rather
   than ad-hoc installs on production machines.

## Trusted Publishing Roadmap

The current release checklist documents a manual publish flow. If the project
adopts automated publishing later, the workflow should:

- run verification from a protected branch or signed tag,
- use npm trusted publishing or short-lived identity-based credentials,
- publish with provenance metadata enabled,
- avoid storing long-lived registry tokens in repository secrets when a safer
  trusted-publishing path exists, and
- make release logs available without exposing secrets.

## Related Documents

- [Release Checklist](./release-checklist.md)
- [Security Best Practices](./security.md)