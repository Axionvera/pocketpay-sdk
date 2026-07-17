/**
 * Tests for the PocketPayResult typed result wrapper system.
 *
 * Covers:
 *  - toSuccessResult / toFailureResult constructors
 *  - toResult async wrapper
 *  - TypeScript discriminated-union narrowing (ok === true / false)
 *  - safe* wrapper helpers (safeGetBalance, safeFundTestnetAccount,
 *    safeSendXLM, safeGetTransactions, safeGetPayments)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PocketPayError,
  toSuccessResult,
  toFailureResult,
  toResult,
  safeGetBalance,
  safeFundTestnetAccount,
  safeSendXLM,
  safeGetTransactions,
  safeGetPayments,
  createWallet,
  type SuccessResult,
  type FailureResult,
  type PocketPayResult,
  type AccountBalance,
} from '../src';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a PocketPayError for use in tests. */
function makeError(
  message = 'something went wrong',
  code = 'TEST_ERROR',
  statusCode?: number
): PocketPayError {
  return new PocketPayError(message, code, statusCode);
}

/** A sample AccountBalance value used as a success payload. */
const sampleBalance: AccountBalance = {
  publicKey: 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H',
  balances: [{ asset: 'XLM', balance: '100.0000000', issuer: '' }],
  nativeBalance: '100.0000000',
};

// ─── toSuccessResult ─────────────────────────────────────────────────────────

describe('toSuccessResult', () => {
  it('returns an object with ok === true', () => {
    const result = toSuccessResult(42);
    expect(result.ok).toBe(true);
  });

  it('wraps the given value', () => {
    const result = toSuccessResult(sampleBalance);
    expect(result.value).toBe(sampleBalance);
  });

  it('works with primitives', () => {
    expect(toSuccessResult('hello').value).toBe('hello');
    expect(toSuccessResult(0).value).toBe(0);
    expect(toSuccessResult(null).value).toBeNull();
  });

  it('works with objects', () => {
    const obj = { a: 1, b: [2, 3] };
    const result = toSuccessResult(obj);
    expect(result.value).toEqual({ a: 1, b: [2, 3] });
  });

  it('satisfies the SuccessResult<T> interface shape', () => {
    const result: SuccessResult<number> = toSuccessResult(7);
    expect(result).toHaveProperty('ok', true);
    expect(result).toHaveProperty('value', 7);
  });
});

// ─── toFailureResult ─────────────────────────────────────────────────────────

describe('toFailureResult', () => {
  it('returns an object with ok === false', () => {
    const result = toFailureResult(makeError());
    expect(result.ok).toBe(false);
  });

  it('preserves the PocketPayError reference', () => {
    const err = makeError('boom', 'BOOM_CODE', 503);
    const result = toFailureResult(err);
    expect(result.error).toBe(err);
  });

  it('preserves error code', () => {
    const result = toFailureResult(makeError('msg', 'MY_CODE'));
    expect(result.error.code).toBe('MY_CODE');
  });

  it('preserves error message', () => {
    const result = toFailureResult(makeError('detailed message'));
    expect(result.error.message).toBe('detailed message');
  });

  it('preserves optional statusCode', () => {
    const result = toFailureResult(makeError('not found', 'NOT_FOUND', 404));
    expect(result.error.statusCode).toBe(404);
  });

  it('satisfies the FailureResult interface shape', () => {
    const result: FailureResult = toFailureResult(makeError());
    expect(result).toHaveProperty('ok', false);
    expect(result.error).toBeInstanceOf(PocketPayError);
  });
});

// ─── Discriminated union narrowing ──────────────────────────────────────────

describe('PocketPayResult discriminated union', () => {
  it('narrows to SuccessResult when ok is true', () => {
    const result: PocketPayResult<string> = toSuccessResult('data');
    if (result.ok) {
      // TypeScript would enforce result.value is string here
      expect(result.value).toBe('data');
    } else {
      throw new Error('Should not reach failure branch');
    }
  });

  it('narrows to FailureResult when ok is false', () => {
    const err = makeError('fail', 'FAIL');
    const result: PocketPayResult<string> = toFailureResult(err);
    if (!result.ok) {
      expect(result.error.code).toBe('FAIL');
    } else {
      throw new Error('Should not reach success branch');
    }
  });

  it('success result does not have an error property', () => {
    const result = toSuccessResult(1);
    expect(result).not.toHaveProperty('error');
  });

  it('failure result does not have a value property', () => {
    const result = toFailureResult(makeError());
    expect(result).not.toHaveProperty('value');
  });
});

// ─── toResult ────────────────────────────────────────────────────────────────

