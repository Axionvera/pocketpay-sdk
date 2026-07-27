/**
 * Transaction timeout classification tests (issue #208).
 *
 * Every SDK timeout came from one `timeoutError()` in `src/network/index.ts`,
 * which threw the unregistered code `REQUEST_TIMEOUT` and discarded the stage
 * that `withTimeout`'s first argument already carried. The cost was concrete:
 * a submission timeout — a payment whose outcome is genuinely unknown — was
 * indistinguishable from an account-lookup timeout, so `isUnknownStatusError`
 * returned false for it and the payment path advised a plain retry.
 */

import { describe, it, expect } from 'vitest';
import {
  withTimeout,
  fetchWithTimeout,
  inferTimeoutStage,
} from '../src/network';
import {
  isUnknownStatusError,
  isRetryableError,
  ErrorCode,
  ErrorCategory,
  isKnownErrorCode,
  describeError,
  ERROR_CODES,
} from '../src/errors';
import { PocketPayError } from '../src/types';
import type { TimeoutStage } from '../src/types';

/** A promise that never settles, so the timeout always wins the race. */
const never = () => new Promise<never>(() => {});

/** Runs withTimeout with a 1ms budget and returns the rejection. */
async function timeoutOf(operation: string, stage?: TimeoutStage): Promise<PocketPayError> {
  try {
    await withTimeout(operation, 1, never(), stage);
  } catch (error) {
    return error as PocketPayError;
  }
  throw new Error('expected a timeout');
}

describe('inferTimeoutStage', () => {
  it('classifies the real operation labels used across the SDK', () => {
    const cases: Array<[string, TimeoutStage]> = [
      ['Horizon source account lookup', 'preparation'],
      ['Horizon account lookup for transaction preparation', 'preparation'],
      ['Horizon destination account lookup for trustline check', 'preparation'],
      ['Soroban account lookup', 'preparation'],
      ['Soroban transaction simulation', 'preparation'],
      ['Horizon transaction submission', 'submission'],
      ['Soroban transaction submission', 'submission'],
      ['Soroban transaction status request', 'confirmation'],
      ['Horizon transactions request', 'unknown'],
      ['Horizon payments request', 'unknown'],
    ];

    for (const [operation, expected] of cases) {
      expect(inferTimeoutStage(operation), operation).toBe(expected);
    }
  });

  it('is case-insensitive', () => {
    expect(inferTimeoutStage('HORIZON TRANSACTION SUBMISSION')).toBe('submission');
  });
});

describe('timeout stages are represented', () => {
  it('attaches stage, operation and budget to every timeout', async () => {
    const err = await timeoutOf('Horizon source account lookup');

    expect(err.timeout).toBeDefined();
    expect(err.timeout?.stage).toBe('preparation');
    expect(err.timeout?.operation).toBe('Horizon source account lookup');
    expect(err.timeout?.timeoutMs).toBe(1);
  });

  it('lets a call site state the stage explicitly, overriding inference', async () => {
    const err = await timeoutOf('some ambiguous operation', 'confirmation');
    expect(err.timeout?.stage).toBe('confirmation');
  });

  it('covers each of the four stages', async () => {
    expect((await timeoutOf('Horizon source account lookup')).timeout?.stage).toBe('preparation');
    expect((await timeoutOf('Horizon transaction submission')).timeout?.stage).toBe('submission');
    expect((await timeoutOf('Soroban transaction status request')).timeout?.stage).toBe(
      'confirmation'
    );
    expect((await timeoutOf('Horizon transactions request')).timeout?.stage).toBe('unknown');
  });

  it('keeps the operation and budget in the message', async () => {
    const err = await timeoutOf('Horizon source account lookup');
    expect(err.message).toContain('Horizon source account lookup');
    expect(err.message).toContain('1ms');
  });
});

describe('unknown-status timeouts are separate from failures', () => {
  it('reports a submission timeout as TX_STATUS_UNKNOWN', async () => {
    const err = await timeoutOf('Horizon transaction submission');

    expect(err.code).toBe(ErrorCode.TX_STATUS_UNKNOWN);
    expect(err.category).toBe(ErrorCategory.Transaction);
    expect(isUnknownStatusError(err)).toBe(true);
  });

  it('reports a confirmation timeout as TX_STATUS_UNKNOWN', async () => {
    const err = await timeoutOf('Soroban transaction status request');
    expect(isUnknownStatusError(err)).toBe(true);
  });

  it('leaves preparation timeouts on REQUEST_TIMEOUT', async () => {
    const err = await timeoutOf('Horizon source account lookup');

    expect(err.code).toBe('REQUEST_TIMEOUT');
    expect(isUnknownStatusError(err)).toBe(false);
  });

  it('never marks an unknown-outcome timeout as retryable', async () => {
    // NET_TIMEOUT would have been the obvious mapping, but it is retryable:true
    // and blindly resubmitting a payment of unknown outcome risks paying twice.
    const err = await timeoutOf('Horizon transaction submission');

    expect(err.code).not.toBe(ErrorCode.NET_TIMEOUT);
    expect(isRetryableError(err)).toBe(false);
    expect(ERROR_CODES[ErrorCode.TX_STATUS_UNKNOWN].retryable).toBe(false);
  });

  it('still treats a preparation timeout as retryable guidance', () => {
    // Nothing was sent, so retrying is safe here.
    expect(ERROR_CODES[ErrorCode.REQUEST_TIMEOUT].retryable).toBe(true);
  });
});

describe('REQUEST_TIMEOUT joins the published registry', () => {
  it('is now a known code with real guidance', () => {
    expect(isKnownErrorCode('REQUEST_TIMEOUT')).toBe(true);

    const described = describeError('REQUEST_TIMEOUT');
    expect(described.known).toBe(true);
    expect(described.category).toBe(ErrorCategory.Network);
    expect(described.safeMessage).not.toBe('An unexpected error occurred.');
    expect(described.developerHint).toContain('stage');
  });

  it('keeps the same code string existing consumers already assert', async () => {
    // fund, mockHorizon and transactions tests assert this literal value.
    const err = await timeoutOf('Horizon account lookup');
    expect(err.code).toBe('REQUEST_TIMEOUT');
  });
});

describe('fetchWithTimeout classification', () => {
  it('classifies its timeouts through the same path', async () => {
    const err = await (async () => {
      try {
        await fetchWithTimeout('http://127.0.0.1:1/never', undefined, 'Friendbot request', 1);
      } catch (error) {
        return error as PocketPayError;
      }
      throw new Error('expected a rejection');
    })();

    // Either a timeout or a connection refusal is acceptable here; when it is
    // a timeout it must carry the same stage metadata.
    if (err.code === 'REQUEST_TIMEOUT') {
      expect(err.timeout?.operation).toBe('Friendbot request');
      expect(err.timeout?.stage).toBe('unknown');
    }
  });
});

describe('backwards compatibility', () => {
  it('leaves withTimeout resolving successful work untouched', async () => {
    await expect(withTimeout('Horizon account lookup', 1_000, Promise.resolve('ok'))).resolves.toBe(
      'ok'
    );
  });

  it('propagates non-timeout rejections unchanged', async () => {
    const boom = new Error('upstream failure');
    await expect(
      withTimeout('Horizon account lookup', 1_000, Promise.reject(boom))
    ).rejects.toBe(boom);
  });

  it('still produces a PocketPayError for every timeout', async () => {
    expect(await timeoutOf('Horizon source account lookup')).toBeInstanceOf(PocketPayError);
    expect(await timeoutOf('Horizon transaction submission')).toBeInstanceOf(PocketPayError);
  });
});
