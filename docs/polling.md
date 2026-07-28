# Transaction Polling

When you submit a transaction, you may need to wait for its confirmation status, especially if the initial submission times out or you are verifying an asynchronous operation.

The SDK provides a built-in polling helper, `pollTransaction`, to make this easy.

## `pollTransaction`

```typescript
import { pollTransaction } from '@axionvera/pocketpay-sdk';

async function checkStatus(txHash: string) {
  const result = await pollTransaction(txHash, {
    interval: 2000, // Poll every 2 seconds
    timeout: 30000, // Timeout after 30 seconds
  });

  if (result.status === 'success') {
    console.log('Transaction succeeded!', result.transaction);
  } else if (result.status === 'failure') {
    console.error('Transaction failed on ledger', result.transaction);
  } else if (result.status === 'timeout') {
    console.warn('Timed out waiting for confirmation');
  } else {
    console.error('Unknown status or unexpected error:', result.error);
  }
}
```

The polling utility correctly handles `404 Not Found` errors (which Horizon returns before a transaction is included in a ledger) and network timeouts, retrying until the transaction is found or the timeout is reached.
