import {
  TransactionSummary,
  TransactionDirection,
  TransactionStatus,
} from '../types';

/**
  * Mock public addresses for fixtures (non-sensitive mock values)
  */
const MOCK_SENDER = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
const MOCK_RECIPIENT = 'GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3B2WSFGG4HYS';

/**
  * Reusable fixture representing a successful payment transaction.
  */
export const successfulPaymentSummary: TransactionSummary = {
  id: 'tx_succ_1001',
  txHash: 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef',
  direction: TransactionDirection.OUTGOING,
  amount: '10000000',
  amountDisplay: '1.0000000 XLM',
  asset: 'XLM',
  counterparty: MOCK_RECIPIENT,
  memo: 'Payment for services',
  status: TransactionStatus.COMPLETED,
  createdAt: '2024-01-15T10:30:00Z',
  timeAgo: '2 hours ago',
  fee: '100',
  rawType: 'payment',
};

/**
  * Reusable fixture representing a failed payment transaction.
  */
export const failedPaymentSummary: TransactionSummary = {
  id: 'tx_fail_1002',
  txHash: 'f6e5d4c3b2a109876543210987fedcba0987654321fedcba0987654321fedcba',
  direction: TransactionDirection.OUTGOING,
  amount: '5000000',
  amountDisplay: '0.5000000 XLM',
  asset: 'XLM',
  counterparty: MOCK_RECIPIENT,
  memo: 'Failed transfer',
  status: TransactionStatus.FAILED,
  createdAt: '2024-01-15T11:00:00Z',
  timeAgo: '1 hour ago',
  fee: '100',
  rawType: 'payment',
};

/**
  * Reusable fixture representing a pending transaction.
  */
export const pendingTransactionSummary: TransactionSummary = {
  id: 'tx_pend_1003',
  txHash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
  direction: TransactionDirection.INCOMING,
  amount: '25000000',
  amountDisplay: '2.5000000 XLM',
  asset: 'XLM',
  counterparty: MOCK_SENDER,
  memo: 'Pending deposit',
  status: TransactionStatus.PENDING,
  createdAt: '2024-01-15T11:25:00Z',
  timeAgo: '5 minutes ago',
  fee: '100',
  rawType: 'payment',
};

/**
  * Reusable fixture representing an unknown transaction state.
  */
export const unknownTransactionSummary: TransactionSummary = {
  id: 'tx_unkn_1004',
  txHash: '0000000000000000000000000000000000000000000000000000000000000000',
  direction: TransactionDirection.INCOMING,
  amount: '0',
  amountDisplay: '0 XLM',
  asset: 'XLM',
  counterparty: 'UNKNOWN_COUNTERPARTY',
  status: TransactionStatus.UNKNOWN,
  createdAt: '1970-01-01T00:00:00Z',
  timeAgo: 'unknown',
};

/**
  * Collection of common transaction summary fixtures for tests and documentation.
  */
export const transactionSummaryFixtures = {
  successfulPayment: successfulPaymentSummary,
  failedPayment: failedPaymentSummary,
  pendingTransaction: pendingTransactionSummary,
  unknownTransaction: unknownTransactionSummary,
};
