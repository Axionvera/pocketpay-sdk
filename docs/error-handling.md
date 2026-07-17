# Error Handling

PocketPay SDK provides error handling for common Stellar network failures.

## Error Types

The SDK surfaces errors from Horizon, Friendbot, and Soroban RPC with the original status codes and messages preserved.

## Quick Reference

- Transient network failures (429, 503, 504, connection errors) are safe to retry
- Validation errors (400, 422) require fixing the request
- Account state errors (404, insufficient balance) require user action
- See [Network Errors Guide](./network-errors.md) for detailed guidance
