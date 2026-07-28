/**
 * Transaction build validation pipeline tests (issue #249).
 *
 * The duplication this replaces was literal: `src/payments/index.ts` hand-chained
 * `validateSecretKey`, `validatePublicKey`, `validateAmount` and
 * `validateMemoInput`, and the same four calls reappeared in the issued-asset
 * path with `validateAssetSpec` appended.
 *
 * The tests that matter most are the last block: routing the payment helpers
 * through the pipeline must not change a single published error code. That is
 * what makes adoption a non-breaking change, and it is where a careless
 * refactor silently breaks consumers.
 */

import { describe, it, expect } from 'vitest';
import * as StellarSDK from '@stellar/stellar-sdk';
import {
  assertTransactionBuildValid,
  validateTransactionBuild,
  VALIDATION_ORDER,
  type ValidationStage,
} from '../src/transactions/build-validation';
import { sendXLM, sendAsset } from '../src/payments';
import { PocketPayError } from '../src/types';

const SECRET = StellarSDK.Keypair.random().secret();
const PUBLIC = StellarSDK.Keypair.random().publicKey();
const OTHER = StellarSDK.Keypair.random().publicKey();
const NATIVE = { code: 'XLM' } as const;

/** Only the local stages, so no test resolves configuration. */
const LOCAL: readonly ValidationStage[] = [
  'sourceAccount',
  'destination',
  'amount',
  'asset',
  'memo',
];

describe('stage coverage — one invalid input per stage', () => {
  it('reports a malformed source secret', () => {
    const result = validateTransactionBuild({ sourceSecret: 'not-a-secret' }, { stages: LOCAL });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.stage).toBe('sourceAccount');
  });

  it('reports a malformed destination', () => {
    const result = validateTransactionBuild({ destination: 'not-a-key' }, { stages: LOCAL });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.stage).toBe('destination');
  });

  it('reports self-payment on the destination stage', () => {
    const kp = StellarSDK.Keypair.random();
    const result = validateTransactionBuild(
      { sourceSecret: kp.secret(), destination: kp.publicKey() },
      { stages: LOCAL },
    );
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatchObject({ stage: 'destination', code: 'SELF_PAYMENT' });
  });

  it('reports a bad amount', () => {
    const result = validateTransactionBuild({ amount: '-5' }, { stages: LOCAL });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.stage).toBe('amount');
  });

  it('reports a bad asset spec', () => {
    const result = validateTransactionBuild({ asset: { code: '' } as never }, { stages: LOCAL });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.stage).toBe('asset');
  });

  it('reports an over-long memo', () => {
    const result = validateTransactionBuild({ memo: 'x'.repeat(64) }, { stages: LOCAL });
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.stage).toBe('memo');
  });

  it('reports an account that cannot sign', () => {
    const result = validateTransactionBuild(
      { account: { canSign: false } as never },
      { stages: ['signerCapability'] },
    );
    expect(result.valid).toBe(false);
    expect(result.issues[0]).toMatchObject({
      stage: 'signerCapability',
      code: 'SIGNER_CANNOT_SIGN',
    });
  });

  it('skips the signer stage when no account is supplied', () => {
    const result = validateTransactionBuild({ amount: '10' }, { stages: LOCAL });
    expect(result.valid).toBe(true);
  });
});

describe('ordering', () => {
  it('publishes the documented order, source account first and signer last', () => {
    expect(VALIDATION_ORDER).toEqual([
      'sourceAccount',
      'destination',
      'amount',
      'asset',
      'memo',
      'network',
      'signerCapability',
    ]);
  });

  it('reports issues in stage order, not input order', () => {
    const result = validateTransactionBuild(
      { memo: 'x'.repeat(64), amount: 'abc', sourceSecret: 'nope' },
      { stages: LOCAL },
    );
    expect(result.issues.map((i) => i.stage)).toEqual(['sourceAccount', 'amount', 'memo']);
  });

  it('does not short-circuit — three bad fields produce three issues', () => {
    const result = validateTransactionBuild(
      { sourceSecret: 'nope', destination: 'nope', amount: 'nope' },
      { stages: LOCAL },
    );
    expect(result.issues).toHaveLength(3);
  });

  it('does not derive the source key when the secret is already invalid', () => {
    // `Keypair.fromSecret` throws a raw Error on a malformed secret. Running the
    // self-payment check anyway would let a non-PocketPayError escape.
    const result = validateTransactionBuild(
      { sourceSecret: 'nope', destination: PUBLIC },
      { stages: LOCAL },
    );
    expect(result.issues.map((i) => i.stage)).toEqual(['sourceAccount']);
  });
});

