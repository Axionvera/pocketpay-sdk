/**
 * Unsupported feature and capability error standard tests.
 *
 * Covers the two standard error types, the capability registry, and the
 * config-gated vault path — including a direct regression test for the bug
 * this work fixes: the vault used to throw a code outside the published
 * registry, so `describeError()` fell through to "An unexpected error
 * occurred." for what was really a missing capability.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as StellarSDK from '@stellar/stellar-sdk';
import {
  UnsupportedFeatureError,
  CapabilityMismatchError,
  isUnsupportedFeatureError,
  isCapabilityMismatchError,
  SDK_CAPABILITIES,
  getCapability,
  listCapabilities,
  assertCapability,
  ErrorCode,
  ErrorCategory,
  ERROR_CODES,
  isKnownErrorCode,
  describeError,
  redactError,
} from '../src/errors';
import { PocketPayError } from '../src/types';
import { depositToVault, withdrawFromVault, getVaultBalance } from '../src/soroban';
import { fundTestnetAccount } from '../src/wallet';

/** A syntactically valid Soroban contract ID (56 chars, base32, C-prefixed). */
const VALID_CONTRACT_ID = 'C' + 'A'.repeat(55);

/** Env vars that can satisfy the vault capability; cleared per test. */
const CONTRACT_ENV_VARS = ['VAULT_CONTRACT_ID', 'STELLAR_CONTRACT_ID'] as const;

