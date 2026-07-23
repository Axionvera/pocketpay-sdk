/**
 * Tests for the non-throwing `validateSendXLMParams` helper.
 *
 * These tests never touch the network. `validateSendXLMParams` is a pure
 * function that runs the same checks `sendXLM` runs internally and returns
 * a structured result instead of throwing on the first failure.
 */
import { describe, it, expect } from 'vitest';
import * as StellarSDK from '@stellar/stellar-sdk';
import { validateSendXLMParams } from '../src';
import type { SendXLMParams } from '../src';

function anotherKeypair() {
  return StellarSDK.Keypair.random();
}

function baseParams(): SendXLMParams {
  const source = StellarSDK.Keypair.random();
  const destination = anotherKeypair().publicKey();
  return {
    sourceSecret: source.secret(),
    destination,
    amount: '1.5',
  };
}

describe('validateSendXLMParams', () => {
  it('returns { ok: true } for valid input with no memo', () => {
    const result = validateSendXLMParams(baseParams());
    expect(result).toEqual({ ok: true });
  });

  it('returns { ok: true } for valid input with a memo', () => {
    const params = { ...baseParams(), memo: 'invoice 42' };
    const result = validateSendXLMParams(params);
    expect(result).toEqual({ ok: true });
  });

  it('detects invalid destination', () => {
    const params = { ...baseParams(), destination: 'not-a-key' };
    const result = validateSendXLMParams(params);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    const err = result.errors.find((e) => e.field === 'destination');
    expect(err?.code).toBe('INVALID_PUBLIC_KEY');
    expect(err?.reason).toBe('invalid_format');
  });

  it('detects invalid amount (non-numeric)', () => {
    const params = { ...baseParams(), amount: '10abc' };
    const result = validateSendXLMParams(params);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    const err = result.errors.find((e) => e.field === 'amount');
    expect(err?.code).toBe('INVALID_AMOUNT');
  });

  it('detects invalid amount (zero)', () => {
    const params = { ...baseParams(), amount: '0' };
    const result = validateSendXLMParams(params);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    const err = result.errors.find((e) => e.field === 'amount');
    expect(err?.code).toBe('INVALID_AMOUNT');
    expect(err?.reason).toBe('not_positive');
  });

  it('detects invalid amount (too many decimals)', () => {
    const params = { ...baseParams(), amount: '1.12345678' };
    const result = validateSendXLMParams(params);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    const err = result.errors.find((e) => e.field === 'amount');
    expect(err?.code).toBe('INVALID_AMOUNT_PRECISION');
  });

  it('detects memo that exceeds the 28-byte limit', () => {
    // "a" * 29 is 29 bytes in UTF-8, one over the Stellar text-memo limit.
    const params = { ...baseParams(), memo: 'a'.repeat(29) };
    const result = validateSendXLMParams(params);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    const err = result.errors.find((e) => e.field === 'memo');
    expect(err?.code).toBe('INVALID_MEMO');
    expect(err?.reason).toBe('too_long');
  });

  it('detects multi-byte memo that exceeds 28 bytes', () => {
    // Every emoji here is 4 bytes; 8 * 4 = 32 bytes > 28.
    const params = { ...baseParams(), memo: '😀'.repeat(8) };
    const result = validateSendXLMParams(params);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    const err = result.errors.find((e) => e.field === 'memo');
    expect(err?.code).toBe('INVALID_MEMO');
  });

  it('detects self-payment when destination equals derived source public key', () => {
    const kp = StellarSDK.Keypair.random();
    const params: SendXLMParams = {
      sourceSecret: kp.secret(),
      destination: kp.publicKey(),
      amount: '1',
    };
    const result = validateSendXLMParams(params);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    const err = result.errors.find((e) => e.code === 'SELF_PAYMENT');
    expect(err).toBeDefined();
    expect(err?.field).toBe('destination');
    expect(err?.reason).toBe('same_as_source');
  });

  it('detects invalid secret key', () => {
    const params = { ...baseParams(), sourceSecret: 'S-not-a-valid-secret' };
    const result = validateSendXLMParams(params);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    const err = result.errors.find((e) => e.field === 'sourceSecret');
    expect(err?.code).toBe('INVALID_SECRET_KEY');
  });

  it('collects every failing check in a single result', () => {
    const params: SendXLMParams = {
      sourceSecret: 'S-bad',
      destination: 'G-bad',
      amount: '-1',
      memo: 'a'.repeat(29),
    };
    const result = validateSendXLMParams(params);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    const codes = result.errors.map((e) => e.code).sort();
    // Self-payment is skipped when secret/destination are invalid, so we
    // expect exactly the four field-level failures here.
    expect(codes).toEqual(
      ['INVALID_AMOUNT', 'INVALID_MEMO', 'INVALID_PUBLIC_KEY', 'INVALID_SECRET_KEY'].sort(),
    );
  });

  it('skips the self-payment check when the secret key is invalid', () => {
    // If the secret does not parse we cannot derive a public key, so
    // reporting SELF_PAYMENT alongside INVALID_SECRET_KEY would be misleading.
    const params: SendXLMParams = {
      sourceSecret: 'S-bad',
      destination: anotherKeypair().publicKey(),
      amount: '1',
    };
    const result = validateSendXLMParams(params);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.errors.some((e) => e.code === 'SELF_PAYMENT')).toBe(false);
    expect(result.errors.some((e) => e.code === 'INVALID_SECRET_KEY')).toBe(true);
  });

  it('does not throw for any input shape', () => {
    // Types are permissive at the boundary in practice (form values are
    // often `string | undefined`), so the helper should be total.
    const shapes: SendXLMParams[] = [
      { sourceSecret: '', destination: '', amount: '' },
      { sourceSecret: '', destination: '', amount: '', memo: undefined },
      // Deliberately bad types to prove no throws on runtime junk. Cast
      // because the type system rejects these; the guarantee is runtime.
      { sourceSecret: null as unknown as string, destination: undefined as unknown as string, amount: NaN as unknown as string },
    ];
    for (const s of shapes) {
      expect(() => validateSendXLMParams(s)).not.toThrow();
    }
  });

  it('returns a stable code SDK consumers can branch on without message parsing', () => {
    // Sanity check: the reported error codes are string literals from the
    // documented union, not free-form message text.
    const params = { ...baseParams(), destination: 'not-a-key' };
    const result = validateSendXLMParams(params);
    if (result.ok) throw new Error('expected failure');
    for (const err of result.errors) {
      expect(typeof err.code).toBe('string');
      expect(err.code).toMatch(/^(INVALID_|SELF_PAYMENT)/);
      expect(typeof err.field).toBe('string');
      expect(typeof err.reason).toBe('string');
      expect(typeof err.message).toBe('string');
    }
  });
});
