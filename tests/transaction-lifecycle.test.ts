/**
 * Transaction lifecycle orchestrator tests (issue #305).
 *
 * The security claim of this issue is narrow and checkable: the SDK shipped
 * `submitTransactionIdempotently` with a single call site — `retry-policy.ts` —
 * while `sendXLM`, `sendAsset` and `submitSignedTransaction` submitted straight
 * to Horizon. A submission timeout on those paths surfaced as a failure even
 * though the signed envelope may already have reached the network.
 *
 * The regression test at the bottom is the one that matters: it fails if a
 * payment helper ever goes back to submitting unguarded.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as StellarSDK from '@stellar/stellar-sdk';
import {
  submitGuarded,
  reconcileSubmission,
  requiresStatusResolution,
} from '../src/transactions/orchestrator';
import { sendXLM } from '../src/payments';
import { PocketPayError, TransactionStatus } from '../src/types';
import type { LifecycleResult } from '../src/types';

function buildDummyTransaction(): StellarSDK.Transaction {
  const kp = StellarSDK.Keypair.random();
  const account = new StellarSDK.Account(kp.publicKey(), '100');
  const builder = new StellarSDK.TransactionBuilder(account, {
    fee: StellarSDK.BASE_FEE,
    networkPassphrase: StellarSDK.Networks.TESTNET,
  });
  builder.addOperation(
    StellarSDK.Operation.payment({
      destination: StellarSDK.Keypair.random().publicKey(),
      asset: StellarSDK.Asset.native(),
      amount: '10.0',
    }),
  );
  builder.setTimeout(30);
  const tx = builder.build();
  tx.sign(kp);
  return tx;
}

// ─── Stage 5: reconciliation ────────────────────────────────────────────────

describe('reconcileSubmission — the four outcomes the AC names', () => {
  const HASH = 'b'.repeat(64);

  it('reconciles a clean submission to confirmed / COMPLETED', () => {
    const result = reconcileSubmission(undefined, HASH);
    expect(result.state).toBe('confirmed');
    expect(result.status).toBe(TransactionStatus.COMPLETED);
    expect(result.actionRequired).toBe('none');
    expect(result.transactionHash).toBe(HASH);
  });

  it('reconciles a definitive rejection to rejected / FAILED', () => {
    const error = new PocketPayError('rejected', 'TX_BAD_SEQ', {
      safeMessage: 'The transaction was rejected.',
    });
    const result = reconcileSubmission(error, HASH);
    expect(result.state).toBe('rejected');
    expect(result.status).toBe(TransactionStatus.FAILED);
    expect(result.actionRequired).toBe('rebuild');
  });

  it('reconciles a gateway timeout to unresolved, NOT rejected', () => {
    // A 504 means the envelope may already be on-chain. Treating it as a
    // failure is what lets a caller pay twice.
    const result = reconcileSubmission({ response: { status: 504 } }, HASH);

    expect(result.state).toBe('unresolved');
    expect(result.state).not.toBe('rejected');
    expect(result.status).toBe(TransactionStatus.UNKNOWN);
    expect(result.status).not.toBe(TransactionStatus.FAILED);
    expect(result.actionRequired).toBe('poll');
  });

  it('reconciles a socket timeout to unresolved as well', () => {
    const result = reconcileSubmission({ code: 'ETIMEDOUT' }, HASH);
    expect(result.state).toBe('unresolved');
    expect(result.status).toBe(TransactionStatus.UNKNOWN);
  });

  it('flags unresolved results as needing status resolution, and nothing else', () => {
    const unresolved = reconcileSubmission({ response: { status: 504 } }, HASH);
    const confirmed = reconcileSubmission(undefined, HASH);

    expect(requiresStatusResolution(unresolved)).toBe(true);
    expect(requiresStatusResolution(confirmed)).toBe(false);
  });

  it('never carries a raw error or its internal message', () => {
    const error = new PocketPayError('internal horizon detail', 'TX_BAD_SEQ', {
      safeMessage: 'The transaction was rejected.',
    });
    const result: LifecycleResult = reconcileSubmission(error, HASH);

    expect(result).not.toHaveProperty('error');
    expect(JSON.stringify(result)).not.toContain('internal horizon detail');
    expect(result.failure).toEqual({
      code: 'TX_BAD_SEQ',
      safeMessage: 'The transaction was rejected.',
    });
  });
});

// ─── Stage 4: guarded submission ────────────────────────────────────────────

describe('submitGuarded', () => {
  let submitSpy: any;
  let mockCall: any;

  beforeEach(() => {
    submitSpy = vi.spyOn(StellarSDK.Horizon.Server.prototype, 'submitTransaction');
    mockCall = vi.fn();
    vi.spyOn(StellarSDK.Horizon.Server.prototype, 'transactions').mockReturnValue({
      transaction: vi.fn().mockReturnThis(),
      call: mockCall,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('confirms a successful submission without polling', async () => {
    const tx = buildDummyTransaction();
    const hash = tx.hash().toString('hex');
    submitSpy.mockResolvedValue({ hash, ledger: 12345 });

    const { result } = await submitGuarded(tx);

    expect(result.state).toBe('confirmed');
    expect(result.status).toBe(TransactionStatus.COMPLETED);
    expect(result.transactionHash).toBe(hash);
    expect(mockCall).not.toHaveBeenCalled();
  });

  it('polls instead of failing when the submission times out', async () => {
    const tx = buildDummyTransaction();
    const hash = tx.hash().toString('hex');

    submitSpy.mockRejectedValue({ response: { status: 504 }, message: 'Timeout' });
    mockCall.mockResolvedValue({ hash, successful: true, ledger: 999 });

    const { result } = await submitGuarded(tx);

    // The guard resolved the unknown status by asking Horizon, not by
    // resubmitting the envelope.
    expect(mockCall).toHaveBeenCalled();
    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(result.state).toBe('confirmed');
  });

  it('reports unresolved — never rejected — when polling cannot settle it', async () => {
    const tx = buildDummyTransaction();

    submitSpy.mockRejectedValue({ response: { status: 504 }, message: 'Timeout' });
    mockCall.mockRejectedValue({ response: { status: 404 } });

    const { result } = await submitGuarded(tx, { maxPollAttempts: 1, pollIntervalMs: 1 });

    expect(result.state).toBe('unresolved');
    expect(result.status).not.toBe(TransactionStatus.FAILED);
    expect(result.actionRequired).toBe('poll');
  });

  it('does not resubmit the envelope on an unknown status', async () => {
    const tx = buildDummyTransaction();

    submitSpy.mockRejectedValue({ response: { status: 504 }, message: 'Timeout' });
    mockCall.mockRejectedValue({ response: { status: 404 } });

    await submitGuarded(tx, { maxPollAttempts: 2, pollIntervalMs: 1 });

    // One submission attempt, no matter how many times we polled. Blind
    // resubmission is the duplicate-payment hazard this issue is about.
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });
});

// ─── The promised regression ────────────────────────────────────────────────

describe('payment helpers no longer submit unguarded', () => {
  let submitSpy: any;
  let mockCall: any;

  beforeEach(() => {
    const kp = StellarSDK.Keypair.random();
    vi.spyOn(StellarSDK.Horizon.Server.prototype, 'loadAccount').mockResolvedValue(
      new StellarSDK.Account(kp.publicKey(), '100') as any,
    );
    submitSpy = vi.spyOn(StellarSDK.Horizon.Server.prototype, 'submitTransaction');
    mockCall = vi.fn();
    vi.spyOn(StellarSDK.Horizon.Server.prototype, 'transactions').mockReturnValue({
      transaction: vi.fn().mockReturnThis(),
      call: mockCall,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sendXLM polls on a submission timeout instead of reporting failure', async () => {
    // Before #305 this call threw: `sendXLM` wrapped `server.submitTransaction`
    // in a timeout and had no polling path, so a 504 looked like a failed
    // payment even when the envelope had already reached Horizon.
    submitSpy.mockRejectedValue({ response: { status: 504 }, message: 'Timeout' });
    mockCall.mockResolvedValue({
      hash: 'c'.repeat(64),
      successful: true,
      ledger: 4242,
      fee_charged: '100',
      created_at: '2026-01-01T00:00:00Z',
    });

    const result = await sendXLM({
      sourceSecret: StellarSDK.Keypair.random().secret(),
      destination: StellarSDK.Keypair.random().publicKey(),
      amount: '10.0',
    });

    expect(mockCall).toHaveBeenCalled();
    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
  });

  it('sendXLM still surfaces a definitive rejection as an error', async () => {
    // The guard must not swallow real failures: a definitive rejection is
    // still an error, it is only the unknown case that changes.
    submitSpy.mockRejectedValue({
      response: { status: 400, data: { extras: { result_codes: { transaction: 'tx_bad_seq' } } } },
    });

    await expect(
      sendXLM({
        sourceSecret: StellarSDK.Keypair.random().secret(),
        destination: StellarSDK.Keypair.random().publicKey(),
        amount: '10.0',
      }),
    ).rejects.toThrow();

    expect(mockCall).not.toHaveBeenCalled();
  });
});
