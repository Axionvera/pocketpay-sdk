/**
 * Account sequence and concurrent submission safety tests (issue #277).
 *
 * Two things were missing before this work:
 *
 *  1. No sequence layer — every build path loaded the source account
 *     independently, so concurrent intents on one account read the same
 *     sequence and produced conflicting envelopes.
 *  2. No way to type a stale sequence — `classifySubmitError` collapsed every
 *     `result_codes.transaction` into `TX_FAILED`, so `tx_bad_seq`, which is
 *     recoverable by rebuilding, looked identical to failures that are not.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as StellarSDK from '@stellar/stellar-sdk';
import {
  SequenceProvider,
  validateSequenceValue,
  isSequenceStale,
  DEFAULT_SEQUENCE_MAX_AGE_MS,
} from '../src/account';
import {
  classifySubmitError,
  requiresRebuild,
  isRetryableError,
  classifySubmissionOutcome,
  isSafeToRetry,
  ErrorCode,
  ErrorCategory,
  isKnownErrorCode,
  describeError,
} from '../src/errors';
import { PocketPayError } from '../src/types';
import { setHorizonServerFactory, resetHorizonServerFactory } from '../src/config';
import {
  updateWithNetworkState,
  isPreparedSequenceStale,
  buildUnsignedTransaction,
  prepareTransactionOffline,
} from '../src/transactions/offline-preparation';

const PUBLIC_KEY = StellarSDK.Keypair.random().publicKey();
const DESTINATION = StellarSDK.Keypair.random().publicKey();

/** Horizon result shape for a rejected transaction. */
const horizonReject = (transactionCode: string) => ({
  response: { status: 400, data: { extras: { result_codes: { transaction: transactionCode } } } },
});

/** Installs a mock Horizon whose loadAccount hands back an incrementing sequence. */
function mockHorizon(mode: 'advancing' | 'static' = 'advancing') {
  let current = 100n;
  const calls: string[] = [];

  setHorizonServerFactory(() => ({
    loadAccount: async (publicKey: string) => {
      calls.push(publicKey);
      // 'advancing' mimics other transactions consuming sequence numbers
      // between reads; 'static' mimics Horizon's real answer when nothing has
      // been submitted yet — every reader sees the same number.
      if (mode === 'advancing') current += 1n;
      return { accountId: () => publicKey, sequence: current.toString(), balances: [] };
    },
  }) as never);

  return { calls };
}

afterEach(() => {
  resetHorizonServerFactory();
  vi.useRealTimers();
});

describe('validateSequenceValue', () => {
  it('accepts decimal strings, numbers and bigints', () => {
    expect(validateSequenceValue('123')).toBe(true);
    expect(validateSequenceValue(123)).toBe(true);
    expect(validateSequenceValue(123n)).toBe(true);
    expect(validateSequenceValue('0')).toBe(true);
  });

  it('rejects malformed sequence values with a typed error', () => {
    for (const bad of ['', '  ', '-1', '1.5', 'abc', null, undefined, {}]) {
      const err = (() => {
        try {
          validateSequenceValue(bad as never);
        } catch (e) {
          return e as PocketPayError;
        }
        throw new Error(`expected "${String(bad)}" to be rejected`);
      })();
      expect(err.code).toBe(ErrorCode.TX_BAD_SEQUENCE);
      expect(err.validation?.field).toBe('sequence');
    }
  });
});

describe('isSequenceStale', () => {
  it('treats a just-read snapshot as fresh', () => {
    expect(isSequenceStale({ fetchedAt: 1_000 }, 5_000, 1_100)).toBe(false);
  });

  it('treats a snapshot past the threshold as stale', () => {
    expect(isSequenceStale({ fetchedAt: 1_000 }, 5_000, 6_500)).toBe(true);
  });

  it('defaults to the published max age', () => {
    const now = Date.now();
    expect(isSequenceStale({ fetchedAt: now - DEFAULT_SEQUENCE_MAX_AGE_MS - 1 })).toBe(true);
    expect(isSequenceStale({ fetchedAt: now })).toBe(false);
  });
});

