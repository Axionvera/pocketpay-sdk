import { describe, it, expect } from 'vitest';
import {
getAccountExplorerLink,
getTransactionExplorerLink,
getOperationExplorerLink,
} from '../src/utils/explorer';

describe('Explorer Link Builders (Issue #140)', () => {
  const TEST_PUBLIC_KEY = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';
  const TEST_TX_HASH = '0000000000000000000000000000000000000000000000000000000000000000';
  const TEST_OP_ID = '1234567890';

  describe('getAccountExplorerLink', () => {
    it('builds testnet account links', () => {
      expect(getAccountExplorerLink(TEST_PUBLIC_KEY, 'testnet'))
        .toBe(`https://stellar.expert/explorer/testnet/account/${TEST_PUBLIC_KEY}`);
    });

    it('builds mainnet account links using "public"', () => {
      expect(getAccountExplorerLink(TEST_PUBLIC_KEY, 'mainnet'))
        .toBe(`https://stellar.expert/explorer/public/account/${TEST_PUBLIC_KEY}`);
    });

    it('throws on invalid public key', () => {
      expect(() => getAccountExplorerLink('invalid', 'testnet'))
        .toThrowError(/Invalid Stellar public key/);
    });
  });

  describe('getTransactionExplorerLink', () => {
    it('builds testnet transaction links', () => {
      expect(getTransactionExplorerLink(TEST_TX_HASH, 'testnet'))
        .toBe(`https://stellar.expert/explorer/testnet/tx/${TEST_TX_HASH}`);
    });

    it('builds mainnet transaction links', () => {
      expect(getTransactionExplorerLink(TEST_TX_HASH, 'mainnet'))
        .toBe(`https://stellar.expert/explorer/public/tx/${TEST_TX_HASH}`);
    });

    it('throws on invalid transaction hash', () => {
      expect(() => getTransactionExplorerLink('too-short', 'testnet'))
        .toThrowError(/Invalid transaction hash/);
    });
  });

  describe('getOperationExplorerLink', () => {
    it('builds testnet operation links', () => {
      expect(getOperationExplorerLink(TEST_OP_ID, 'testnet'))
        .toBe(`https://stellar.expert/explorer/testnet/op/${TEST_OP_ID}`);
    });

    it('builds mainnet operation links', () => {
      expect(getOperationExplorerLink(TEST_OP_ID, 'mainnet'))
        .toBe(`https://stellar.expert/explorer/public/op/${TEST_OP_ID}`);
    });

    it('throws on invalid operation ID', () => {
      expect(() => getOperationExplorerLink('123abc', 'testnet'))
        .toThrowError(/Invalid operation ID/);
      expect(() => getOperationExplorerLink('', 'testnet'))
        .toThrowError(/Invalid operation ID/);
    });
  });
});