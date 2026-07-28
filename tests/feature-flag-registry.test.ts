/**
 * Feature flag registry completeness (issue #316).
 *
 * The framework itself — resolution, precedence, source metadata, typed
 * disabled-feature errors, diagnostics integration — landed in #355. What it
 * had no defence against is **drift**: a flag can gate a code path without ever
 * being registered, and nothing notices.
 *
 * That is not hypothetical. `experimentalVaultLocks` gates the vault lock
 * actions through `readiness.featureFlag` in `src/vault/intents.ts`, a variable
 * rather than a literal, so it never appeared in a grep of call sites and was
 * absent from `DEFAULT_FEATURE_FLAGS`, `FeatureFlagKey` and the docs table.
 *
 * These tests are the canary. Adding a flag without registering it now fails
 * here instead of silently shipping a flag no consumer can discover.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_FEATURE_FLAGS, isFeatureEnabled } from '../src/config';

const SRC = path.resolve(__dirname, '..', 'src');

/** Every `.ts` file under `src/`. */
function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (entry.name.endsWith('.ts')) acc.push(full);
  }
  return acc;
}

/**
 * Flag keys referenced anywhere in `src/`.
 *
 * Matches the `'experimental…'` string literal itself rather than the call
 * site, because a flag can be passed as a variable — which is exactly how the
 * one drifting flag escaped detection.
 */
function referencedFlagKeys(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of sourceFiles(SRC)) {
    const contents = fs.readFileSync(file, 'utf8');
    for (const match of contents.matchAll(/['"](experimental[A-Za-z0-9]+)['"]/g)) {
      const key = match[1]!;
      const rel = path.relative(SRC, file).replace(/\\/g, '/');
      const files = found.get(key) ?? [];
      if (!files.includes(rel)) files.push(rel);
      found.set(key, files);
    }
  }
  return found;
}

describe('registry completeness', () => {
  it('registers every experimental flag the source code references', () => {
    const referenced = referencedFlagKeys();
    const registered = new Set(Object.keys(DEFAULT_FEATURE_FLAGS));

    const unregistered = [...referenced.entries()]
      .filter(([key]) => !registered.has(key))
      .map(([key, files]) => `${key} (referenced in ${files.join(', ')})`);

    expect(
      unregistered,
      'Flags gate code but are missing from DEFAULT_FEATURE_FLAGS. ' +
        'An unregistered flag still defaults to false, but no consumer can ' +
        'discover it and diagnostics will not report its state.',
    ).toEqual([]);
  });

  it('includes the vault lock flag that previously drifted', () => {
    // Regression guard for the specific gap this issue closes.
    expect(DEFAULT_FEATURE_FLAGS).toHaveProperty('experimentalVaultLocks');
    expect(referencedFlagKeys().has('experimentalVaultLocks')).toBe(true);
  });
});

describe('safe defaults', () => {
  it('defaults every registered flag to false', () => {
    for (const [key, value] of Object.entries(DEFAULT_FEATURE_FLAGS)) {
      expect(value, `${key} must be disabled by default`).toBe(false);
    }
  });

  it('reports an unregistered flag as disabled rather than throwing', () => {
    // An unknown key resolves to false, which is why the drift was silent.
    expect(isFeatureEnabled('experimentalSomethingNobodyRegistered')).toBe(false);
  });

  it('resolves a registered flag as disabled unless enabled explicitly', () => {
    expect(isFeatureEnabled('experimentalVaultLocks')).toBe(false);
    expect(
      isFeatureEnabled('experimentalVaultLocks', {
        featureFlags: { experimentalVaultLocks: true },
      }),
    ).toBe(true);
  });
});

describe('documentation matches the registry', () => {
  it('documents every registered flag in docs/feature-flags.md', () => {
    const docs = fs.readFileSync(
      path.resolve(__dirname, '..', 'docs', 'feature-flags.md'),
      'utf8',
    );

    const undocumented = Object.keys(DEFAULT_FEATURE_FLAGS).filter(
      (key) => !docs.includes(`\`${key}\``),
    );

    expect(
      undocumented,
      'Registered flags missing from the documented table.',
    ).toEqual([]);
  });
});

describe('registered flags that gate nothing are declared as reserved', () => {
  it('lists which registered flags have no reference in src/', () => {
    // Not a failure: a reserved key is a legitimate placeholder, and removing
    // one would be a breaking change to a published union. It is documented
    // rather than silently implying a capability that does not exist — the same
    // reasoning the capability registry applies to `planned` entries.
    const referenced = referencedFlagKeys();
    const reserved = Object.keys(DEFAULT_FEATURE_FLAGS).filter(
      (key) => !referenced.has(key),
    );

    const docs = fs.readFileSync(
      path.resolve(__dirname, '..', 'docs', 'feature-flags.md'),
      'utf8',
    );

    for (const key of reserved) {
      expect(
        docs.includes(`\`${key}\``) && /Reserved/i.test(docs),
        `${key} gates no code path and must be marked Reserved in the docs`,
      ).toBe(true);
    }
  });
});
