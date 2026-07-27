/**
 * Signer Capability Architecture — acceptance tests
 *
 * Covers the capability-checked orchestration added on top of the existing
 * account abstraction layer (src/account, src/transactions/offline-preparation.ts):
 *
 *  1. Read-only account → signing is rejected with a typed error BEFORE any
 *     signer is invoked (TX_SIGNER_MISSING).
 *  2. Local signer → signing/submission preparation behaves identically to
 *     the pre-existing raw-secret path (compatibility regression).
 *  3. Wrong signer → a signer whose public key doesn't match the transaction
 *     source is rejected with a typed error (TX_SIGNER_MISMATCH).
 *  4. Unsupported capability → an external signer adapter that can't handle
 *     the request propagates a typed error unchanged through the
 *     orchestration, using the SDK's existing unsupported-feature/capability
 *     standard (`UnsupportedFeatureError` / `assertCapability` /
 *     `SDK_CAPABILITIES['signer.remote']` — src/errors/capabilities.ts,
 *     src/errors/unsupported.ts) rather than a signer-specific error code.
 *  5. Secret boundary → a read-only account (and the local signer/account
 *     that DOES hold a secret) never exposes secret material through any
 *     public surface: properties, JSON serialization, or error text.
 */

import { describe, it, expect } from 'vitest';
import * as StellarSDK from '@stellar/stellar-sdk';

import {
  createReadOnlyAccount,
  createLocalAccount,
  createAccountWithSigner,
  createLocalSigner,
  createWallet,
  canSignTransaction,
  prepareTransactionWithManualSequence,
  buildUnsignedTransaction,
  signTransaction,
  signTransactionWithSigner,
  signWithAccount,
  safeSignWithAccount,
  ErrorCode,
  PocketPayError,
  // Existing SDK capability standard (src/errors/capabilities.ts, src/errors/unsupported.ts) —
  // reused here rather than a signer-specific "unsupported" error code.
  assertCapability,
  isUnsupportedFeatureError,
  getCapability,
  type AccountAbstraction,
  type ExternalSignerAdapter,
  type UnsignedTransaction,
} from '../src';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SOURCE = StellarSDK.Keypair.random();
const SOURCE_SECRET = SOURCE.secret();
const SOURCE_PUBLIC = SOURCE.publicKey();

const OTHER = StellarSDK.Keypair.random();
const OTHER_SECRET = OTHER.secret();
const OTHER_PUBLIC = OTHER.publicKey();

const DESTINATION = StellarSDK.Keypair.random().publicKey();

/** Builds a fully-offline UnsignedTransaction — no network access required. */
function buildTestUnsignedTransaction(sourcePublicKey: string): UnsignedTransaction {
  const prepared = prepareTransactionWithManualSequence(
    {
      sourcePublicKey,
      operations: [{ destination: DESTINATION, amount: '10', asset: { code: 'XLM' } }],
    },
    '100',
  );
  return buildUnsignedTransaction(prepared);
}

// ─── 1. Read-only account: missing signer ────────────────────────────────────

describe('Read-only account — signing is rejected with a typed error', () => {
  it('canSignTransaction() returns false and narrows signer to undefined', () => {
    const readOnly = createReadOnlyAccount(SOURCE_PUBLIC);
    expect(canSignTransaction(readOnly)).toBe(false);
    if (!canSignTransaction(readOnly)) {
      expect(readOnly.signer).toBeUndefined();
    }
  });

  it('account.sign() rejects with PocketPayError TX_SIGNER_MISSING', async () => {
    const readOnly = createReadOnlyAccount(SOURCE_PUBLIC);
    const unsigned = buildTestUnsignedTransaction(SOURCE_PUBLIC);

    await expect(
      readOnly.sign(unsigned.transaction, unsigned.networkPassphrase),
    ).rejects.toMatchObject({
      code: ErrorCode.TX_SIGNER_MISSING,
    });
    await expect(
      readOnly.sign(unsigned.transaction, unsigned.networkPassphrase),
    ).rejects.toBeInstanceOf(PocketPayError);
  });

  it('signWithAccount() checks capability BEFORE signing and rejects read-only accounts', async () => {
    const readOnly = createReadOnlyAccount(SOURCE_PUBLIC);
    const unsigned = buildTestUnsignedTransaction(SOURCE_PUBLIC);

    await expect(signWithAccount(unsigned, readOnly)).rejects.toMatchObject({
      code: ErrorCode.TX_SIGNER_MISSING,
    });
  });

  it('safeSignWithAccount() returns a typed failure result instead of throwing', async () => {
    const readOnly = createReadOnlyAccount(SOURCE_PUBLIC);
    const unsigned = buildTestUnsignedTransaction(SOURCE_PUBLIC);

    const result = await safeSignWithAccount(unsigned, readOnly);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ErrorCode.TX_SIGNER_MISSING);
      expect(result.error).toBeInstanceOf(PocketPayError);
    }
  });

  it('createAccountWithSigner() without a signer is also read-only and rejects the same way', async () => {
    const readOnly = createAccountWithSigner({ publicKey: SOURCE_PUBLIC });
    expect(canSignTransaction(readOnly)).toBe(false);

    const unsigned = buildTestUnsignedTransaction(SOURCE_PUBLIC);
    await expect(signWithAccount(unsigned, readOnly)).rejects.toMatchObject({
      code: ErrorCode.TX_SIGNER_MISSING,
    });
  });
});

