/**
 * Tests for the Utils module.
 */

import { describe, it, expect } from 'vitest';
import {
  validatePublicKey,
  validateSecretKey,
  validateAmount,
  stroopsToXLM,
  xlmToStroops,
  truncateAddress,
  PocketPayError,
  createWallet,
} from '../src';

describe('Utils Module', () => {
  describe('validatePublicKey', () => {
    it('should accept a valid public key', () => {
      const wallet = createWallet();
      expect(validatePublicKey(wallet.publicKey)).toBe(true);
    });

    it('should throw for an invalid public key', () => {
      expect(() => validatePublicKey('GINVALID')).toThrow(PocketPayError);
    });

    it('should throw for a secret key passed as public key', () => {
      const wallet = createWallet();
      expect(() => validatePublicKey(wallet.secretKey)).toThrow(PocketPayError);
    });
  });

  describe('validateSecretKey', () => {
    it('should accept a valid secret key', () => {
      const wallet = createWallet();
      expect(validateSecretKey(wallet.secretKey)).toBe(true);
    });

    it('should throw for an invalid secret key', () => {
      expect(() => validateSecretKey('SINVALID')).toThrow(PocketPayError);
    });
  });

  describe('validateAmount', () => {
    it('should accept valid amounts', () => {
      expect(validateAmount('10')).toBe(true);
      expect(validateAmount('0.001')).toBe(true);
      expect(validateAmount('100.1234567')).toBe(true);
    });

    it('should reject zero', () => {
      expect(() => validateAmount('0')).toThrow(PocketPayError);
    });

    it('should reject negative amounts', () => {
      expect(() => validateAmount('-5')).toThrow(PocketPayError);
    });

    it('should reject non-numeric strings', () => {
      expect(() => validateAmount('abc')).toThrow(PocketPayError);
    });

    it('should reject amounts with too many decimals', () => {
      expect(() => validateAmount('1.12345678')).toThrow(PocketPayError);
    });
  });

  describe('stroopsToXLM', () => {
    it('should convert stroops to XLM', () => {
      expect(stroopsToXLM(10000000)).toBe('1.0000000');
      expect(stroopsToXLM('50000000')).toBe('5.0000000');
      expect(stroopsToXLM(1)).toBe('0.0000001');
    });
  });

  describe('xlmToStroops', () => {
    it('should convert XLM to stroops', () => {
      expect(xlmToStroops('1')).toBe(10000000);
      expect(xlmToStroops(0.5)).toBe(5000000);
      expect(xlmToStroops('0.0000001')).toBe(1);
    });
  });

  describe('truncateAddress', () => {
    it('should truncate a long address', () => {
      const addr = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV';
      const truncated = truncateAddress(addr);
      expect(truncated).toMatch(/^GABC\.\.\.STUV$/);
    });

    it('should return short strings as-is', () => {
      expect(truncateAddress('ABCD')).toBe('ABCD');
    });

    it('should support custom char counts', () => {
      const addr = 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUV';
      const truncated = truncateAddress(addr, 6, 6);
      expect(truncated).toMatch(/^GABCDE\.\.\.QRSTUV$/);
    });
  });
});
