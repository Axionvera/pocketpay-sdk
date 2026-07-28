/**
 * Payment receipt builder tests (issue #330).
 *
 * The four outcomes a receipt has to display are split across two SDK
 * taxonomies that do not line up: `SubmissionOutcome` (src/types/index.ts) has
 * four variants and no `pending`, while `SorobanInvocationStatus` has five and
 * no `unknown`. These tests pin the reconciliation into `TransactionStatus`,
 * and in particular pin the two mappings that are easy to get wrong:
 * `unknown_status` is not a failure, and neither is `retryable_failure`.
 */

import { describe, it, expect } from 'vitest';
import {
  buildPaymentReceipt,
  buildReceiptFromSubmission,
  buildReceiptFromSoroban,
} from '../src/payments';
import type { PaymentReceipt } from '../src/types';
import {
  PocketPayError,
  TransactionStatus,
  type SorobanInvocationResult,
  type SorobanInvocationStatus,
  type SubmissionOutcome,
} from '../src/types';
import { DIAGNOSTICS_SENSITIVE_KEYS } from '../src/diagnostics/types';

const HASH = 'a'.repeat(64);
const FIXED_NOW = () => new Date('2026-01-01T00:00:00.000Z');

/** Options that keep every test offline and deterministic. */
const BASE = { network: 'testnet' as const, now: FIXED_NOW };

function submissionError(code: string, safeMessage: string): PocketPayError {
  return new PocketPayError(`internal detail for ${code}`, code, { safeMessage });
}

describe('buildReceiptFromSubmission — one per SubmissionOutcome variant', () => {
  it('maps success to COMPLETED with nothing left to do', () => {
    const outcome: SubmissionOutcome = { kind: 'success', transactionHash: HASH };
    const receipt = buildReceiptFromSubmission(outcome, BASE);

    expect(receipt.status).toBe(TransactionStatus.COMPLETED);
    expect(receipt.actionRequired).toBe('none');
    expect(receipt.transactionHash).toBe(HASH);
    expect(receipt.failure).toBeUndefined();
    expect(receipt.source).toBe('submission');
  });

  it('maps non_retryable_failure to FAILED and asks for a rebuild', () => {
    const outcome: SubmissionOutcome = {
      kind: 'non_retryable_failure',
      error: submissionError('TX_BAD_SEQ', 'The transaction was rejected.'),
    };
    const receipt = buildReceiptFromSubmission(outcome, BASE);

    expect(receipt.status).toBe(TransactionStatus.FAILED);
    expect(receipt.actionRequired).toBe('rebuild');
    expect(receipt.failure).toEqual({
      code: 'TX_BAD_SEQ',
      safeMessage: 'The transaction was rejected.',
    });
  });

  it('maps retryable_failure to PENDING, not FAILED', () => {
    // The same signed envelope may still be resubmitted, so the attempt is
    // unresolved rather than rejected. Rendering it as FAILED would tell a
    // user their payment is dead when it is not.
    const outcome: SubmissionOutcome = {
      kind: 'retryable_failure',
      error: submissionError('NET_RATE_LIMITED', 'The network is busy.'),
      suggestedDelayMs: 2_000,
    };
    const receipt = buildReceiptFromSubmission(outcome, BASE);

    expect(receipt.status).toBe(TransactionStatus.PENDING);
    expect(receipt.status).not.toBe(TransactionStatus.FAILED);
    expect(receipt.actionRequired).toBe('retry');
  });

  it('maps unknown_status to UNKNOWN and asks the caller to poll', () => {
    const outcome: SubmissionOutcome = {
      kind: 'unknown_status',
      error: submissionError('TX_STATUS_UNKNOWN', 'The transaction status is unknown.'),
      transactionHash: HASH,
    };
    const receipt = buildReceiptFromSubmission(outcome, BASE);

    expect(receipt.status).toBe(TransactionStatus.UNKNOWN);
    expect(receipt.actionRequired).toBe('poll');
    expect(receipt.transactionHash).toBe(HASH);
  });
});