// ─── 2. Local signer: compatibility regression ───────────────────────────────

describe('Local signer — compatibility with the pre-existing signing paths', () => {
  it('canSignTransaction() narrows a local account to SigningAccount', () => {
    const account = createLocalAccount(SOURCE_SECRET);
    expect(canSignTransaction(account)).toBe(true);
    if (canSignTransaction(account)) {
      // No non-null assertion needed — TS already knows `signer` is `Signer`.
      expect(account.signer.publicKey).toBe(SOURCE_PUBLIC);
    }
  });

  it('signWithAccount() produces the same signed XDR as the pre-existing raw-secret signTransaction()', () => {
    const unsignedForRaw = buildTestUnsignedTransaction(SOURCE_PUBLIC);
    const unsignedForAccount = buildTestUnsignedTransaction(SOURCE_PUBLIC);

    const viaRawSecret = signTransaction(unsignedForRaw, SOURCE_SECRET); // pre-existing path, untouched
    return signWithAccount(unsignedForAccount, createLocalAccount(SOURCE_SECRET)).then((viaAccount) => {
      expect(viaAccount.xdr).toBe(viaRawSecret.xdr);
      expect(viaAccount.hash).toBe(viaRawSecret.hash);
    });
  });

  it('signWithAccount() produces the same result as calling signTransactionWithSigner() directly', async () => {
    const account = createLocalAccount(SOURCE_SECRET);
    const unsignedA = buildTestUnsignedTransaction(SOURCE_PUBLIC);
    const unsignedB = buildTestUnsignedTransaction(SOURCE_PUBLIC);

    const viaAccount = await signWithAccount(unsignedA, account);
    const viaSignerDirect = await signTransactionWithSigner(unsignedB, createLocalSigner(SOURCE_SECRET));

    expect(viaAccount.xdr).toBe(viaSignerDirect.xdr);
    expect(viaAccount.hash).toBe(viaSignerDirect.hash);
  });

  it('createWallet()-derived secrets keep working end-to-end through the new path', async () => {
    const wallet = createWallet();
    const unsigned = buildTestUnsignedTransaction(wallet.publicKey);
    const account = createLocalAccount(wallet.secretKey);

    const signed = await signWithAccount(unsigned, account);
    expect(signed.transaction.signatures.length).toBe(1);
  });
});

// ─── 3. Wrong signer ──────────────────────────────────────────────────────────

describe('Wrong signer — signer does not correspond to the transaction source account', () => {
  it('signWithAccount() rejects with PocketPayError TX_SIGNER_MISMATCH', async () => {
    const wrongAccount = createLocalAccount(OTHER_SECRET); // signs as OTHER_PUBLIC
    const unsigned = buildTestUnsignedTransaction(SOURCE_PUBLIC); // tx source is SOURCE_PUBLIC

    await expect(signWithAccount(unsigned, wrongAccount)).rejects.toMatchObject({
      code: ErrorCode.TX_SIGNER_MISMATCH,
    });
  });

  it('signTransactionWithSigner() also rejects a mismatched signer directly', async () => {
    const wrongSigner = createLocalSigner(OTHER_SECRET);
    const unsigned = buildTestUnsignedTransaction(SOURCE_PUBLIC);

    await expect(signTransactionWithSigner(unsigned, wrongSigner)).rejects.toMatchObject({
      code: ErrorCode.TX_SIGNER_MISMATCH,
    });
  });

  it('safeSignWithAccount() surfaces TX_SIGNER_MISMATCH as a typed failure result', async () => {
    const wrongAccount = createLocalAccount(OTHER_SECRET);
    const unsigned = buildTestUnsignedTransaction(SOURCE_PUBLIC);

    const result = await safeSignWithAccount(unsigned, wrongAccount);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ErrorCode.TX_SIGNER_MISMATCH);
    }
  });
});

// ─── 4. Unsupported capability / external signer adapter contract ───────────

