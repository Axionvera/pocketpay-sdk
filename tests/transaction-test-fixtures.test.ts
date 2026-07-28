import { describe, it, expect } from 'vitest';
import { 
  createPreparedTransactionFixture, 
  createUnsignedTransactionFixture, 
  createSignedTransactionFixture, 
  createSubmissionResultFixture,
  FIXTURE_SOURCE_PK,
  FIXTURE_DESTINATION_PK
} from '../src/transactions/test-fixtures';
import * as StellarSDK from '@stellar/stellar-sdk';

describe('Transaction Fixture Generators', () => {
  describe('createPreparedTransactionFixture', () => {
    it('should generate a deterministic prepared transaction', () => {
      const fixture = createPreparedTransactionFixture();
      
      expect(fixture.sourcePublicKey).toBe(FIXTURE_SOURCE_PK);
      expect(fixture.readyToBuild).toBe(true);
      expect(fixture.baseFee).toBe('100');
      expect(fixture.operations[0].destination).toBe(FIXTURE_DESTINATION_PK);
    });

    it('should allow overrides', () => {
      const fixture = createPreparedTransactionFixture({ baseFee: '500' });
      expect(fixture.baseFee).toBe('500');
      expect(fixture.sourcePublicKey).toBe(FIXTURE_SOURCE_PK);
    });
  });

  describe('createUnsignedTransactionFixture', () => {
    it('should generate a deterministic unsigned transaction with a real Stellar transaction object', () => {
      const fixture = createUnsignedTransactionFixture();
      
      expect(fixture.transaction).toBeInstanceOf(StellarSDK.Transaction);
      expect(fixture.sourcePublicKey).toBe(FIXTURE_SOURCE_PK);
      expect(fixture.hash).toBeDefined();
    });

    it('should apply overrides to the transaction builder inputs', () => {
      const fixture = createUnsignedTransactionFixture({ memo: 'Test Memo' });
      
      expect(fixture.transaction.memo.value?.toString()).toBe('Test Memo');
    });
  });

  describe('createSignedTransactionFixture', () => {
    it('should generate a deterministic signed transaction with signatures', () => {
      const fixture = createSignedTransactionFixture();
      
      expect(fixture.transaction.signatures.length).toBe(1);
      expect(fixture.xdr).toBeDefined();
    });
  });

  describe('createSubmissionResultFixture', () => {
    it('should generate a success result', () => {
      const fixture = createSubmissionResultFixture('success');
      expect(fixture.success).toBe(true);
      if (fixture.success) {
        expect(fixture.ledger).toBeDefined();
      }
    });

    it('should generate a failure result', () => {
      const fixture = createSubmissionResultFixture('failed');
      expect(fixture.success).toBe(false);
      if (!fixture.success) {
        expect(fixture.errorCode).toBe('TX_FAILED');
      }
    });

    it('should generate an unknown result', () => {
      const fixture = createSubmissionResultFixture('unknown');
      expect(fixture.success).toBe(false);
      if (!fixture.success) {
        expect(fixture.errorCode).toBe('TX_STATUS_UNKNOWN');
      }
    });
  });
});
