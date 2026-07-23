# Transaction Summary Mapper API Reference

## Overview

The transaction summary mapper converts raw Stellar Horizon transactions into a simplified format suitable for mobile UI consumption.

## Types

### TransactionSummary

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique transaction identifier |
| `txHash` | `string` | Stellar transaction hash |
| `direction` | `'incoming' \| 'outgoing'` | Transaction direction relative to the user |
| `amount` | `string` | Amount in the asset's smallest unit |
| `amountDisplay` | `string` | Human-readable formatted amount |
| `asset` | `string` | Asset code (XLM, USDC, etc.) |
| `counterparty` | `string` | Address of the other party |
| `memo` | `string?` | Transaction memo |
| `status` | `'pending' \| 'completed' \| 'failed'` | Transaction status |
| `createdAt` | `string` | ISO timestamp of the transaction |
| `timeAgo` | `string` | Human-readable relative time |
| `fee` | `string?` | Fee paid for the transaction |
| `rawType` | `string?` | Raw transaction type from Horizon |

## Functions

### mapTransactionToSummary

Maps a single raw transaction to a summary.

```ts
function mapTransactionToSummary(
  rawTransaction: RawHorizonTransaction,
  options: TransactionMapperOptions
): TransactionSummary
const summary = mapTransactionToSummary(rawTx, {
  userAccount: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
  formatAmounts: true,
});

console.log(summary.amountDisplay); // "10.5000000"
console.log(summary.timeAgo); // "2 hours ago"
function mapTransactionsToSummaries(
  rawTransactions: RawHorizonTransaction[],
  options: TransactionMapperOptions
): TransactionSummary[]
const summaries = mapTransactionsToSummaries(rawTxs, {
  userAccount: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
});

summaries.forEach((summary) => {
  console.log(`${summary.direction}: ${summary.amountDisplay} ${summary.asset}`);
});
const TransactionList = ({ transactions }) => {
  const summaries = mapTransactionsToSummaries(transactions, {
    userAccount: currentUser.address,
    formatAmounts: true,
  });

  return (
    <ul>
      {summaries.map((tx) => (
        <li key={tx.id}>
          <span>{tx.direction === 'incoming' ? '📥' : '📤'}</span>
          <span>{tx.amountDisplay} {tx.asset}</span>
          <span>{tx.counterparty}</span>
          <span>{tx.timeAgo}</span>
        </li>
      ))}
    </ul>
  );
};
const TransactionDetail = ({ transaction }) => {
  const summary = mapTransactionToSummary(transaction, {
    userAccount: currentUser.address,
  });

  return (
    <div>
      <h2>Transaction Details</h2>
      <p>Hash: {summary.txHash}</p>
      <p>Amount: {summary.amountDisplay} {summary.asset}</p>
      <p>From: {summary.direction === 'incoming' ? summary.counterparty : 'You'}</p>
      <p>To: {summary.direction === 'outgoing' ? summary.counterparty : 'You'}</p>
      <p>Status: {summary.status}</p>
      <p>Date: {summary.createdAt}</p>
      {summary.memo && <p>Memo: {summary.memo}</p>}
    </div>
  );
};
```

### validateSendXLMParams

Non-throwing input validation for `sendXLM`. Runs the same preflight checks `sendXLM` performs internally (secret key format, destination key format, amount, memo, self-payment) and returns a structured result rather than throwing on the first failure. Pure: no Horizon calls, no signing, no transaction submission.

```ts
function validateSendXLMParams(params: SendXLMParams): SendXLMValidationResult;

type SendXLMValidationResult =
  | { ok: true }
  | { ok: false; errors: ValidationError[] };

interface ValidationError {
  code:
    | 'INVALID_SECRET_KEY'
    | 'INVALID_PUBLIC_KEY'
    | 'INVALID_AMOUNT'
    | 'INVALID_AMOUNT_PRECISION'
    | 'INVALID_MEMO'
    | 'SELF_PAYMENT';
  field: 'sourceSecret' | 'destination' | 'amount' | 'memo';
  reason: string;
  message: string;
}
```

Consumers should branch on `err.code`; codes are part of the public contract, messages are not. See `docs/getting-started.md` for a form-integration example.