describe('unknown_status is never rendered as a failure — regression guard', () => {
  // This is the contract of the whole module. A submission timeout classifies
  // to unknown_status while the transaction may already be on-chain; showing
  // "failed" would tell someone a payment did not happen when it may have.
  it('never yields FAILED for unknown_status, with or without a hash', () => {
    for (const transactionHash of [HASH, undefined]) {
      const outcome: SubmissionOutcome = {
        kind: 'unknown_status',
        error: submissionError('TX_STATUS_UNKNOWN', 'The transaction status is unknown.'),
        ...(transactionHash ? { transactionHash } : {}),
      };
      const receipt = buildReceiptFromSubmission(outcome, BASE);

      expect(receipt.status).not.toBe(TransactionStatus.FAILED);
      expect(receipt.status).toBe(TransactionStatus.UNKNOWN);
      expect(receipt.actionRequired).toBe('poll');
    }
  });
});

describe('buildReceiptFromSoroban — one per SorobanInvocationStatus value', () => {
  function sorobanResult(
    status: SorobanInvocationStatus,
    extra: Partial<SorobanInvocationResult> = {},
  ): SorobanInvocationResult {
    return { success: status === 'success', status, ...extra };
  }

  it('maps success to COMPLETED', () => {
    const receipt = buildReceiptFromSoroban(sorobanResult('success', { hash: HASH }), BASE);
    expect(receipt.status).toBe(TransactionStatus.COMPLETED);
    expect(receipt.actionRequired).toBe('none');
    expect(receipt.source).toBe('soroban');
  });

  it('maps pending to PENDING and asks the caller to poll', () => {
    const receipt = buildReceiptFromSoroban(sorobanResult('pending', { hash: HASH }), BASE);
    expect(receipt.status).toBe(TransactionStatus.PENDING);
    expect(receipt.actionRequired).toBe('poll');
  });

  it.each<SorobanInvocationStatus>(['failed', 'error', 'simulation_error'])(
    'maps %s to FAILED',
    (status) => {
      const receipt = buildReceiptFromSoroban(sorobanResult(status, { errorCode: 42 }), BASE);
      expect(receipt.status).toBe(TransactionStatus.FAILED);
      expect(receipt.actionRequired).toBe('rebuild');
      expect(receipt.failure?.code).toBe('42');
    },
  );

  it('falls back to a stable code when the RPC gave none', () => {
    const receipt = buildReceiptFromSoroban(sorobanResult('failed'), BASE);
    expect(receipt.failure?.code).toBe('SOROBAN_INVOCATION_FAILED');
  });
});

describe('explorer links', () => {
  it('builds a testnet link containing the hash', () => {
    const receipt = buildReceiptFromSubmission(
      { kind: 'success', transactionHash: HASH },
      { network: 'testnet', now: FIXED_NOW },
    );
    expect(receipt.explorerUrl).toBeDefined();
    expect(receipt.explorerUrl).toContain('/testnet/');
    expect(receipt.explorerUrl).toContain(HASH);
  });

  it('builds a mainnet link on the public network segment', () => {
    const receipt = buildReceiptFromSubmission(
      { kind: 'success', transactionHash: HASH },
      { network: 'mainnet', now: FIXED_NOW },
    );
    expect(receipt.explorerUrl).toBeDefined();
    expect(receipt.explorerUrl).toContain('/public/');
    expect(receipt.explorerUrl).not.toContain('/testnet/');
  });

  it('omits the link when no hash was ever observed, without throwing', () => {
    const outcome: SubmissionOutcome = {
      kind: 'non_retryable_failure',
      error: submissionError('TX_BAD_AUTH', 'The transaction was rejected.'),
    };
    const receipt = buildReceiptFromSubmission(outcome, BASE);

    expect(receipt.transactionHash).toBeUndefined();
    expect(receipt.explorerUrl).toBeUndefined();
  });

  it('omits the link rather than throwing when the hash is malformed', () => {
    const receipt = buildReceiptFromSubmission(
      { kind: 'success', transactionHash: 'not-a-hash' },
      BASE,
    );
    expect(receipt.status).toBe(TransactionStatus.COMPLETED);
    expect(receipt).toHaveProperty('transactionHash', 'not-a-hash');
  });
});

