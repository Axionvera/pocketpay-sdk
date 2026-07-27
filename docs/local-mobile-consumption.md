# Consuming the SDK during local mobile development

This guide explains how to test unpublished changes from
`Axionvera/pocketpay-sdk` in `Axionvera/pocketpay-mobile`. It is especially
useful while replacing mobile-side Stellar logic with imports from the SDK.

The package name is defined by this repository's `package.json`. It is
currently `stellar-pocketpay-sdk`, so the examples use:

```typescript
import {
  createWallet,
  getBalance,
  sendXLM,
} from 'stellar-pocketpay-sdk';
```

Do not use a deep import from `src/` or `dist/`. Only the package root is a
supported public API. If the package is renamed later, use the new
`package.json#name` value in the commands and imports below.

The examples assume sibling clones:

```text
~/code/
├── pocketpay-sdk/
└── pocketpay-mobile/
```

Run `npm ci` in both repositories before starting. The mobile app must also
have the React Native polyfills and Metro configuration described in
[React Native Compatibility](./react-native.md). Changing the installation
method does not remove those runtime requirements.

## Recommendation

**Use `npm pack` and install the generated tarball without saving it.** This is
the safest current workflow for routine SDK-to-mobile testing.

It is recommended because it:

- exercises the compiled `dist/`, package root entry point, declarations,
  `exports`, and `files` allowlist exactly as an npm publication does;
- installs a normal directory under the mobile app's `node_modules` instead
  of a symlink outside Metro's project root;
- catches missing build output and packaging mistakes before publication; and
- can leave `package.json` and `package-lock.json` unchanged, which greatly
  reduces the chance of committing a machine-specific local dependency.

The tradeoff is that every SDK change must be packed and reinstalled. Use
`npm link`, a `file:` dependency, or workspaces only when the faster feedback
loop is worth the extra Metro and cleanup complexity.

## Comparison

| Strategy | Update model | Publication fidelity | Metro/symlink risk | Best use |
| --- | --- | --- | --- | --- |
| `npm pack` tarball | Repack and reinstall | High | Low | Default integration and pre-PR testing |
| `npm link` | Rebuild SDK; link stays in place | Low | High | Short, rapid experiments |
| `file:` path | Rebuild SDK; reinstall when needed | Medium to low | High with npm's linked local packages | Longer local-only development |
| npm workspaces | Rebuild/watch inside one parent tree | Medium | Medium; Metro must see the workspace root | An intentional monorepo |
| npm registry | Publish, then install | Highest for that published version | Low | Release verification, not unpublished changes |

Both `npm link` and `file:` are local linking approaches. npm workspaces also
links workspace packages, but it is not the current repository layout.

## 1. Recommended: `npm pack` and a tarball

