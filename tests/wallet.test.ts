import { describe, it, expect } from 'vitest';
import { createWallet, importWallet, getPublicKey, PocketPayError } from '../src';
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

  describe('importWallet', () => {
    it('should import a wallet from a valid secret key', () => {
      const original = createWallet();
      const imported = importWallet(original.secretKey);
      expect(imported.publicKey).toEqual(original.publicKey);
      expect(imported.secretKey).toEqual(original.secretKey);
    });

    it('should throw PocketPayError for invalid secret key', () => {
      expect(() => importWallet('INVALID_KEY')).toThrow(PocketPayError);
      expect(() => importWallet('INVALID_KEY')).toThrow('Invalid Stellar secret key');
    });

    it('should throw for empty string', () => {
      expect(() => importWallet('')).toThrow(PocketPayError);
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
