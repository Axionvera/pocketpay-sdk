# Logging Guidance

Safe logging practices for applications using the PocketPay SDK.

## Never Log Secret Keys

Secret keys grant full control over Stellar accounts. Never log them.

### Unsafe

console.log('Using key:', secretKey);
logger.info('Signing with', { secretKey });
console.error('Failed to sign', { key: secretKey, error });

### Safe

console.log('Signing transaction from public key:', publicKey);
logger.info('Transaction signed', { publicKey, txHash });
console.error('Signing failed', { publicKey, error: err.message });

## Safe Identifiers to Log

These are safe to include in logs:

| Data | Safe | Notes |
|------|------|-------|
| Public keys (G...) | Yes | Public by design |
| Transaction hashes | Yes | Already on-chain |
| Ledger numbers | Yes | Public data |
| Contract IDs | Yes | Public identifiers |
| Error messages | Yes | Strip sensitive context |
| Operation types | Yes | Not sensitive |

## Logging PocketPayError

When logging errors from the SDK, include structured metadata but exclude secrets:

try {
  await sdk.sendPayment({ destination, amount, secretKey });
} catch (error) {
  if (error instanceof PocketPayError) {
    logger.error('Payment failed', {
      code: error.code,
      message: error.message,
      destination,
      amount,
    });
  }
  throw error;
}

## Environment-Specific Logging

### Development
More detail is acceptable for debugging. Still exclude secret keys.

### Production
Log only what is needed for monitoring. Redact or omit all sensitive fields.

## Security Checklist

- Secret keys never appear in log output
- Log aggregation services have access controls
- Log retention policies are defined
- Error stack traces are suppressed in production
- Transaction hashes and public keys are treated as non-sensitive

See also [Security Best Practices](./security.md).