`npm pack` creates the same archive shape used by `npm publish`. The SDK's
`prepack` hook builds `dist/` automatically, and the `files` field limits the
package payload to compiled output (plus npm's standard metadata files).

### Initial setup

From the SDK:

```bash
cd ~/code/pocketpay-sdk
npm ci
mkdir -p .local-packages
npm pack --pack-destination .local-packages
```

The last command prints a filename such as:

```text
stellar-pocketpay-sdk-1.0.0.tgz
```

From the mobile app, install that archive without changing either manifest:

```bash
cd ~/code/pocketpay-mobile
npm ci
npm install \
  --no-save \
  --package-lock=false \
  ../pocketpay-sdk/.local-packages/stellar-pocketpay-sdk-1.0.0.tgz
npm ls stellar-pocketpay-sdk
npx expo start --clear
```

If `pocketpay-mobile` uses a different start script, use that script's cache
reset option instead of `npx expo start --clear`.

`--no-save` prevents a tarball path from being written to `package.json`.
`--package-lock=false` prevents it from being written to `package-lock.json`.

### Test another SDK change

After editing the SDK, build a fresh archive:

```bash
cd ~/code/pocketpay-sdk
npm test
npm pack --pack-destination .local-packages
```

Then force the mobile installation to be replaced. This matters when the
tarball keeps the same package version and filename:

```bash
cd ~/code/pocketpay-mobile
npm uninstall \
  --no-save \
  --package-lock=false \
  stellar-pocketpay-sdk
npm install \
  --no-save \
  --package-lock=false \
  ../pocketpay-sdk/.local-packages/stellar-pocketpay-sdk-1.0.0.tgz
npx expo start --clear
```

Use the filename printed by `npm pack`; it changes when the SDK version
changes. A useful integration checkpoint for replacing duplicated Stellar
logic is to import one public operation at a time—for example `getBalance` or
`sendXLM`—and run the corresponding mobile flow before moving the next
operation.

### Advantages

- Closest local simulation of an npm install.
- Avoids watching source outside the mobile project.
- Validates the compiled CommonJS entry point and TypeScript declarations.
- Makes missing files in the publish allowlist visible early.
- Keeps local dependency paths out of tracked manifests with the flags above.

### Disadvantages

- Slower than a live link because changes require repacking and reinstalling.
- A same-version tarball should be uninstalled before reinstalling to avoid a
  stale copy.
- Metro normally needs a cache reset after replacing package contents.

### Cleanup

Restore the mobile app to exactly its committed dependency graph:

```bash
cd ~/code/pocketpay-mobile
npm ci
npx expo start --clear
git status --short
```

Remove generated archives from the SDK:

```bash
cd ~/code/pocketpay-sdk
rm -f .local-packages/*.tgz
rmdir .local-packages 2>/dev/null || true
git status --short
```

`.local-packages/` is ignored by this SDK repository, but it should still be
removed when it is no longer needed. Before committing or creating a mobile
production build, confirm that neither `package.json` nor `package-lock.json`
contains `.tgz`, `.local-packages`, or `file:`:

```bash
cd ~/code/pocketpay-mobile
git diff -- package.json package-lock.json
grep -nE '"file:|\.tgz|\.local-packages' package.json package-lock.json || true
```

## 2. `npm link`

`npm link` creates a global npm link for the SDK and then a symlink from the
mobile app's `node_modules` to the SDK checkout.

### Setup

Build the SDK and register the link:

```bash
cd ~/code/pocketpay-sdk
npm ci
npm run build
npm link
```

Consume it from the mobile app:

```bash
cd ~/code/pocketpay-mobile
npm ci
npm link stellar-pocketpay-sdk
npm ls stellar-pocketpay-sdk
```

The link points at the SDK package root, whose entry point is `dist/index.js`.
Keep `dist/` current in a second terminal:

```bash
cd ~/code/pocketpay-sdk
npm run build -- --watch
```

Metro must be allowed to follow and watch the linked checkout. For an Expo
app, merge the following ideas into the app's existing `metro.config.js`
rather than overwriting its current aliases or polyfills:

```javascript
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const sdkRoot = path.resolve(__dirname, '../pocketpay-sdk');

config.watchFolders = [...(config.watchFolders ?? []), sdkRoot];
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
```

Restart Metro after creating or changing the link:

```bash
cd ~/code/pocketpay-mobile
npx expo start --clear
```

### Advantages

- Fast iteration while the TypeScript compiler watches the SDK.
- No tarball needs to be generated after each edit.
- The mobile import uses the real package name and public entry point.

### Disadvantages

- Symlinks and files outside Metro's default project root require extra Metro
  configuration and cache resets.
- Dependency resolution can differ from a real npm installation and can load
  duplicate copies of some dependencies.
- The global link is hidden machine state, so another developer or CI cannot
  reproduce it from the repository.
- It does not verify which files `npm publish` will actually include.

### Typical use

Choose `npm link` for a short debugging session where SDK code changes
frequently and the Metro configuration is already known to work. Run the
tarball workflow before opening a PR or declaring the integration complete.

### Cleanup

Remove both ends of the link and restore the mobile install:

```bash
cd ~/code/pocketpay-mobile
npm unlink --no-save stellar-pocketpay-sdk
npm ci

cd ~/code/pocketpay-sdk
npm unlink
```

Remove the temporary `watchFolders` and `unstable_enableSymlinks` changes from
`pocketpay-mobile/metro.config.js` if they are not otherwise required, then:

```bash
cd ~/code/pocketpay-mobile
npx expo start --clear
git diff -- package.json package-lock.json metro.config.js
git status --short
```

Do not commit the Metro changes unless the team intentionally wants permanent
support for linked packages.

## 3. Local `file:` dependency

A local path records the SDK location as a dependency. With npm, a directory
`file:` dependency is commonly installed as a link, so it has most of the
same Metro considerations as `npm link`.

### Setup

Prepare and continuously build the SDK:

```bash
cd ~/code/pocketpay-sdk
npm ci
npm run build -- --watch
```

In another terminal, add the local dependency to the mobile app:

```bash
cd ~/code/pocketpay-mobile
npm install --save-exact "file:../pocketpay-sdk"
npm ls stellar-pocketpay-sdk
npx expo start --clear
```

Use the `watchFolders` and symlink configuration from the `npm link` section
if Metro cannot resolve the package or does not notice rebuilt files. Run
`npm ci` or `npm install` inside `pocketpay-sdk` as well; a linked local
package is responsible for its own dependencies.

### Advantages

- The relationship is explicit in the mobile `package.json` and lockfile.
- No global npm link is required.
- Convenient for a longer-lived local setup with stable sibling paths.

### Disadvantages

- `file:../pocketpay-sdk` is machine- and directory-layout-specific.
- It can accidentally reach a commit, CI job, EAS build, or production build.
- It still has symlink, Metro watch, and possible duplicate-dependency issues.
- It consumes the checkout, not necessarily the exact payload npm will
  publish.

### Typical use

Use `file:` when one developer needs a persistent sibling-repository link and
is prepared to keep the manifest changes strictly local. It is not the
recommended pre-release verification method.

### Cleanup

If the only manifest changes are from the local install:

```bash
cd ~/code/pocketpay-mobile
npm uninstall stellar-pocketpay-sdk
git restore -- package.json package-lock.json
npm ci
npx expo start --clear
```

If those files contain other work, remove only the `file:` dependency and its
lockfile entry instead of using `git restore`. Also remove temporary Metro
changes, then verify:

```bash
git diff -- package.json package-lock.json metro.config.js
grep -n '"file:' package.json package-lock.json || true
git status --short
```

## 4. npm workspaces

Workspaces are appropriate only if the SDK and mobile app intentionally live
under one parent monorepo. The current projects are separate repositories, so
**do not add a `workspaces` field to either repository merely for local
testing**. Use the tarball workflow today.

If the team later adopts a monorepo, a minimal parent layout could be:

```text
pocketpay/
├── package.json
├── packages/
│   └── pocketpay-sdk/
└── apps/
    └── pocketpay-mobile/
```

The root manifest would be private:

```json
{
  "name": "pocketpay",
  "private": true,
  "workspaces": [
    "packages/pocketpay-sdk",
    "apps/pocketpay-mobile"
  ]
}
```

The mobile workspace should declare a version of `stellar-pocketpay-sdk` that
matches the SDK workspace version, and installation should run from the root:

```json
{
  "dependencies": {
    "stellar-pocketpay-sdk": "1.0.0"
  }
}
```

```bash
cd ~/code/pocketpay
npm install
npm run build --workspace=stellar-pocketpay-sdk -- --watch
npm run start --workspace=pocketpay-mobile -- --clear
```

npm links a matching local workspace during the root install. Metro should
use the monorepo root in `watchFolders` (or an equivalent monorepo-aware
configuration), and dependency versions should be managed from the root.

### Advantages

- First-class, reproducible local links managed by the package manager.
- Good fast-feedback workflow for multiple apps and shared packages.
- Centralized installs and dependency version management.

### Disadvantages

- Requires an intentional repository/layout and lockfile migration.
- Metro, native tooling, CI, and release automation must all become
  monorepo-aware.
- Workspace resolution still does not replace testing the packed artifact.

### Typical use

Use workspaces when PocketPay is deliberately migrated to a monorepo for
broader architectural reasons, not as a one-developer workaround for this
issue. Even in a monorepo, run `npm pack` as a release check.

### Cleanup

For a temporary workspace experiment, stop the root watcher, remove the
temporary parent manifest and root `node_modules`, return both repositories
to their original locations, and run `npm ci` in each repository. Do not
commit workspace paths or a root lockfile unless the monorepo migration is an
approved project change.

Verify both repositories independently:

```bash
cd ~/code/pocketpay-sdk
git status --short

cd ~/code/pocketpay-mobile
git status --short
```

## 5. Install from the npm registry

Installing the published package is the final baseline:

```bash
cd ~/code/pocketpay-mobile
npm install stellar-pocketpay-sdk
npm ls stellar-pocketpay-sdk
npx expo start --clear
```

### Advantages

- Tests exactly what npm currently serves.
- No local path, symlink, or external watch folder.
- Reproducible for developers, CI, and production.

### Disadvantages

- Cannot test an unpublished SDK change.
- Requires publishing a new version before the mobile app can consume it.
- Publishing throwaway versions makes release history noisy.

### Typical use and cleanup

Use this after publication or when reproducing a consumer report against a
known version. To remove it:

```bash
cd ~/code/pocketpay-mobile
npm uninstall stellar-pocketpay-sdk
npm ci
git status --short
```

If the package is a committed mobile dependency, do not uninstall it; use
`npm ci` to restore the committed registry version after any local test.

## Pre-commit and production-build guard

Regardless of the strategy, run these checks in `pocketpay-mobile` before
committing or creating an EAS/native production build:

```bash
git status --short
git diff -- package.json package-lock.json metro.config.js
grep -nE '"file:|\.tgz|\.local-packages' package.json package-lock.json || true
npm ci
npm ls stellar-pocketpay-sdk
```

The expected final state is:

- no local path or tarball in a tracked manifest;
- no temporary link-only Metro configuration;
- no active global/local npm link;
- no generated tarball intended for a commit; and
- `node_modules` restored from the committed lockfile.