describe('toResult', () => {
  it('returns SuccessResult when the async function resolves', async () => {
    const result = await toResult(async () => 42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  it('returns FailureResult when the function throws a PocketPayError', async () => {
    const err = makeError('network down', 'NETWORK_DOWN', 503);
    const result = await toResult(async () => {
      throw err;
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(err);
      expect(result.error.code).toBe('NETWORK_DOWN');
    }
  });

  it('converts a plain Error into a PocketPayError on failure', async () => {
    const result = await toResult(
      async () => {
        throw new Error('plain error');
      },
      'context msg',
      'WRAPPED_CODE'
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PocketPayError);
      expect(result.error.code).toBe('WRAPPED_CODE');
      expect(result.error.message).toContain('plain error');
    }
  });

  it('uses UNKNOWN_ERROR code when no errorCode is supplied', async () => {
    const result = await toResult(async () => {
      throw new Error('oops');
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNKNOWN_ERROR');
    }
  });

  it('wraps a non-Error throw (e.g. a string) into a PocketPayError', async () => {
    const result = await toResult(async () => {
      throw 'raw string error'; // eslint-disable-line no-throw-literal
    }, 'ctx', 'STR_ERR');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PocketPayError);
    }
  });

  it('passes through the resolved value untouched', async () => {
    const payload = { nested: { deep: true } };
    const result = await toResult(async () => payload);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(payload);
  });

  it('handles a synchronous error inside an async wrapper', async () => {
    const result = await toResult(async () => {
      // synchronous throw inside async
      const x: any = null;
      return x.property; // TypeError
    }, 'sync-in-async', 'SYNC_ERR');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PocketPayError);
    }
  });
});

// ─── safeGetBalance ──────────────────────────────────────────────────────────

describe('safeGetBalance', () => {
  it('returns FailureResult for an invalid public key (no network)', async () => {
    const result = await safeGetBalance('INVALID_KEY');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PocketPayError);
      expect(result.error.code).toBe('INVALID_PUBLIC_KEY');
    }
  });

  it('never throws even when given a bad key', async () => {
    await expect(safeGetBalance('not-a-key')).resolves.not.toThrow();
  });

  it('returns a PocketPayResult shape on failure', async () => {
    const result = await safeGetBalance('GBAD');
    expect(result).toHaveProperty('ok');
    expect(result.ok).toBe(false);
  });
});

// ─── safeFundTestnetAccount ──────────────────────────────────────────────────

describe('safeFundTestnetAccount', () => {
  it('returns FailureResult for an invalid public key', async () => {
    const result = await safeFundTestnetAccount('NOTAKEY');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PocketPayError);
      expect(result.error.code).toBe('INVALID_PUBLIC_KEY');
    }
  });

  it('never throws even for an invalid key', async () => {
    await expect(safeFundTestnetAccount('NOTAKEY')).resolves.not.toThrow();
  });
});

// ─── safeSendXLM ─────────────────────────────────────────────────────────────

describe('safeSendXLM', () => {
  it('returns FailureResult when source secret is invalid', async () => {
    const result = await safeSendXLM({
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

  it('returns FailureResult when destination is invalid', async () => {
    const wallet = createWallet();
    const result = await safeSendXLM({
      sourceSecret: wallet.secretKey,
      destination: 'INVALID_DEST',
      amount: '10',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PocketPayError);
      expect(result.error.code).toBe('INVALID_PUBLIC_KEY');
    }
  });

  it('returns FailureResult when amount is invalid', async () => {
    const wallet = createWallet();
    const dest = createWallet();
    const result = await safeSendXLM({
      sourceSecret: wallet.secretKey,
      destination: dest.publicKey,
      amount: '-5',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PocketPayError);
      expect(result.error.code).toBe('INVALID_AMOUNT');
    }
  });

  it('returns FailureResult for self-payment', async () => {
    const wallet = createWallet();
    const result = await safeSendXLM({
      sourceSecret: wallet.secretKey,
      destination: wallet.publicKey,
      amount: '1',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('SELF_PAYMENT');
    }
  });

  it('never throws even for invalid inputs', async () => {
    const wallet = createWallet();
    await expect(
      safeSendXLM({ sourceSecret: wallet.secretKey, destination: wallet.publicKey, amount: '1' })
    ).resolves.not.toThrow();
  });
});

// ─── safeGetTransactions ──────────────────────────────────────────────────────

describe('safeGetTransactions', () => {
  it('returns FailureResult for an invalid public key', async () => {
    const result = await safeGetTransactions('BADKEY');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PocketPayError);
      expect(result.error.code).toBe('INVALID_PUBLIC_KEY');
    }
  });

  it('never throws for invalid input', async () => {
    await expect(safeGetTransactions('BADKEY')).resolves.not.toThrow();
  });
});

// ─── safeGetPayments ─────────────────────────────────────────────────────────

describe('safeGetPayments', () => {
  it('returns FailureResult for an invalid public key', async () => {
    const result = await safeGetPayments('BADKEY');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(PocketPayError);
      expect(result.error.code).toBe('INVALID_PUBLIC_KEY');
    }
  });

  it('never throws for invalid input', async () => {
    await expect(safeGetPayments('BADKEY')).resolves.not.toThrow();
  });
});

// ─── Backwards-compatibility guard ──────────────────────────────────────────

describe('existing throwing APIs are unaffected', () => {
  it('getBalance still throws PocketPayError for invalid key', async () => {
    const { getBalance } = await import('../src');
    await expect(getBalance('INVALID')).rejects.toBeInstanceOf(PocketPayError);
  });

  it('validatePublicKey still throws for an invalid key', async () => {
    const { validatePublicKey } = await import('../src');
    expect(() => validatePublicKey('INVALID')).toThrow(PocketPayError);
  });
});
