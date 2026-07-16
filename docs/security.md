# Security Best Practices

Security guidance for applications using the PocketPay SDK.

## Key Management

- Never hardcode secret keys in source code
- Use environment variables or secure key stores
- Rotate keys periodically
- Use separate keys for development and production

## Logging

See [Logging Guidance](./logging.md) for safe logging practices.

## Transaction Safety

- Always verify transaction envelopes before signing
- Check destination addresses match expected values
- Set appropriate time bounds on transactions

## Error Handling

- Do not expose internal error details to end users
- Log errors safely following the logging guidance
- Validate all user inputs before constructing transactions
