# Testnet Account Funding

How to fund and activate Stellar Testnet accounts when building with the PocketPay SDK. For a full end-to-end walkthrough, see [Getting Started](./getting-started.md). This guide is a focused reference for account activation and the errors you will see when an account has not been funded yet.

## Why Accounts Must Be Funded

A newly generated keypair does not exist on the Stellar ledger until it is funded with a minimum balance of XLM, the native Stellar asset. Until an account is funded:

- Reading its balance fails, because the account is not on-chain yet.
- Sending a payment from it fails, because the source account does not exist.
- Reading its transaction or payment history returns nothing useful.

On Testnet you can fund an account for free with Friendbot. On Mainnet you must send real XLM to the account from an already-funded account or an exchange.

## Funding a Testnet Account with Friendbot

The SDK exposes fundTestnetAccount, which asks Friendbot to create and fund the account with test XLM. Pass the public key of the wallet you want to activate:

    import { createWallet, fundTestnetAccount } from "stellar-pocketpay-sdk";

    const wallet = createWallet();
    const result = await fundTestnetAccount(wallet.publicKey);

    if (result.success) {
      // The account is now active on Testnet.
      console.log("Funded in ledger", result.ledger, "tx", result.hash);
    } else {
      console.error("Funding failed:", result.error);
    }

Friendbot exists only on Testnet. There is no free funding on Mainnet.

## Confirming Account Activation

After funding, confirm the account is active by reading its balance. Once the account exists on-chain, getBalance returns its balances instead of reporting that the account was not found:

    import { getBalance } from "stellar-pocketpay-sdk";

    const balances = await getBalance(wallet.publicKey);

If getBalance still reports that the account was not found, the funding request has not been applied yet. Wait a moment and try again.

## Common Errors from Unfunded Accounts

| Symptom | Cause | What to do |
| --- | --- | --- |
| Account not found (404) | The account has never been funded, so it is not on-chain | On Testnet, call fundTestnetAccount(publicKey). On Mainnet, send at least 1 to 2 XLM from a funded account |
| Friendbot returns 429 (too many requests) | Friendbot rate-limits repeated funding for the same address or IP | Wait 10 to 15 seconds, then retry |
| Timeout or network error | Horizon or Friendbot was slow or unreachable | Retry with backoff. See [Network Error Handling](./network-errors.md) |

## Notes

- Friendbot grants a large amount of test XLM per request. Treat these balances as disposable test funds with no real-world value.
- Testnet is reset periodically by the network operators, so funded Testnet accounts are not permanent.
- Never reuse a Testnet secret key on Mainnet.

See also [Getting Started](./getting-started.md), [Network Error Handling](./network-errors.md), and [Security Best Practices](./security.md).