describe('no sensitive data reaches the receipt', () => {
  /** Collects every key in the object graph, mirroring the redactor's walk. */
  function collectKeys(value: unknown, acc: string[] = []): string[] {
    if (value === null || typeof value !== 'object') return acc;
    if (Array.isArray(value)) {
      for (const item of value) collectKeys(item, acc);
      return acc;
    }
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      acc.push(key);
      collectKeys(nested, acc);
    }
    return acc;
  }

  function assertNoSensitiveKeys(receipt: PaymentReceipt): void {
    const keys = collectKeys(receipt).map((k) => k.toLowerCase());
    for (const sensitive of DIAGNOSTICS_SENSITIVE_KEYS) {
      const needle = sensitive.toLowerCase();
      const offender = keys.find((k) => k === needle || k.includes(needle));
      expect(offender, `receipt exposed sensitive key "${offender}"`).toBeUndefined();
    }
  }

  it('carries no key that DIAGNOSTICS_SENSITIVE_KEYS classifies as sensitive', () => {
    const outcomes: SubmissionOutcome[] = [
      { kind: 'success', transactionHash: HASH },
      {
        kind: 'retryable_failure',
        error: submissionError('NET_RATE_LIMITED', 'The network is busy.'),
        suggestedDelayMs: 1_000,
      },
      {
        kind: 'non_retryable_failure',
        error: submissionError('TX_BAD_SEQ', 'The transaction was rejected.'),
      },
      {
        kind: 'unknown_status',
        error: submissionError('TX_STATUS_UNKNOWN', 'The transaction status is unknown.'),
        transactionHash: HASH,
      },
    ];

    for (const outcome of outcomes) {
      assertNoSensitiveKeys(buildReceiptFromSubmission(outcome, BASE));
    }
    assertNoSensitiveKeys(
      buildReceiptFromSoroban(
        { success: false, status: 'failed', errorCode: 7, rawResponse: { xdr: 'AAAA' } },
        BASE,
      ),
    );
  });

  it('does not propagate the raw error object or its internal message', () => {
    const error = submissionError('TX_BAD_SEQ', 'The transaction was rejected.');
    const receipt = buildReceiptFromSubmission(
      { kind: 'non_retryable_failure', error },
      BASE,
    );

    expect(receipt).not.toHaveProperty('error');
    expect(JSON.stringify(receipt)).not.toContain('internal detail');
    expect(receipt.failure).toEqual({
      code: 'TX_BAD_SEQ',
      safeMessage: 'The transaction was rejected.',
    });
  });

  it('does not copy the Soroban rawResponse into the receipt', () => {
    const receipt = buildReceiptFromSoroban(
      { success: false, status: 'error', rawResponse: { envelope: 'SECRET_ENVELOPE' } },
      BASE,
    );
    expect(JSON.stringify(receipt)).not.toContain('SECRET_ENVELOPE');
    expect(receipt).not.toHaveProperty('rawResponse');
  });
});

describe('buildPaymentReceipt — single entry point', () => {
  it('routes a SubmissionOutcome to the submission builder', () => {
    const receipt = buildPaymentReceipt({ kind: 'success', transactionHash: HASH }, BASE);
    expect(receipt.source).toBe('submission');
  });

  it('routes a SorobanInvocationResult to the Soroban builder', () => {
    const receipt = buildPaymentReceipt({ success: true, status: 'success', hash: HASH }, BASE);
    expect(receipt.source).toBe('soroban');
  });
});

describe('display context and determinism', () => {
  it('records the requested context verbatim', () => {
    const receipt = buildReceiptFromSubmission(
      { kind: 'success', transactionHash: HASH },
      {
        ...BASE,
        amount: '10.5000000',
        asset: 'XLM',
        destination: 'GABC',
        memo: 'invoice 42',
      },
    );

    expect(receipt.amount).toBe('10.5000000');
    expect(receipt.asset).toBe('XLM');
    expect(receipt.destination).toBe('GABC');
    expect(receipt.memo).toBe('invoice 42');
  });

  it('uses the injected clock so createdAt is deterministic', () => {
    const receipt = buildReceiptFromSubmission({ kind: 'success', transactionHash: HASH }, BASE);
    expect(receipt.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('still produces a receipt when no network is supplied', () => {
    const receipt = buildReceiptFromSubmission(
      { kind: 'success', transactionHash: HASH },
      { now: FIXED_NOW },
    );
    expect(receipt.status).toBe(TransactionStatus.COMPLETED);
    expect(receipt.createdAt).toBe('2026-01-01T00:00:00.000Z');
  });
});
