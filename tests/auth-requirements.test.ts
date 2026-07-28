/**
 * Transaction authorisation requirement tests (issue #248).
 *
 * The data was already reaching the SDK on both sides and being discarded on
 * both: Horizon returns `signers` and `thresholds` on every account load and
 * nothing in `src/` read either, while Soroban's simulation returns
 * `result.auth` and `client-factory.ts` read only `result.retval`.
 */

import { describe, it, expect } from 'vitest';
import * as StellarSDK from '@stellar/stellar-sdk';
import {
  mapAuthRequirements,
  identifyPresentSigners,
  assertAuthFullyMapped,
  toAuthAccountState,
} from '../src/transactions';
import type { AuthAccountState } from '../src/types';
import { UnsupportedFeatureError, ErrorCode } from '../src/errors';

const NETWORK = StellarSDK.Networks.TESTNET;

const master = StellarSDK.Keypair.random();
const cosigner = StellarSDK.Keypair.random();
const stranger = StellarSDK.Keypair.random();
const destination = StellarSDK.Keypair.random().publicKey();

/** Builds a transaction with the given operations, unsigned. */
function build(operations: StellarSDK.xdr.Operation[]): StellarSDK.Transaction {
  const account = new StellarSDK.Account(master.publicKey(), '100');
  const builder = new StellarSDK.TransactionBuilder(account, {
    fee: StellarSDK.BASE_FEE,
    networkPassphrase: NETWORK,
  });
  for (const operation of operations) builder.addOperation(operation);
  return builder.setTimeout(30).build();
}

const payment = () =>
  StellarSDK.Operation.payment({
    destination,
    asset: StellarSDK.Asset.native(),
    amount: '10',
  });

/** A single-signer account: master weight 1, medium threshold 1. */
const singleSigner: AuthAccountState = {
  accountId: master.publicKey(),
  signers: [{ key: master.publicKey(), weight: 1, type: 'ed25519_public_key' }],
  thresholds: { low: 1, medium: 1, high: 1 },
};

/** A 2-of-2 multisig account: both signers weight 1, medium threshold 2. */
const multisig: AuthAccountState = {
  accountId: master.publicKey(),
  signers: [
    { key: master.publicKey(), weight: 1, type: 'ed25519_public_key' },
    { key: cosigner.publicKey(), weight: 1, type: 'ed25519_public_key' },
  ],
  thresholds: { low: 1, medium: 2, high: 2 },
};

describe('operation thresholds', () => {
  it('maps a payment to the medium threshold', () => {
    const summary = mapAuthRequirements(build([payment()]));
    expect(summary.highestThreshold).toBe('medium');
    expect(summary.requirements).toHaveLength(1);
    expect(summary.requirements[0].kind).toBe('account_signature');
    expect(summary.requirements[0].threshold).toBe('medium');
  });

  it('maps accountMerge to the high threshold', () => {
    const summary = mapAuthRequirements(
      build([StellarSDK.Operation.accountMerge({ destination })])
    );
    expect(summary.highestThreshold).toBe('high');
  });

  it('reports the strictest threshold across mixed operations', () => {
    const summary = mapAuthRequirements(
      build([payment(), StellarSDK.Operation.accountMerge({ destination })])
    );
    expect(summary.highestThreshold).toBe('high');
    // Each threshold level is grouped with the operations that raised it.
    const levels = summary.requirements.map((r) => r.threshold).sort();
    expect(levels).toEqual(['high', 'medium']);
  });

  it('treats setOptions as high only when it changes signing control', () => {
    const controlChange = mapAuthRequirements(
      build([StellarSDK.Operation.setOptions({ masterWeight: 2 })])
    );
    expect(controlChange.highestThreshold).toBe('high');

    const cosmetic = mapAuthRequirements(
      build([StellarSDK.Operation.setOptions({ homeDomain: 'example.com' })])
    );
    expect(cosmetic.highestThreshold).toBe('medium');
  });

  it('records the operation indexes that raised each requirement', () => {
    const summary = mapAuthRequirements(build([payment(), payment()]));
    expect(summary.requirements[0].operationIndexes).toEqual([0, 1]);
  });

  it('reports the transaction source account', () => {
    const summary = mapAuthRequirements(build([payment()]));
    expect(summary.sourceAccount).toBe(master.publicKey());
  });
});

describe('required signers, when account data is available', () => {
  it('resolves the required weight and eligible signers', () => {
    const summary = mapAuthRequirements(build([payment()]), { account: multisig });
    const requirement = summary.requirements[0];

    expect(requirement.requiredWeight).toBe(2);
    expect(requirement.eligibleSigners).toHaveLength(2);
    expect(requirement.eligibleSigners?.map((s) => s.key)).toContain(cosigner.publicKey());
  });

  it('omits weights when no account data is supplied', () => {
    // "identified where possible" — absent data must not become a guess.
    const summary = mapAuthRequirements(build([payment()]));
    expect(summary.requirements[0].requiredWeight).toBeUndefined();
    expect(summary.requirements[0].eligibleSigners).toBeUndefined();
    expect(summary.satisfied).toBeUndefined();
  });
});