describe('SequenceProvider caching', () => {
  beforeEach(() => resetHorizonServerFactory());

  it('reads once and serves the cached value while it is fresh', async () => {
    const { calls } = mockHorizon();
    const provider = new SequenceProvider();

    const first = await provider.get(PUBLIC_KEY);
    const second = await provider.get(PUBLIC_KEY);

    expect(calls).toHaveLength(1);
    expect(second.sequence).toBe(first.sequence);
    expect(second.fetchedAt).toBe(first.fetchedAt);
  });

  it('records when the sequence was read', async () => {
    mockHorizon();
    const provider = new SequenceProvider();
    const before = Date.now();
    const snapshot = await provider.get(PUBLIC_KEY);

    expect(snapshot.publicKey).toBe(PUBLIC_KEY);
    expect(snapshot.fetchedAt).toBeGreaterThanOrEqual(before);
  });

  it('refresh() bypasses the cache and returns newer state', async () => {
    const { calls } = mockHorizon();
    const provider = new SequenceProvider();

    const first = await provider.get(PUBLIC_KEY);
    const refreshed = await provider.refresh(PUBLIC_KEY);

    expect(calls).toHaveLength(2);
    expect(BigInt(refreshed.sequence)).toBeGreaterThan(BigInt(first.sequence));
  });

  it('invalidate() forces the next get() to re-read', async () => {
    const { calls } = mockHorizon();
    const provider = new SequenceProvider();

    await provider.get(PUBLIC_KEY);
    provider.invalidate(PUBLIC_KEY);
    await provider.get(PUBLIC_KEY);

    expect(calls).toHaveLength(2);
    expect(provider.peek(PUBLIC_KEY)).toBeDefined();
  });

  it('invalidate() with no argument clears every account', async () => {
    mockHorizon();
    const provider = new SequenceProvider();
    await provider.get(PUBLIC_KEY);
    await provider.get(DESTINATION);

    provider.invalidate();

    expect(provider.peek(PUBLIC_KEY)).toBeUndefined();
    expect(provider.peek(DESTINATION)).toBeUndefined();
  });

  it('maxAgeMs: 0 disables caching entirely', async () => {
    const { calls } = mockHorizon();
    const provider = new SequenceProvider({ maxAgeMs: 0 });

    await provider.get(PUBLIC_KEY);
    await provider.get(PUBLIC_KEY);

    expect(calls).toHaveLength(2);
  });

  it('re-reads once the cached value ages out', async () => {
    const { calls } = mockHorizon();
    const provider = new SequenceProvider({ maxAgeMs: 50 });

    await provider.get(PUBLIC_KEY);
    await new Promise((resolve) => setTimeout(resolve, 60));
    await provider.get(PUBLIC_KEY);

    expect(calls).toHaveLength(2);
  });

  it('loadAccount() returns a builder-ready account at the cached sequence', async () => {
    mockHorizon();
    const provider = new SequenceProvider();
    const snapshot = await provider.get(PUBLIC_KEY);
    const account = await provider.loadAccount(PUBLIC_KEY);

    expect(account.accountId()).toBe(PUBLIC_KEY);
    expect(account.sequenceNumber()).toBe(snapshot.sequence);
  });
});

