import { describe, it, expect } from 'vitest';
import {
  successfulPaymentSummary,
  failedPaymentSummary,
  pendingTransactionSummary,
  unknownTransactionSummary,
  transactionSummaryFixtures,
  TransactionStatus,
} from '../src';

describe('Transaction Summary Fixtures', () => {
  it('should provide a valid successful payment summary fixture', () => {
    expect(successfulPaymentSummary.status).toBe(TransactionStatus.COMPLETED);
    expect(successfulPaymentSummary.id).toBeDefined();
    expect(successfulPaymentSummary.amount).toBe('10000000');
    expect(successfulPaymentSummary.counterparty).toBeDefined();
  });

  it('should provide a valid failed payment summary fixture', () => {
    expect(failedPaymentSummary.status).toBe(TransactionStatus.FAILED);
    expect(failedPaymentSummary.id).toBeDefined();
    expect(failedPaymentSummary.amount).toBe('5000000');
  });

  it('should provide a valid pending transaction summary fixture', () => {
    expect(pendingTransactionSummary.status).toBe(TransactionStatus.PENDING);
    expect(pendingTransactionSummary.id).toBeDefined();
    expect(pendingTransactionSummary.counterparty).toBeDefined();
  });

  it('should provide a valid unknown transaction state fixture', () => {
    expect(unknownTransactionSummary.status).toBe(TransactionStatus.UNKNOWN);
    expect(unknownTransactionSummary.id).toBeDefined();
    expect(unknownTransactionSummary.amount).toBe('0');
  });

  it('should bundle all fixtures into transactionSummaryFixtures object', () => {
    expect(transactionSummaryFixtures.successfulPayment).toEqual(successfulPaymentSummary);
    expect(transactionSummaryFixtures.failedPayment).toEqual(failedPaymentSummary);
    expect(transactionSummaryFixtures.pendingTransaction).toEqual(pendingTransactionSummary);
    expect(transactionSummaryFixtures.unknownTransaction).toEqual(unknownTransactionSummary);
  });
});
