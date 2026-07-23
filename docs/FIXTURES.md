# Transaction Summary Fixtures

The PocketPay SDK provides reusable `TransactionSummary` fixtures representing common transaction scenarios for tests and documentation examples.

## Transaction Summary Shape

The `TransactionSummary` object represents a high-level summary of a transaction formatted for mobile UI and SDK consumers:

```typescript
export interface TransactionSummary {
  /** Unique transaction identifier */
  id: string;
  /** Stellar transaction hash */
  txHash: string;
  /** Transaction direction ('incoming' | 'outgoing') */
  direction: TransactionDirection;
  /** Amount in smallest unit (e.g. stroops for XLM) */
  amount: string;
  /** Formatted human-readable amount string */
  amountDisplay: string;
  /** Asset code (e.g. 'XLM', 'USDC') */
  asset: string;
  /** Counterparty address */
  counterparty: string;
  /** Optional transaction memo */
  memo?: string;
  /** Transaction lifecycle status ('pending' | 'completed' | 'failed' | 'unknown') */
  status: TransactionStatus;
  /** ISO 8601 timestamp string */
  createdAt: string;
  /** Relative time representation (e.g., "2 hours ago") */
  timeAgo: string;
  /** Optional fee charged */
  fee?: string;
  /** Optional raw operation type */
  rawType?: string;
}
```

## Available Fixture States

The SDK exports the following fixtures from `stellar-pocketpay-sdk`:

1. **`successfulPaymentSummary`**: Reusable fixture for a successful completed payment (`TransactionStatus.COMPLETED`).
2. **`failedPaymentSummary`**: Reusable fixture for a failed transaction (`TransactionStatus.FAILED`).
3. **`pendingTransactionSummary`**: Reusable fixture for an in-flight pending payment (`TransactionStatus.PENDING`).
4. **`unknownTransactionSummary`**: Reusable fixture representing an unknown transaction state (`TransactionStatus.UNKNOWN`).
5. **`transactionSummaryFixtures`**: Collection object grouping all summary fixtures for batch test utilities.

## Usage Example

```typescript
import {
  successfulPaymentSummary,
  failedPaymentSummary,
  pendingTransactionSummary,
  unknownTransactionSummary,
  TransactionStatus,
} from 'stellar-pocketpay-sdk';

// Use in unit tests or docs
console.log(successfulPaymentSummary.status); // TransactionStatus.COMPLETED ('completed')
console.log(failedPaymentSummary.status);     // TransactionStatus.FAILED ('failed')
console.log(pendingTransactionSummary.status);  // TransactionStatus.PENDING ('pending')
console.log(unknownTransactionSummary.status);  // TransactionStatus.UNKNOWN ('unknown')
```
