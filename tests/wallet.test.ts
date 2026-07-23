import { describe, it, expect } from 'vitest';
import {
  createWallet,
  importWallet,
  safeImportWallet,
  enhancedImportWallet,
  safeEnhancedImportWallet,
  getPublicKey,
  validateSecretKey,
  PocketPayError,
} from '../src';
import { fundedAccount } from './fixtures';

describe('Wallet Module', () => {
  describe('createWallet', () => {
    it('should generate a valid keypair', () => {
      const wallet = createWallet();
      expect(wallet.publicKey).toBeDefined();
      expect(wallet.secretKey).toBeDefined();
      expect(wallet.publicKey).toMatch(/^G[A-Z0-9]{55}$/);
      expect(wallet.secretKey).toMatch(/^S[A-Z0-9]{55}$/);
    });

    it('should generate unique keypairs each time', () => {
      const w1 = createWallet();
      const w2 = createWallet();
      expect(w1.publicKey).not.toEqual(w2.publicKey);
      expect(w1.secretKey).not.toEqual(w2.secretKey);
    });
  });

  describe('validateSecretKey', () => {
    it('should return true for a valid secret key', () => {
      const { secretKey } = createWallet();
      expect(validateSecretKey(secretKey)).toBe(true);
    });

    it('should throw typed PocketPayError with reason "not_a_string" for non-string inputs', () => {
      const invalidInputs = [null, undefined, 12345, {}, ['S123']];
      for (const input of invalidInputs) {
        try {
          validateSecretKey(input as any);
          expect.fail('Should have thrown PocketPayError');
        } catch (err) {
          expect(err).toBeInstanceOf(PocketPayError);
          const pErr = err as PocketPayError;
          expect(pErr.code).toBe('INVALID_SECRET_KEY');
          expect(pErr.validation?.field).toBe('secretKey');
          expect(pErr.validation?.reason).toBe('not_a_string');
          expect((pErr.validation as any)?.value).toBeUndefined();
        }
      }
    });

    it('should throw typed PocketPayError with reason "missing" for empty or whitespace strings', () => {
      for (const input of ['', '   ', '\t\n']) {
        try {
          validateSecretKey(input);
          expect.fail('Should have thrown PocketPayError');
        } catch (err) {
          expect(err).toBeInstanceOf(PocketPayError);
          const pErr = err as PocketPayError;
          expect(pErr.code).toBe('INVALID_SECRET_KEY');
          expect(pErr.validation?.reason).toBe('missing');
          expect((pErr.validation as any)?.value).toBeUndefined();
        }
      }
    });

    it('should throw typed PocketPayError with reason "invalid_prefix" for key not starting with S', () => {
      const wrongPrefix = 'G' + 'A'.repeat(55);
      try {
        validateSecretKey(wrongPrefix);
        expect.fail('Should have thrown PocketPayError');
      } catch (err) {
        expect(err).toBeInstanceOf(PocketPayError);
        const pErr = err as PocketPayError;
        expect(pErr.code).toBe('INVALID_SECRET_KEY');
        expect(pErr.validation?.reason).toBe('invalid_prefix');
        expect((pErr.validation as any)?.value).toBeUndefined();
      }
    });

    it('should throw typed PocketPayError with reason "invalid_length" for key with incorrect length', () => {
      const shortKey = 'S1234567890';
      try {
        validateSecretKey(shortKey);
        expect.fail('Should have thrown PocketPayError');
      } catch (err) {
        expect(err).toBeInstanceOf(PocketPayError);
        const pErr = err as PocketPayError;
        expect(pErr.code).toBe('INVALID_SECRET_KEY');
        expect(pErr.validation?.reason).toBe('invalid_length');
        expect((pErr.validation as any)?.value).toBeUndefined();
      }
    });

    it('should throw typed PocketPayError with reason "invalid_format" for 56-char string starting with S but bad strkey checksum', () => {
      const badChecksum = 'S' + '0'.repeat(55);
      try {
        validateSecretKey(badChecksum);
        expect.fail('Should have thrown PocketPayError');
      } catch (err) {
        expect(err).toBeInstanceOf(PocketPayError);
        const pErr = err as PocketPayError;
        expect(pErr.code).toBe('INVALID_SECRET_KEY');
        expect(pErr.validation?.reason).toBe('invalid_format');
        expect((pErr.validation as any)?.value).toBeUndefined();
      }
    });
  });

  describe('importWallet', () => {
    it('should import a wallet from a valid secret key', () => {
      const original = createWallet();
      const imported = importWallet(original.secretKey);
      expect(imported.publicKey).toEqual(original.publicKey);
      expect(imported.secretKey).toEqual(original.secretKey);
    });

    it('should trim surrounding whitespace on import', () => {
      const original = createWallet();
      const imported = importWallet(`  ${original.secretKey}\n`);
      expect(imported.publicKey).toEqual(original.publicKey);
    });

    it('should throw PocketPayError for invalid secret key without leaking secret data', () => {
      const secretAttempt = 'S' + 'X'.repeat(55);
      try {
        importWallet(secretAttempt);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(PocketPayError);
        const pErr = err as PocketPayError;
        expect(pErr.code).toBe('INVALID_SECRET_KEY');
        expect(pErr.message).not.toContain(secretAttempt);
        expect(JSON.stringify(pErr)).not.toContain(secretAttempt);
        expect((pErr.validation as any)?.value).toBeUndefined();
      }
    });

    it('should throw for empty string', () => {
      expect(() => importWallet('')).toThrow(PocketPayError);
    });
  });

  describe('safeImportWallet', () => {
    it('should return success result for valid secret key', () => {
      const original = createWallet();
      const result = safeImportWallet(original.secretKey);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.publicKey).toBe(original.publicKey);
      }
    });

    it('should return failure result with INVALID_SECRET_KEY error for invalid secret key without throwing', () => {
      const result = safeImportWallet('invalid-key');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(PocketPayError);
        expect(result.error.code).toBe('INVALID_SECRET_KEY');
      }
    });
  });

  describe('enhancedImportWallet & safeEnhancedImportWallet', () => {
    it('should return enhanced success result for valid secret key', () => {
      const original = createWallet();
      const result = enhancedImportWallet(original.secretKey);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.publicKey).toBe(original.publicKey);
      }
    });

    it('should return enhanced failure result with recovery hints for invalid secret key', () => {
      const result = enhancedImportWallet('invalid-key');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_SECRET_KEY');
        expect(result.recoveryHints).toBeDefined();
        expect(result.recoveryHints?.some((h) => h.action === 'check_input')).toBe(true);
      }
    });

    it('safeEnhancedImportWallet should never throw and return enhanced result', () => {
      const result = safeEnhancedImportWallet('');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_SECRET_KEY');
      }
    });
  });

  describe('getPublicKey', () => {
    it('should derive the correct public key from a secret key', () => {
      const wallet = createWallet();
      const publicKey = getPublicKey(wallet.secretKey);
      expect(publicKey).toEqual(wallet.publicKey);
    });

    it('should throw for invalid secret key', () => {
      expect(() => getPublicKey('not-a-key')).toThrow(PocketPayError);
    });
  });

  describe('fixture validation', () => {
    it('fundedAccount fixture should have valid structure', () => {
      expect(fundedAccount.account_id).toMatch(/^G[A-Z0-9]{55}$/);
      expect(fundedAccount.balances.length).toBeGreaterThan(0);
      expect(fundedAccount.signers.length).toBeGreaterThan(0);
    });
  });
});

