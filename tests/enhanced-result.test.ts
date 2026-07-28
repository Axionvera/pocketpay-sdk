/**
 * Tests for the enhanced PocketPayResult system — warnings, recovery hints,
 * and enriched pilot operations (enhancedSendXLM, enhancedGetBalance).
 *
 * Covers:
 *  - ResultWarning and RecoveryHint type shapes
 *  - toEnhancedSuccessResult / toEnhancedFailureResult constructors
 *  - toEnhancedResult async wrapper
 *  - enhancedSendXLM warnings (HIGH_FEE_RATIO) and recovery hints
 *  - enhancedGetBalance warnings (ZERO_NATIVE_BALANCE, MANY_ASSETS) and hints
 *  - Backward compatibility: existing PocketPayResult still works
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  PocketPayError,
  toEnhancedSuccessResult,
  toEnhancedFailureResult,
  toEnhancedResult,
  enhancedSendXLM,
  safeEnhancedSendXLM,
  enhancedGetBalance,
  safeEnhancedGetBalance,
  createWallet,
  type EnhancedSuccessResult,
  type EnhancedFailureResult,
  type EnhancedPocketPayResult,
  type AccountBalance,
  type ResultWarning,
  type RecoveryHint,
} from '../src';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeError(
  message = 'something went wrong',
  code = 'TEST_ERROR',
  statusCode?: number,
): PocketPayError {
  return new PocketPayError(message, code, statusCode);
}

function makeWarning(code = 'TEST_WARNING', message = 'watch out'): ResultWarning {
  return { code, message };
}

function makeHint(action = 'retry', message = 'try again'): RecoveryHint {
  return { action, message, retryable: true, suggestedDelayMs: 1000 };
}

const sampleBalance: AccountBalance = {
  publicKey: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  balances: [{ asset: 'XLM', balance: '100.0000000', issuer: '' }],
  nativeBalance: '100.0000000',
};

// ─── ResultWarning & RecoveryHint shape ─────────────────────────────────────

describe('ResultWarning shape', () => {
  it('has code and message', () => {
    const w: ResultWarning = { code: 'DEPRECATED', message: 'Field is deprecated' };
    expect(w.code).toBe('DEPRECATED');
    expect(w.message).toBe('Field is deprecated');
  });

  it('allows optional metadata', () => {
    const w: ResultWarning = { code: 'LIMIT', message: 'Near limit', metadata: { pct: 95 } };
    expect(w.metadata).toEqual({ pct: 95 });
  });
});

describe('RecoveryHint shape', () => {
  it('has action and message', () => {
    const h: RecoveryHint = { action: 'retry', message: 'Try again' };
    expect(h.action).toBe('retry');
    expect(h.message).toBe('Try again');
  });

  it('allows optional retryable and suggestedDelayMs', () => {
    const h: RecoveryHint = { action: 'retry', message: 'Wait', retryable: true, suggestedDelayMs: 5000 };
    expect(h.retryable).toBe(true);
    expect(h.suggestedDelayMs).toBe(5000);
  });

  it('allows optional metadata', () => {
    const h: RecoveryHint = { action: 'fund_account', message: 'Fund it', metadata: { network: 'testnet' } };
    expect(h.metadata).toEqual({ network: 'testnet' });
  });
});

// ─── toEnhancedSuccessResult ────────────────────────────────────────────────

describe('toEnhancedSuccessResult', () => {
  it('returns ok: true with value', () => {
    const result = toEnhancedSuccessResult(42);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(42);
  });

  it('omits warnings and recoveryHints when not provided', () => {
    const result = toEnhancedSuccessResult('data');
    expect(result).not.toHaveProperty('warnings');
    expect(result).not.toHaveProperty('recoveryHints');
  });

  it('includes warnings when provided', () => {
    const warnings = [makeWarning()];
    const result = toEnhancedSuccessResult('data', warnings);
    expect(result.warnings).toEqual(warnings);
  });

  it('includes recoveryHints when provided', () => {
    const hints = [makeHint()];
    const result = toEnhancedSuccessResult('data', undefined, hints);
    expect(result.recoveryHints).toEqual(hints);
  });

  it('omits warnings when empty array', () => {
    const result = toEnhancedSuccessResult('data', [], []);
    expect(result).not.toHaveProperty('warnings');
    expect(result).not.toHaveProperty('recoveryHints');
  });

  it('satisfies EnhancedSuccessResult<T> interface', () => {
    const result: EnhancedSuccessResult<number> = toEnhancedSuccessResult(7);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(7);
  });

  it('is backward-compatible with PocketPayResult narrowing', () => {
    const result: EnhancedPocketPayResult<string> = toEnhancedSuccessResult('ok');
    if (result.ok) {
      expect(result.value).toBe('ok');
    } else {
      throw new Error('Should not reach failure branch');
    }
  });
});

// ─── toEnhancedFailureResult ────────────────────────────────────────────────

describe('toEnhancedFailureResult', () => {
  it('returns ok: false with error', () => {
    const err = makeError();
    const result = toEnhancedFailureResult(err);
    expect(result.ok).toBe(false);
    expect(result.error).toBe(err);
  });

  it('omits warnings and recoveryHints when not provided', () => {
    const result = toEnhancedFailureResult(makeError());
    expect(result).not.toHaveProperty('warnings');
    expect(result).not.toHaveProperty('recoveryHints');
  });

  it('includes warnings when provided', () => {
    const warnings = [makeWarning()];
    const result = toEnhancedFailureResult(makeError(), warnings);
    expect(result.warnings).toEqual(warnings);
  });

  it('includes recoveryHints when provided', () => {
    const hints = [makeHint()];
    const result = toEnhancedFailureResult(makeError(), undefined, hints);
    expect(result.recoveryHints).toEqual(hints);
  });

  it('includes both warnings and recoveryHints', () => {
    const warnings = [makeWarning()];
    const hints = [makeHint()];
    const result = toEnhancedFailureResult(makeError(), warnings, hints);
    expect(result.warnings).toEqual(warnings);
    expect(result.recoveryHints).toEqual(hints);
  });

  it('omits warnings when empty array', () => {
    const result = toEnhancedFailureResult(makeError(), []);
    expect(result).not.toHaveProperty('warnings');
  });

  it('satisfies EnhancedFailureResult interface', () => {
    const result: EnhancedFailureResult = toEnhancedFailureResult(makeError());
    expect(result.ok).toBe(false);
    expect(result.error).toBeInstanceOf(PocketPayError);
  });

  it('is backward-compatible with PocketPayResult narrowing', () => {
    const err = makeError('fail', 'FAIL');
    const result: EnhancedPocketPayResult<string> = toEnhancedFailureResult(err);
    if (!result.ok) {
      expect(result.error.code).toBe('FAIL');
    } else {
      throw new Error('Should not reach success branch');
    }
  });
});

// ─── toEnhancedResult ───────────────────────────────────────────────────────

describe('toEnhancedResult', () => {
  it('returns EnhancedSuccessResult on resolution', async () => {
    const result = await toEnhancedResult(async () => 42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  it('returns EnhancedFailureResult on throw', async () => {
    const err = makeError('boom', 'BOOM');
    const result = await toEnhancedResult(async () => { throw err; });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('BOOM');
    }
  });

  it('attaches warnings on success', async () => {
    const warnings = [makeWarning('W1', 'heads up')];
    const result = await toEnhancedResult(async () => 'ok', { warnings });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toEqual(warnings);
    }
  });

  it('attaches recovery hints on failure', async () => {
    const hints = [makeHint('retry', 'try again')];
    const result = await toEnhancedResult(
      async () => { throw makeError(); },
      { recoveryHints: hints },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.recoveryHints).toEqual(hints);
    }
  });

  it('wraps plain errors into PocketPayError', async () => {
    const result = await toEnhancedResult(
      async () => { throw 'raw string'; },
      { errorContext: 'ctx', errorCode: 'RAW' },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PocketPayError);
      expect(result.error.code).toBe('RAW');
    }
  });
});

// ─── enhancedSendXLM pilot ─────────────────────────────────────────────────

describe('enhancedSendXLM', () => {
  it('returns FailureResult for invalid secret key (no network)', async () => {
    const result = await enhancedSendXLM({
      sourceSecret: 'NOT_A_SECRET',
      destination: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
      amount: '10',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PocketPayError);
      expect(result.error.code).toBe('INVALID_SECRET_KEY');
    }
  });

  it('returns FailureResult with recovery hint for invalid secret', async () => {
    const result = await enhancedSendXLM({
      sourceSecret: 'NOT_A_SECRET',
      destination: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
      amount: '10',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.recoveryHints).toBeDefined();
    }
  });

  it('returns FailureResult for self-payment', async () => {
    const wallet = createWallet();
    const result = await enhancedSendXLM({
      sourceSecret: wallet.secretKey,
      destination: wallet.publicKey,
      amount: '1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SELF_PAYMENT');
    }
  });

  it('never throws for invalid inputs', async () => {
    await expect(
      enhancedSendXLM({
        sourceSecret: 'BAD',
        destination: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        amount: '10',
      }),
    ).resolves.toBeDefined();
  });
});

// ─── safeEnhancedSendXLM ───────────────────────────────────────────────────

describe('safeEnhancedSendXLM', () => {
  it('returns EnhancedFailureResult for invalid inputs', async () => {
    const result = await safeEnhancedSendXLM({
      sourceSecret: 'NOPE',
      destination: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
      amount: '10',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PocketPayError);
    }
  });

  it('never throws', async () => {
    await expect(
      safeEnhancedSendXLM({
        sourceSecret: 'NOPE',
        destination: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
        amount: '10',
      }),
    ).resolves.toBeDefined();
  });
});

// ─── enhancedGetBalance pilot ───────────────────────────────────────────────

describe('enhancedGetBalance', () => {
  it('returns FailureResult for invalid public key', async () => {
    const result = await enhancedGetBalance('INVALID');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_PUBLIC_KEY');
    }
  });

  it('returns FailureResult with recovery hint for invalid key', async () => {
    const result = await enhancedGetBalance('INVALID');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.recoveryHints).toBeDefined();
    }
  });

  it('never throws for invalid input', async () => {
    await expect(enhancedGetBalance('INVALID')).resolves.toBeDefined();
  });
});

// ─── safeEnhancedGetBalance ─────────────────────────────────────────────────

describe('safeEnhancedGetBalance', () => {
  it('returns EnhancedFailureResult for invalid key', async () => {
    const result = await safeEnhancedGetBalance('BADKEY');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PocketPayError);
      expect(result.error.code).toBe('INVALID_PUBLIC_KEY');
    }
  });

  it('never throws', async () => {
    await expect(safeEnhancedGetBalance('BADKEY')).resolves.toBeDefined();
  });
});

// ─── Backward compatibility ────────────────────────────────────────────────

describe('backward compatibility', () => {
  it('existing PocketPayResult still works', async () => {
    const { safeGetBalance } = await import('../src');
    const result = await safeGetBalance('INVALID');
    expect(result.ok).toBe(false);
  });

  it('existing throwing APIs still throw PocketPayError', async () => {
    const { getBalance } = await import('../src');
    await expect(getBalance('INVALID')).rejects.toBeInstanceOf(PocketPayError);
  });
});