let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  // The vault capability reads process.env, so an ambient value in the
  // developer's shell would otherwise decide whether these tests pass.
  savedEnv = {};
  for (const key of CONTRACT_ENV_VARS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of CONTRACT_ENV_VARS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe('UnsupportedFeatureError', () => {
  const build = () =>
    new UnsupportedFeatureError({
      module: 'soroban',
      operation: 'encodeParams',
      capability: 'soroban.param-type.vec',
    });

  it('uses the published SDK_NOT_IMPLEMENTED code', () => {
    const err = build();
    expect(err.code).toBe(ErrorCode.SDK_NOT_IMPLEMENTED);
    expect(isKnownErrorCode(err.code)).toBe(true);
    expect(describeError(err.code).known).toBe(true);
  });

  it('carries module, operation and capability metadata', () => {
    const err = build();
    expect(err.module).toBe('soroban');
    expect(err.operation).toBe('encodeParams');
    expect(err.capability).toBe('soroban.param-type.vec');
  });

  it('sources the suggested next step from the registry', () => {
    const err = build();
    expect(err.suggestedNextStep).toBe(ERROR_CODES[ErrorCode.SDK_NOT_IMPLEMENTED].developerHint);
    expect(err.suggestedNextStep).toBe(describeError(err.code).developerHint);
  });

  it('keeps its own prototype and name after super()', () => {
    // PocketPayError's constructor ends with
    // Object.setPrototypeOf(this, PocketPayError.prototype), which silently
    // breaks subclass instanceof unless the subclass restores its prototype.
    const err = build();
    expect(err instanceof UnsupportedFeatureError).toBe(true);
    expect(err.name).toBe('UnsupportedFeatureError');
    expect(isUnsupportedFeatureError(err)).toBe(true);
  });

  it('remains a PocketPayError so existing catch blocks still work', () => {
    const err = build();
    expect(err instanceof PocketPayError).toBe(true);
    expect(err instanceof Error).toBe(true);
    expect(err.category).toBe(ErrorCategory.SDK);
    expect(err.safeMessage).toBe(ERROR_CODES[ErrorCode.SDK_NOT_IMPLEMENTED].safeMessage);
  });

  it('exposes a log-safe structured view via toJSON', () => {
    const json = build().toJSON();
    expect(json).toMatchObject({
      name: 'UnsupportedFeatureError',
      code: ErrorCode.SDK_NOT_IMPLEMENTED,
      module: 'soroban',
      operation: 'encodeParams',
      capability: 'soroban.param-type.vec',
    });
    expect(json.suggestedNextStep).toBeTruthy();
  });
});

describe('CapabilityMismatchError', () => {
  const build = () =>
    new CapabilityMismatchError({
      code: ErrorCode.VAULT_CONTRACT_NOT_CONFIGURED,
      module: 'vault',
      operation: 'deposit',
      capability: 'vault.contract',
    });

  it('uses the injected registry code and matching category', () => {
    const err = build();
    expect(err.code).toBe(ErrorCode.VAULT_CONTRACT_NOT_CONFIGURED);
    expect(err.category).toBe(ErrorCategory.Vault);
    expect(isKnownErrorCode(err.code)).toBe(true);
  });

  it('keeps its own prototype and stays a PocketPayError', () => {
    const err = build();
    expect(err instanceof CapabilityMismatchError).toBe(true);
    expect(err instanceof PocketPayError).toBe(true);
    expect(err.name).toBe('CapabilityMismatchError');
    expect(isCapabilityMismatchError(err)).toBe(true);
    // The two standard errors must stay distinguishable from each other.
    expect(isUnsupportedFeatureError(err)).toBe(false);
  });
});

describe('capability registry', () => {
  it('classifies the vault contract as config-gated', () => {
    const spec = getCapability('vault.contract');
    expect(spec?.status).toBe('config-gated');
    expect(spec?.module).toBe('vault');
    expect(spec?.requires).toContain('SDKConfig.contractId');
  });

  it('lists capabilities by status', () => {
    expect(listCapabilities('config-gated')).toContain('vault.contract');
    expect(listCapabilities('unsupported')).toContain('soroban.param-type.vec');
    expect(listCapabilities().length).toBe(Object.keys(SDK_CAPABILITIES).length);
  });

  it('returns undefined for unclassified capabilities', () => {
    expect(getCapability('nope.not.a.capability')).toBeUndefined();
  });

  it('distinguishes planned from supported signer capabilities', () => {
    // The Signer interface is async specifically so remote signers can replace
    // LocalSigner (src/account/signer.ts), but only the local one ships.
    expect(getCapability('signer.local')?.status).toBe('supported');
    expect(getCapability('signer.remote')?.status).toBe('planned');
    expect(listCapabilities('supported')).toContain('signer.local');
    expect(listCapabilities('planned')).toContain('signer.remote');
  });

  it('assertCapability raises UnsupportedFeatureError for planned capabilities', () => {
    expect(() =>
      assertCapability('signer.remote', false, { module: 'account', operation: 'sign' })
    ).toThrow(UnsupportedFeatureError);
  });

  it('assertCapability is a no-op when the capability is available', () => {
    expect(() =>
      assertCapability('vault.contract', true, { module: 'vault', operation: 'deposit' })
    ).not.toThrow();
  });

  it('assertCapability raises UnsupportedFeatureError for unsupported capabilities', () => {
    expect(() =>
      assertCapability('soroban.param-type.vec', false, {
        module: 'soroban',
        operation: 'encodeParams',
      })
    ).toThrow(UnsupportedFeatureError);
  });

  it('assertCapability raises CapabilityMismatchError for gated capabilities', () => {
    expect(() =>
      assertCapability('vault.contract', false, { module: 'vault', operation: 'deposit' }, {
        code: ErrorCode.VAULT_CONTRACT_NOT_CONFIGURED,
      })
    ).toThrow(CapabilityMismatchError);
  });

  it("documents 'vec' as unsupported because the Stellar SDK rejects it", () => {
    // Regression canary: if a future @stellar/stellar-sdk starts accepting
    // 'vec', this fails and the capability should be reclassified.
    expect(() => StellarSDK.nativeToScVal([1, 2], { type: 'vec' })).toThrow(/invalid type: vec/);
    expect(SDK_CAPABILITIES['soroban.param-type.vec'].status).toBe('unsupported');
  });
});

describe('vault capability gating (regression for the reported bug)', () => {
  const secret = () => StellarSDK.Keypair.random().secret();

  it('throws the standard error when no contract ID is configured anywhere', async () => {
    await expect(
      depositToVault({ sourceSecret: secret(), amount: '1' })
    ).rejects.toBeInstanceOf(CapabilityMismatchError);
  });

  it('reports a code the published standard recognises', async () => {
    // Before this change the vault threw the raw string 'MISSING_CONTRACT_ID',
    // which is absent from ERROR_CODES, so describeError() returned
    // known:false and the generic "An unexpected error occurred." message.
    const err = await depositToVault({ sourceSecret: secret(), amount: '1' }).catch((e) => e);

    expect(err.code).toBe(ErrorCode.VAULT_CONTRACT_NOT_CONFIGURED);
    expect(isKnownErrorCode(err.code)).toBe(true);

    const described = describeError(err.code);
    expect(described.known).toBe(true);
    expect(described.safeMessage).not.toBe('An unexpected error occurred.');
    expect(described.category).toBe(ErrorCategory.Vault);
  });

  it('attaches the module, operation and capability that failed', async () => {
    const err = await depositToVault({ sourceSecret: secret(), amount: '1' }).catch((e) => e);
    expect(err.module).toBe('vault');
    expect(err.operation).toBe('deposit');
    expect(err.capability).toBe('vault.contract');
    expect(err.suggestedNextStep).toBe(
      ERROR_CODES[ErrorCode.VAULT_CONTRACT_NOT_CONFIGURED].developerHint
    );
  });

  it('reports the operation that was actually attempted', async () => {
    const withdraw = await withdrawFromVault({ sourceSecret: secret(), amount: '1' }).catch((e) => e);
    expect(withdraw.operation).toBe('withdraw');

    const balance = await getVaultBalance({
      publicKey: StellarSDK.Keypair.random().publicKey(),
    }).catch((e) => e);
    expect(balance.operation).toBe('get_balance');
  });

  it('stays catchable as PocketPayError for existing consumers', async () => {
    const err = await depositToVault({ sourceSecret: secret(), amount: '1' }).catch((e) => e);
    expect(err).toBeInstanceOf(PocketPayError);
  });

  it('keeps the "contract ID" wording that mapSorobanContractError matches on', async () => {
    const err = await depositToVault({ sourceSecret: secret(), amount: '1' }).catch((e) => e);
    expect(err.message).toContain('contract ID');
  });

  it('redactError keeps the error log-safe and correctly classified', async () => {
    const err = await depositToVault({ sourceSecret: secret(), amount: '1' }).catch((e) => e);
    const safe = redactError(err);

    expect(safe.code).toBe(ErrorCode.VAULT_CONTRACT_NOT_CONFIGURED);
    expect(safe.category).toBe(ErrorCategory.Vault);
    expect(safe.retryable).toBe(false);
    expect(safe.safeMessage).toBe(
      ERROR_CODES[ErrorCode.VAULT_CONTRACT_NOT_CONFIGURED].safeMessage
    );
    expect(safe.message).not.toMatch(/S[A-Z2-7]{55}/);
  });

  it('accepts SDKConfig.contractId — the path the registry documents', async () => {
    // ERROR_CODES[VAULT_CONTRACT_NOT_CONFIGURED].developerHint tells integrators
    // to "Set SDKConfig.contractId before vault calls", but resolveContractId
    // never read it. Supplying it must no longer raise a capability error.
    const err = await depositToVault(
      { sourceSecret: secret(), amount: '1' },
      { contractId: VALID_CONTRACT_ID }
    ).catch((e) => e);

    expect(err).not.toBeInstanceOf(CapabilityMismatchError);
  });

  it('still honours the VAULT_CONTRACT_ID env var (backwards compatible)', async () => {
    process.env.VAULT_CONTRACT_ID = VALID_CONTRACT_ID;
    const err = await depositToVault({ sourceSecret: secret(), amount: '1' }).catch((e) => e);
    expect(err).not.toBeInstanceOf(CapabilityMismatchError);
  });

  it('accepts STELLAR_CONTRACT_ID, aligning with resolveConfig', async () => {
    process.env.STELLAR_CONTRACT_ID = VALID_CONTRACT_ID;
    const err = await depositToVault({ sourceSecret: secret(), amount: '1' }).catch((e) => e);
    expect(err).not.toBeInstanceOf(CapabilityMismatchError);
  });

  it('gives an explicit params.contractId precedence over everything else', async () => {
    process.env.VAULT_CONTRACT_ID = VALID_CONTRACT_ID;
    const err = await depositToVault(
      { sourceSecret: secret(), amount: '1', contractId: VALID_CONTRACT_ID },
      { contractId: VALID_CONTRACT_ID }
    ).catch((e) => e);
    expect(err).not.toBeInstanceOf(CapabilityMismatchError);
  });
});

describe('wallet testnet-funding capability', () => {
  const savedNetwork = process.env.STELLAR_NETWORK;

  afterEach(() => {
    if (savedNetwork === undefined) delete process.env.STELLAR_NETWORK;
    else process.env.STELLAR_NETWORK = savedNetwork;
  });

  it('reports a published code instead of the old unregistered string', async () => {
    process.env.STELLAR_NETWORK = 'mainnet';
    const err = await fundTestnetAccount(StellarSDK.Keypair.random().publicKey()).catch((e) => e);

    expect(err).toBeInstanceOf(CapabilityMismatchError);
    expect(err.code).toBe(ErrorCode.WALLET_TESTNET_ONLY);
    expect(isKnownErrorCode(err.code)).toBe(true);
    expect(describeError(err.code).known).toBe(true);
    expect(describeError(err.code).safeMessage).not.toBe('An unexpected error occurred.');
  });

  it('carries the wallet module, operation and capability', async () => {
    process.env.STELLAR_NETWORK = 'mainnet';
    const err = await fundTestnetAccount(StellarSDK.Keypair.random().publicKey()).catch((e) => e);

    expect(err.module).toBe('wallet');
    expect(err.operation).toBe('fundTestnetAccount');
    expect(err.capability).toBe('wallet.testnet-funding');
    expect(err).toBeInstanceOf(PocketPayError);
  });

  it('classifies the capability as config-gated on the network', () => {
    const spec = getCapability('wallet.testnet-funding');
    expect(spec?.status).toBe('config-gated');
    expect(spec?.module).toBe('wallet');
    expect(spec?.requires).toContain('testnet');
  });
});

describe('messages avoid overpromising', () => {
  it('no registry entry promises a date or a future release', () => {
    const forbidden = /\b(coming soon|will be|shortly|next release|Q[1-4]\s*20\d{2}|20\d{2})\b/i;
    for (const spec of Object.values(ERROR_CODES)) {
      expect(spec.safeMessage).not.toMatch(forbidden);
      expect(spec.developerHint).not.toMatch(forbidden);
    }
  });

  it('no capability description promises a delivery date', () => {
    const forbidden = /\b(coming soon|will be|shortly|next release|Q[1-4]\s*20\d{2}|20\d{2})\b/i;
    for (const spec of Object.values(SDK_CAPABILITIES)) {
      expect(spec.description).not.toMatch(forbidden);
    }
  });

  it('unknown codes still fall back to SDK defaults', () => {
    // The new classes must not change how genuinely unknown codes behave.
    const described = describeError('TOTALLY_UNKNOWN');
    expect(described.known).toBe(false);
    expect(described.category).toBe(ErrorCategory.SDK);
  });
});
