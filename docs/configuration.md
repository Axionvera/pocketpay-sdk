# Configuration (Environment Variables)

This SDK can be configured via environment variables. If you also pass configuration objects to SDK functions, **function-level overrides take precedence** over environment variables, which in turn take precedence over SDK defaults.

## Quick reference

| Variable | Purpose | Required? | Default (when omitted) | Example |
|---|---|---:|---|---|
| `STELLAR_NETWORK` | Selects the Stellar network to connect to. | No | `testnet` | `STELLAR_NETWORK=testnet` |
| `STELLAR_HORIZON_URL` | Overrides the Horizon server URL used for ledger queries. | No | Based on `STELLAR_NETWORK` | `STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org` |
| `STELLAR_SOROBAN_RPC_URL` | Overrides the Soroban RPC endpoint used for Soroban contract interactions. | No | Based on `STELLAR_NETWORK` | `STELLAR_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org` |
| `STELLAR_TIMEOUT` | Request timeout in milliseconds. | No | Not set (SDK default behavior) | `STELLAR_TIMEOUT=45000` |
| `STELLAR_CONTRACT_ID` | Optional Soroban contract id used when resolving config (validated if provided). | No | Not set | `STELLAR_CONTRACT_ID=C...` |
| `VAULT_CONTRACT_ID` | Vault contract id used by vault functions when `contractId` is not provided via params. | Conditional | No default — must be provided for vault ops without param | `VAULT_CONTRACT_ID=C...` |

## Network-based defaults

If you only set `STELLAR_NETWORK`, the SDK resolves the URLs automatically:

- When `STELLAR_NETWORK=testnet`:
  - `STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org`
  - `STELLAR_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org`

- When `STELLAR_NETWORK=mainnet`:
  - `STELLAR_HORIZON_URL=https://horizon.stellar.org`
  - `STELLAR_SOROBAN_RPC_URL=https://soroban.stellar.org`

## Vault contract id behavior

Vault functions require a contract id.

- If you pass `contractId` via the function params, that value is used.
- Otherwise, the SDK falls back to `VAULT_CONTRACT_ID`.
- If neither is provided, vault functions throw an error (`MISSING_CONTRACT_ID`).

## Example `.env`

```bash
# Network (default: testnet)
STELLAR_NETWORK=testnet

# Optional overrides (defaults are resolved from STELLAR_NETWORK)
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org

# Vault (required unless you pass contractId in params)
VAULT_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# Optional
STELLAR_TIMEOUT=45000
# STELLAR_CONTRACT_ID=C...   # optional (validated if provided)
```

