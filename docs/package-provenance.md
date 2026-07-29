# Package Provenance and Publishing Integrity

This guide defines how PocketPay SDK releases should preserve package
provenance, publishing integrity, and consumer trust.

## Goals

- Make each published npm package traceable to the official repository.
- Keep publishing credentials out of local machines, logs, issues, and pull
  requests.
- Give consumers repeatable checks for package source and integrity.
- Keep release metadata reviewable before a version is published.

## Recommended Publishing Model

Prefer npm trusted publishing with GitHub Actions provenance enabled for future
SDK releases. In that model, maintainers publish from a protected release
workflow instead of a local laptop, and npm records provenance that links the
package back to the repository workflow run.

When trusted publishing is not available, maintainers should still publish only
from a clean checkout of the approved release commit and should record the
commit, tag, package version, and verification evidence in the release PR.

## Maintainer Rules

- Do not commit npm tokens, GitHub tokens, `.env` files, or registry
  credentials.
- Do not paste package tokens or one-time passwords into issues, pull requests,
  CI logs, or chat transcripts.
- Do not publish from a branch with unreviewed changes.
- Do not reuse, overwrite, or force-move release tags after publication.
- Do not publish a package whose `npm pack --dry-run` output contains
  unexpected files.
- Rotate any credential that may have appeared in logs or local shell history.

## Release Integrity Checklist

Before publishing, maintainers should confirm:

- The release commit is merged and tagged from the official repository.
- `package.json` and `package-lock.json` contain the intended version.
- `npm ci`, `npm run verify`, and applicable smoke checks pass.
- `npm pack --dry-run` contains only intended package files.
- The npm package name, version, license, entry points, and repository metadata
  match the reviewed source.
- Any provenance or publishing workflow run is linked from the release notes.

## Consumer Verification

Consumers who need stronger assurance can:

- Compare the npm package version with the GitHub release tag.
- Inspect npm provenance metadata when available.
- Check that the package `repository` field points to the official repo.
- Use lockfiles so package integrity hashes are reviewed and repeatable.
- Reinstall in a clean environment when investigating supply-chain concerns.
- Avoid packages with unexpected names, unpublished source, or missing release
  history.

## Incident Response

If a provenance or publishing-integrity issue is suspected, maintainers should
pause further releases, preserve the affected package metadata, rotate relevant
credentials, publish a corrective release if needed, and document consumer
actions in the changelog or release notes.