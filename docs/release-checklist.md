# Release Checklist

Follow these steps before publishing or tagging a new version of the SDK.

## 1. Run the verification script

Run all pre-release checks (type-checking, tests, and build) in a single command:

```bash
npm run verify
```

This runs the following in sequence:

| Step | Command | What it checks |
|------|---------|----------------|
| Type-check | `npm run lint` | No TypeScript errors (`tsc --noEmit`) |
| Tests | `npm run test` | All Vitest tests pass |
| Build | `npm run build` | `dist/` compiles cleanly with `tsc` |

All three steps must pass before proceeding.

## 2. Review the changelog

- Confirm the version bump in `package.json` matches the intended semver level (patch / minor / major).
- Ensure `CHANGELOG.md` (if maintained) is up to date.

## 3. Tag the release

```bash
git tag v<version>
git push origin v<version>
```

Replace `<version>` with the value in `package.json` (e.g., `1.1.0`).

## 4. Publish to npm

Publishing triggers `prepublishOnly`, which runs `npm run build` again as a final safety net:

```bash
npm publish
```

> **Note:** This is not an automated publish workflow. Each step above is a manual check performed by the maintainer.