describe('concurrent intents on one account', () => {
  it('without serialization, concurrent reads share one sequence', async () => {
    // Horizon reports the same sequence to both readers while neither has
    // submitted yet — this is the hazard the issue describes.
    mockHorizon('static');
    const provider = new SequenceProvider();

    // This documents the hazard the issue describes: both intents observe the
    // same value and would build conflicting envelopes.
    const [a, b] = await Promise.all([provider.get(PUBLIC_KEY), provider.get(PUBLIC_KEY)]);
    expect(a.sequence).toBe(b.sequence);
  });

  it('withSequence() serializes intents so each reads fresh state', async () => {
    mockHorizon();
    const provider = new SequenceProvider();
    const observed: string[] = [];

    await Promise.all([
      provider.withSequence(PUBLIC_KEY, async () => {
        observed.push((await provider.get(PUBLIC_KEY)).sequence);
      }),
      provider.withSequence(PUBLIC_KEY, async () => {
        observed.push((await provider.get(PUBLIC_KEY)).sequence);
      }),
    ]);

    expect(observed).toHaveLength(2);
    expect(observed[0]).not.toBe(observed[1]);
  });

  it('withSequence() runs tasks one at a time', async () => {
    mockHorizon();
    const provider = new SequenceProvider();
    const order: string[] = [];

    const task = (name: string) => async () => {
      order.push(`${name}:start`);
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push(`${name}:end`);
    };

    await Promise.all([
      provider.withSequence(PUBLIC_KEY, task('a')),
      provider.withSequence(PUBLIC_KEY, task('b')),
    ]);

    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('a failing intent does not cascade into the queued ones', async () => {
    mockHorizon();
    const provider = new SequenceProvider();

    const failing = provider.withSequence(PUBLIC_KEY, async () => {
      throw new Error('submission failed');
    });
    const following = provider.withSequence(PUBLIC_KEY, async () => 'ok');

    await expect(failing).rejects.toThrow('submission failed');
    await expect(following).resolves.toBe('ok');
  });

  it('does not serialize across different accounts', async () => {
    mockHorizon();
    const provider = new SequenceProvider();
    const order: string[] = [];

    await Promise.all([
      provider.withSequence(PUBLIC_KEY, async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        order.push('slow');
      }),
      provider.withSequence(DESTINATION, async () => {
        order.push('fast');
      }),
    ]);

    expect(order).toEqual(['fast', 'slow']);
  });

  it('invalidates the account after each serialized task', async () => {
    mockHorizon();
    const provider = new SequenceProvider();

    await provider.withSequence(PUBLIC_KEY, async () => {
      await provider.get(PUBLIC_KEY);
    });

    expect(provider.peek(PUBLIC_KEY)).toBeUndefined();
  });
});

describe('stale sequence classification', () => {
  it('maps tx_bad_seq to its own published code', () => {
    const err = classifySubmitError(horizonReject('tx_bad_seq'), 'abc');

    expect(err.code).toBe(ErrorCode.TX_BAD_SEQUENCE);
    expect(err.category).toBe(ErrorCategory.Transaction);
    expect(isKnownErrorCode(err.code)).toBe(true);
    expect(describeError(err.code).known).toBe(true);
    expect(err.transactionHash).toBe('abc');
  });

  it('leaves every other transaction result code on TX_FAILED', () => {
    for (const code of ['tx_insufficient_fee', 'tx_bad_auth', 'tx_no_source_account', 'tx_failed']) {
      expect(classifySubmitError(horizonReject(code)).code).toBe(ErrorCode.TX_FAILED);
    }
  });

  it('requiresRebuild is true only for a stale sequence', () => {
    expect(requiresRebuild(classifySubmitError(horizonReject('tx_bad_seq')))).toBe(true);
    expect(requiresRebuild(classifySubmitError(horizonReject('tx_insufficient_fee')))).toBe(false);
    expect(requiresRebuild(new Error('plain'))).toBe(false);
    expect(requiresRebuild(undefined)).toBe(false);
  });

  it('never reports a stale sequence as safe to resubmit', () => {
    // Resubmitting the same signed envelope can never succeed: its sequence is
    // spent. Marking it retryable would send consumers into a resubmit loop.
    const err = classifySubmitError(horizonReject('tx_bad_seq'));

    expect(err.retryable).toBe(false);
    expect(isRetryableError(err)).toBe(false);

    const outcome = classifySubmissionOutcome(err);
    expect(isSafeToRetry(outcome)).toBe(false);
    expect(outcome.kind).toBe('non_retryable_failure');
  });

  it('keeps the raw result code in the message for diagnostics', () => {
    expect(classifySubmitError(horizonReject('tx_bad_seq')).message).toContain('tx_bad_seq');
  });
});

describe('prepared transaction sequence freshness', () => {
  const params = {
    sourcePublicKey: PUBLIC_KEY,
    operations: [{ destination: DESTINATION, amount: '10', asset: { code: 'XLM' } }],
  };

  it('rejects a malformed manual sequence up front', () => {
    const prepared = prepareTransactionOffline(params);
    expect(() => updateWithNetworkState(prepared, { sequence: 'not-a-number' })).toThrow(
      PocketPayError
    );
  });

  it('reports a missing sequence with the published code', () => {
    const prepared = prepareTransactionOffline(params);
    try {
      updateWithNetworkState(prepared, { sequence: '' });
      throw new Error('expected a rejection');
    } catch (error) {
      expect((error as PocketPayError).code).toBe(ErrorCode.TX_BAD_SEQUENCE);
    }
  });

  it('treats a manual sequence as never stale — the caller owns freshness', () => {
    const prepared = updateWithNetworkState(prepareTransactionOffline(params), {
      sequence: '101',
    });
    expect(isPreparedSequenceStale(prepared, 1)).toBe(false);
  });

  it('flags a snapshot that has aged past the threshold', () => {
    const prepared = updateWithNetworkState(prepareTransactionOffline(params), {
      sequence: '101',
      fetchedAt: Date.now() - 60_000,
    });
    expect(isPreparedSequenceStale(prepared, 1_000)).toBe(true);
    expect(isPreparedSequenceStale(prepared, 120_000)).toBe(false);
  });

  it('builds a stale snapshot by default, preserving existing behaviour', () => {
    const prepared = updateWithNetworkState(prepareTransactionOffline(params), {
      sequence: '101',
      fetchedAt: Date.now() - 60_000,
    });
    expect(() => buildUnsignedTransaction(prepared)).not.toThrow();
  });

  it('rejects a stale snapshot when freshness is enforced', () => {
    const prepared = updateWithNetworkState(prepareTransactionOffline(params), {
      sequence: '101',
      fetchedAt: Date.now() - 60_000,
    });

    try {
      buildUnsignedTransaction(prepared, {
        enforceSequenceFreshness: true,
        maxSequenceAgeMs: 1_000,
      });
      throw new Error('expected a rejection');
    } catch (error) {
      expect((error as PocketPayError).code).toBe(ErrorCode.TX_BAD_SEQUENCE);
      expect((error as PocketPayError).validation?.reason).toBe('stale');
    }
  });

  it('builds a fresh snapshot even with enforcement on', () => {
    const prepared = updateWithNetworkState(prepareTransactionOffline(params), {
      sequence: '101',
      fetchedAt: Date.now(),
    });
    expect(() =>
      buildUnsignedTransaction(prepared, { enforceSequenceFreshness: true })
    ).not.toThrow();
  });
});
