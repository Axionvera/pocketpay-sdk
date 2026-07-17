/**
 * Tests for the package root export surface.
 *
 * These tests exist to catch accidental changes to the public API:
 * - Every documented helper must be importable from the package root.
 * - Internal-only helpers must NOT leak out of the root.
 */

import { describe, it, expect } from 'vitest';
import * as PocketPay from '../src';

const EXPECTED_PUBLIC_EXPORTS = [
  // errors
  'PocketPayError',
  // wallet
  'createWallet',
  'importWallet',
  'getPublicKey',
  'getBalance',
  'fundTestnetAccount',
  // payments
  'sendXLM',
  // transactions
  'getTransactions',
  'getPayments',
  // soroban vault
  'depositToVault',
  'withdrawFromVault',
  'getVaultBalance',
  // config
  'resolveConfig',
  'getHorizonServer',
  'getNetworkPassphrase',
  'getFriendbotUrl',
  // utils
  'validatePublicKey',
  'validateSecretKey',
  'validateAmount',
  'stroopsToXLM',
  'xlmToStroops',
  'truncateAddress',
];

// Helpers that exist internally (e.g. in src/utils) but should never be
// exposed on the package root, since they're implementation details.
const INTERNAL_ONLY = ['wrapError', 'sleep'];

describe('Package root exports', () => {
  it('exposes every documented public helper from the package root', () => {
    for (const name of EXPECTED_PUBLIC_EXPORTS) {
      expect(
        (PocketPay as Record<string, unknown>)[name],
        `expected "${name}" to be exported from the package root`
      ).toBeDefined();
    }
  });

  it('does not expose internal-only helpers from the package root', () => {
    for (const name of INTERNAL_ONLY) {
      expect(
        (PocketPay as Record<string, unknown>)[name],
        `"${name}" is an internal helper and should not be exported from the package root`
      ).toBeUndefined();
    }
  });

  it('does not export anything beyond the documented public surface', () => {
    const actualExports = Object.keys(PocketPay);
    const unexpected = actualExports.filter(
      (name) => !EXPECTED_PUBLIC_EXPORTS.includes(name)
    );
    expect(
      unexpected,
      `unexpected exports found on package root: ${unexpected.join(', ')}`
    ).toEqual([]);
  });
});