describe('External signer adapter contract — unsupported capability', () => {
  it("'signer.remote' is registered in the SDK capability registry, covering external adapters", () => {
    const spec = getCapability('signer.remote');
    expect(spec).toBeDefined();
    expect(spec?.status).toBe('planned');
    expect(spec?.module).toBe('account');
  });

  it('a stub object satisfying ExternalSignerAdapter plugs into createAccountWithSigner (the extension point)', () => {
    const stubAdapter: ExternalSignerAdapter = {
      kind: 'hardware',
      publicKey: SOURCE_PUBLIC,
      isAvailable: false,
      async sign(tx) {
        return tx;
      },
    };

    const account: AccountAbstraction = createAccountWithSigner({ publicKey: SOURCE_PUBLIC }, stubAdapter);
    expect(canSignTransaction(account)).toBe(true);
    expect(stubAdapter.isAvailable).toBe(false);
    expect(stubAdapter.kind).toBe('hardware');
  });

  it("assertCapability('signer.remote', false, ...) throws UnsupportedFeatureError, per the SDK's existing capability standard", () => {
    let caught: unknown;
    try {
      assertCapability('signer.remote', false, { module: 'account', operation: 'sign' });
    } catch (err) {
      caught = err;
    }

    expect(isUnsupportedFeatureError(caught)).toBe(true);
    expect(caught).toBeInstanceOf(PocketPayError);
    expect((caught as PocketPayError).code).toBe(ErrorCode.SDK_NOT_IMPLEMENTED);
  });

  it('an unavailable external adapter propagates UnsupportedFeatureError through signWithAccount unchanged', async () => {
    const unavailableAdapter: ExternalSignerAdapter = {
      kind: 'mobile',
      publicKey: SOURCE_PUBLIC,
      isAvailable: false,
      async sign(): Promise<never> {
        // This is how a real (future) adapter should report itself as
        // unsupported: reuse the SDK's existing unsupported-feature standard
        // instead of a signer-specific error code.
        assertCapability('signer.remote', false, { module: 'account', operation: 'sign' });
        throw new Error('unreachable'); // assertCapability always throws when available is false
      },
    };

    const account = createAccountWithSigner({ publicKey: SOURCE_PUBLIC }, unavailableAdapter);
    const unsigned = buildTestUnsignedTransaction(SOURCE_PUBLIC);

    const error = await signWithAccount(unsigned, account).catch((err) => err);

    // signWithAccount does not catch, wrap, or reinterpret the adapter's error.
    expect(isUnsupportedFeatureError(error)).toBe(true);
    expect(error.code).toBe(ErrorCode.SDK_NOT_IMPLEMENTED);
  });
});

// ─── 5. Secret boundary ────────────────────────────────────────────────────────

describe('Secret boundary — no public surface exposes secret material', () => {
  it('a read-only account exposes no secret-shaped property, own key, or serialized value', () => {
    const readOnly = createReadOnlyAccount(SOURCE_PUBLIC);

    expect((readOnly as any).secretKey).toBeUndefined();
    expect((readOnly as any).secret).toBeUndefined();
    expect(Object.keys(readOnly as object)).not.toContain('secretKey');

    const serialized = JSON.stringify(readOnly);
    expect(serialized).not.toMatch(/S[A-Za-z0-9]{55}/); // Stellar secret key shape
    expect(serialized?.toLowerCase()).not.toContain('secret');
  });

  it('the TX_SIGNER_MISSING error thrown for a read-only account never contains the underlying secret', async () => {
    const wallet = createWallet();
    const readOnly = createReadOnlyAccount(wallet.publicKey);
    const unsigned = buildTestUnsignedTransaction(wallet.publicKey);

    const error = await signWithAccount(unsigned, readOnly).catch((err) => err);

    expect(error).toBeInstanceOf(PocketPayError);
    const pocketErr = error as PocketPayError;
    expect(pocketErr.message).not.toContain(wallet.secretKey);
    expect(pocketErr.safeMessage ?? '').not.toContain(wallet.secretKey);
    expect(JSON.stringify(pocketErr)).not.toContain(wallet.secretKey);
  });

  it('a SigningAccount (local signer) never exposes its secret via own properties or JSON serialization', () => {
    const wallet = createWallet();
    const account = createLocalAccount(wallet.secretKey);

    // Own-property scan: no field anywhere on the account carries the raw secret.
    for (const key of Object.keys(account as object)) {
      const value = (account as any)[key];
      if (typeof value === 'string') {
        expect(value).not.toContain(wallet.secretKey);
      }
    }

    // JSON.stringify must not leak the secret — including the raw key bytes
    // the underlying @stellar/stellar-sdk Keypair stores internally.
    const serialized = JSON.stringify(account);
    expect(serialized).not.toContain(wallet.secretKey);
    expect(serialized).not.toMatch(/"_secretSeed"|"_secretKey"/);
  });

  it('LocalSigner in isolation never exposes its secret via own properties or JSON serialization', () => {
    const signer = createLocalSigner(SOURCE_SECRET);

    expect((signer as any).secretKey).toBeUndefined();
    expect((signer as any).secret).toBeUndefined();

    const serialized = JSON.stringify(signer);
    expect(serialized).not.toContain(SOURCE_SECRET);
    expect(serialized).not.toMatch(/"_secretSeed"|"_secretKey"/);
    expect(serialized).toBe(JSON.stringify({ publicKey: SOURCE_PUBLIC }));
  });
});
