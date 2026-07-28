# Transaction Authorisation Requirements

Before submitting a transaction you often need to know what it requires: which
threshold its operations must clear, which signers can contribute weight, and —
for Soroban — which addresses must approve the contract call.

This page documents `mapAuthRequirements`, which turns a built transaction into
typed metadata. It holds public keys, weights and thresholds only, and never
touches key material.

## Two independent layers

**Classic Stellar** authorises by weight. Each operation declares a threshold —
`low`, `medium` or `high` — and the account carries three threshold values plus
a signer list. A transaction is authorised when the combined weight of its
signatures reaches the strictest threshold its operations need.

**Soroban** adds a separate layer. A contract invocation carries authorisation
entries naming the addresses that must approve it; those are approved on-chain,
not by signature weight. Satisfying one layer does not satisfy the other.

## Basic usage

The mapper is pure — it does not touch the network. Give it a transaction, and
optionally the account state, and it computes what it can:

```ts
import { mapAuthRequirements } from 'stellar-pocketpay-sdk';

const summary = mapAuthRequirements(transaction);

summary.sourceAccount;      // 'G...'
summary.highestThreshold;   // 'medium'
summary.requirements;       // one entry per threshold level
summary.presentSigners;     // [] until the transaction is signed
summary.satisfied;          // undefined — not decidable without account data
```

## With account data

Supply the account's signers and thresholds to resolve weights and decide
whether the transaction is authorised:

```ts
import { mapAuthRequirements, toAuthAccountState } from 'stellar-pocketpay-sdk';

const record = await server.loadAccount(sourcePublicKey);
const account = toAuthAccountState(record);

const summary = mapAuthRequirements(transaction, { account });

if (summary.satisfied === false) {
  console.log('Still needs weight; eligible signers:', summary.unmet?.[0].eligibleSigners);
}
```

`toAuthAccountState` is separate from the mapper on purpose: you decide when to
pay for the Horizon round trip, and the mapper stays testable offline.

## Unknown is never an approval

`satisfied` is `boolean | undefined`. It is `undefined` — not `false`, and never
`true` — whenever the answer cannot be determined:

- no account data was supplied
- an operation could not be classified
- the transaction carries Soroban authorisation entries, which are approved
  on-chain and cannot be judged from the envelope

Treat `undefined` as "check further", never as permission to submit.

## Operation thresholds

| Threshold | Operations |
| --- | --- |
| `low` | `allowTrust`, `setTrustLineFlags` |
| `medium` | `payment`, path payments, `createAccount`, `changeTrust`, offers, `manageData`, `bumpSequence`, claimable balances, sponsorship, clawback, liquidity pools, `invokeHostFunction`, footprint operations |
| `high` | `accountMerge`, and `setOptions` when it changes signers, thresholds or the master weight |

`setOptions` is the one operation whose threshold depends on its contents: it
needs `high` only when it can change control of the account, and `medium`
otherwise.

Operation types outside this table are reported in `unsupportedOperations`
rather than assigned a guessed threshold — assuming one is exactly the unsafe
signing assumption to avoid. Use `assertAuthFullyMapped(summary)` to turn that
into an `UnsupportedFeatureError` when a caller needs a complete picture.

## Soroban authorisation entries

`simulateTransaction` reports required authorisations in `result.auth`. The
contract client exposes them:

```ts
import { createContractClient, mapAuthRequirements } from 'stellar-pocketpay-sdk';

const client = createContractClient({ contractId });
const auth = await client.getAuthorizationEntries({
  method: 'transfer',
  params: { from, to, amount },
  paramTypes: { from: 'address', to: 'address', amount: 'i128' },
  sourcePublicKey,
});

const summary = mapAuthRequirements(transaction, { account, sorobanAuth: auth });
```

Entries with source-account credentials are covered by the transaction's own
signature and are not reported separately; only entries naming a distinct
address produce a `contract_authorization` requirement.

## Identifying signatures

`identifyPresentSigners` matches signature hints — the last four bytes of a
signer's public key — against a list of candidate public keys. It can only
identify signers you already know, and it reads nothing secret.

```ts
identifyPresentSigners(transaction, [master, cosigner]); // ['G...master']
```

## See also

- [Account Abstraction](./account-abstraction.md) — identities and signers.
- [Capability Error Standard](./capability_error_standard.md) — the
  `UnsupportedFeatureError` used for unclassified operations.
- [Soroban Vault](./soroban-vault.md) — contract invocation.