describe('satisfaction is never guessed', () => {
  it('is satisfied when a single signer has signed', () => {
    const transaction = build([payment()]);
    transaction.sign(master);

    const summary = mapAuthRequirements(transaction, { account: singleSigner });
    expect(summary.presentSigners).toEqual([master.publicKey()]);
    expect(summary.satisfied).toBe(true);
    expect(summary.unmet).toEqual([]);
  });

  it('is unsatisfied when a 2-of-2 account has only one signature', () => {
    const transaction = build([payment()]);
    transaction.sign(master);

    const summary = mapAuthRequirements(transaction, { account: multisig });
    expect(summary.satisfied).toBe(false);
    expect(summary.unmet).toHaveLength(1);
    expect(summary.unmet?.[0].requiredWeight).toBe(2);
  });

  it('becomes satisfied once the cosigner signs', () => {
    const transaction = build([payment()]);
    transaction.sign(master, cosigner);

    const summary = mapAuthRequirements(transaction, { account: multisig });
    expect(summary.presentSigners).toHaveLength(2);
    expect(summary.satisfied).toBe(true);
  });

  it('ignores a signature from a key that is not an account signer', () => {
    const transaction = build([payment()]);
    transaction.sign(master, stranger);

    const summary = mapAuthRequirements(transaction, { account: multisig });
    // The stranger contributes no weight, so 2-of-2 is still unmet.
    expect(summary.presentSigners).not.toContain(stranger.publicKey());
    expect(summary.satisfied).toBe(false);
  });

  it('leaves satisfaction undefined rather than false when it cannot be judged', () => {
    const transaction = build([payment()]);
    transaction.sign(master);

    // No account data: the answer is unknown, and unknown must not read as
    // either approval or rejection.
    const summary = mapAuthRequirements(transaction);
    expect(summary.satisfied).toBeUndefined();
    expect(summary.unmet).toBeUndefined();
  });
});

describe('identifyPresentSigners', () => {
  it('finds a known signer by signature hint', () => {
    const transaction = build([payment()]);
    transaction.sign(master);

    expect(identifyPresentSigners(transaction, [master.publicKey()])).toEqual([
      master.publicKey(),
    ]);
  });

  it('returns nothing for an unsigned transaction', () => {
    expect(identifyPresentSigners(build([payment()]), [master.publicKey()])).toEqual([]);
  });

  it('ignores malformed candidate keys instead of failing', () => {
    const transaction = build([payment()]);
    transaction.sign(master);

    expect(identifyPresentSigners(transaction, ['not-a-key', master.publicKey()])).toEqual([
      master.publicKey(),
    ]);
  });

  it('never exposes secret material', () => {
    const transaction = build([payment()]);
    transaction.sign(master);

    const summary = mapAuthRequirements(transaction, { account: singleSigner });
    const serialised = JSON.stringify(summary);

    expect(serialised).not.toContain(master.secret());
    expect(serialised).not.toMatch(/\bS[A-Z2-7]{55}\b/);
  });
});

describe('unsupported auth cases return clear errors', () => {
  it('records an unclassified operation rather than guessing a threshold', () => {
    const transaction = build([payment()]);
    // Force an operation type the mapper does not know.
    (transaction.operations[0] as { type: string }).type = 'someFutureOperation';

    const summary = mapAuthRequirements(transaction);
    expect(summary.unsupportedOperations).toEqual(['someFutureOperation']);
    expect(summary.requirements).toHaveLength(0);
    expect(summary.highestThreshold).toBeUndefined();
  });

  it('never reports satisfied when an operation went unclassified', () => {
    const transaction = build([payment()]);
    (transaction.operations[0] as { type: string }).type = 'someFutureOperation';
    transaction.sign(master);

    const summary = mapAuthRequirements(transaction, { account: singleSigner });
    expect(summary.satisfied).toBeUndefined();
  });

  it('assertAuthFullyMapped throws the standard unsupported-feature error', () => {
    const transaction = build([payment()]);
    (transaction.operations[0] as { type: string }).type = 'someFutureOperation';

    const summary = mapAuthRequirements(transaction);
    let caught: UnsupportedFeatureError | undefined;
    try {
      assertAuthFullyMapped(summary);
    } catch (error) {
      caught = error as UnsupportedFeatureError;
    }

    expect(caught).toBeInstanceOf(UnsupportedFeatureError);
    expect(caught?.code).toBe(ErrorCode.SDK_NOT_IMPLEMENTED);
    expect(caught?.module).toBe('transactions');
    expect(caught?.capability).toContain('someFutureOperation');
  });

  it('assertAuthFullyMapped is a no-op for a fully mapped transaction', () => {
    const summary = mapAuthRequirements(build([payment()]));
    expect(() => assertAuthFullyMapped(summary)).not.toThrow();
  });
});

describe('toAuthAccountState', () => {
  it('reads signers and thresholds from a Horizon account record', () => {
    const state = toAuthAccountState({
      accountId: () => master.publicKey(),
      signers: [{ key: master.publicKey(), weight: 1, type: 'ed25519_public_key' }],
      thresholds: { low_threshold: 0, med_threshold: 2, high_threshold: 3 },
    });

    expect(state.accountId).toBe(master.publicKey());
    expect(state.thresholds).toEqual({ low: 0, medium: 2, high: 3 });
    expect(state.signers[0].weight).toBe(1);
  });

  it('defaults missing thresholds to zero rather than assuming', () => {
    const state = toAuthAccountState({ account_id: master.publicKey() });
    expect(state.thresholds).toEqual({ low: 0, medium: 0, high: 0 });
    expect(state.signers).toEqual([]);
  });
});