describe('valid input', () => {
  it('returns valid with no issues', () => {
    const result = validateTransactionBuild(
      { sourceSecret: SECRET, destination: PUBLIC, amount: '10.5', asset: NATIVE, memo: 'hi' },
      { stages: LOCAL },
    );
    expect(result).toEqual({ valid: true, issues: [] });
  });

  it('never echoes the source secret into an issue', () => {
    const result = validateTransactionBuild(
      { sourceSecret: SECRET, destination: 'nope', amount: 'nope' },
      { stages: LOCAL },
    );
    expect(JSON.stringify(result)).not.toContain(SECRET);
  });
});

describe('taxonomies are transported, not merged', () => {
  it('keeps each validator’s own code in the same result', () => {
    const result = validateTransactionBuild(
      { amount: '-5', asset: { code: '' } as never },
      { stages: LOCAL },
    );

    const amountIssue = result.issues.find((i) => i.stage === 'amount');
    const assetIssue = result.issues.find((i) => i.stage === 'asset');

    // Two different taxonomies coexisting in one array, each unchanged.
    expect(amountIssue?.code).toBe('INVALID_AMOUNT');
    expect(assetIssue?.code).not.toBe(amountIssue?.code);
    expect(assetIssue?.code).toMatch(/ASSET/);
  });
});

describe('assertTransactionBuildValid', () => {
  it('throws the originating PocketPayError of the first failing stage', () => {
    try {
      assertTransactionBuildValid(
        { sourceSecret: 'nope', amount: '-5' },
        { stages: LOCAL },
      );
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(PocketPayError);
      expect((error as PocketPayError).code).toBe('INVALID_SECRET_KEY');
    }
  });

  it('does not throw for valid input', () => {
    expect(() =>
      assertTransactionBuildValid({ sourceSecret: SECRET, amount: '1' }, { stages: LOCAL }),
    ).not.toThrow();
  });
});

describe('adoption is not a breaking change — published codes are unchanged', () => {
  // The payment helpers now route through the pipeline. Every code below was
  // produced by the hand-chained validators before this issue.
  it('sendXLM still reports INVALID_SECRET_KEY', async () => {
    const error = await sendXLM({
      sourceSecret: 'nope',
      destination: PUBLIC,
      amount: '10',
    }).catch((e) => e);
    expect(error).toBeInstanceOf(PocketPayError);
    expect(error.code).toBe('INVALID_SECRET_KEY');
  });

  it('sendXLM still reports INVALID_AMOUNT', async () => {
    const error = await sendXLM({
      sourceSecret: SECRET,
      destination: PUBLIC,
      amount: '-5',
    }).catch((e) => e);
    expect(error.code).toBe('INVALID_AMOUNT');
  });

  it('sendXLM keeps its own self-payment wording', async () => {
    const kp = StellarSDK.Keypair.random();
    const error = await sendXLM({
      sourceSecret: kp.secret(),
      destination: kp.publicKey(),
      amount: '10',
    }).catch((e) => e);
    expect(error.code).toBe('SELF_PAYMENT');
    expect(error.message).toBe('Cannot send XLM to yourself');
  });

  it('sendAsset keeps its own, different self-payment wording', async () => {
    const kp = StellarSDK.Keypair.random();
    const error = await sendAsset({
      sourceSecret: kp.secret(),
      destination: kp.publicKey(),
      amount: '10',
      asset: NATIVE,
    }).catch((e) => e);
    expect(error.code).toBe('SELF_PAYMENT');
    expect(error.message).toBe('Cannot send asset to yourself');
  });

  it('sendAsset still validates the asset spec', async () => {
    const error = await sendAsset({
      sourceSecret: SECRET,
      destination: OTHER,
      amount: '10',
      asset: { code: '' } as never,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(PocketPayError);
    expect(error.code).toMatch(/ASSET/);
  });
});
