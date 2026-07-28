# Signed Transaction Inspection

`inspectSignedTransaction` turns a built envelope into safe, readable metadata,
so you can confirm what a transaction does after signing but before submitting.

It **reads** the envelope and never echoes it: no XDR, no raw signatures, no key
material. `DIAGNOSTICS_SENSITIVE_KEYS` in `src/diagnostics/types.ts` already
lists `xdr`, `signedXDR`, `envelope`, `signature` and `signatures` among the keys
the SDK always redacts, and this helper follows the same policy rather than
introducing a second one.

## Example

```ts
import { signTransaction, inspectSignedTransaction } from 'stellar-pocketpay-sdk';

const signed = signTransaction(unsigned, secretKey);
const summary = inspectSignedTransaction(signed);

console.log(summary);
// {
//   sourceAccount: 'GABC...',
//   hash: '3f2a...',            // 64 hex characters
//   sequence: '101',
//   feeStroops: '100',
//   fee: '0.0000100',
//   operationCount: 1,
//   operations: [
//     { index: 0, type: 'payment', destination: 'GXYZ...', amount: '25.0000000', asset: 'XLM' }
//   ],
//   memo: 'invoice 42',
//   memoType: 'text',
//   networkPassphrase: 'Test SDF Network ; September 2015',
//   network: 'testnet',
//   signatureCount: 1,
//   signatures: [{ hint: '4f2b9a1c' }],
//   isSigned: true,
//   timeBounds: { minTime: '0', maxTime: '1753650030' },
//   isFeeBump: false
// }
```

## What it accepts

| Input | Notes |
| --- | --- |
| `Transaction` | Signed or unsigned. |
| `FeeBumpTransaction` | Reports `isFeeBump` and `feeSource`. |
| `SignedTransaction` | The SDK's own wrapper from offline preparation. |
| base64 XDR `string` | Requires the network passphrase as the second argument. |

```ts
inspectSignedTransaction(xdrString, Networks.TESTNET);
```

## What it reports

| Field | Meaning |
| --- | --- |
| `sourceAccount` | Source of the transaction. On a fee bump, the inner transaction's source. |
| `hash` | Transaction hash, hex encoded. |
| `sequence` | Sequence number the envelope was built against. |
| `feeStroops` / `fee` | Total fee, as stroops and as an exact decimal string. |
| `operationCount` / `operations` | Count and per-operation detail. |
| `memo` / `memoType` | Payload and its Stellar memo type. |
| `networkPassphrase` / `network` | The passphrase, plus a friendly name for the two well-known networks. |
| `signatureCount` / `signatures` | How many signatures, described by hint only. |
| `isSigned` | Whether the envelope carries any signature. |
| `timeBounds` | Declared bounds, when present. |
| `isFeeBump` / `feeSource` | Fee-bump flag and the account paying the fee. |

Field names follow `TransactionSummary` on the read side, so a transaction
inspected before submission and the same transaction fetched back from Horizon
describe themselves the same way.

Fees are formatted from the integer stroop count, not by dividing through a
float — see [Safe Amount Model](./amount-model.md).

## Signatures

Signatures are never exposed. Each is reported as a **hint**: the last four
bytes of the signer's public key, hex encoded. A hint lets you confirm that a
key you already know has signed; it does not let you derive a key you do not.

```ts
import { matchSignersByHint } from 'stellar-pocketpay-sdk';

matchSignersByHint(summary, [masterKey, cosignerKey]);
// ['GABC...'] — the ones whose hint appears on the envelope
```

Malformed candidate keys are skipped rather than failing the whole match.

## Invalid input

Every rejection is a `PocketPayError` carrying `validation.reason`:

| Reason | When |
| --- | --- |
| `missing_network_passphrase` | An XDR string was supplied without its passphrase. |
| `invalid_xdr` | The string is not a valid envelope. |
| `unsupported_input` | The value is not a transaction, wrapper, or XDR string. |

The underlying parser error is deliberately not forwarded, since it can quote
envelope bytes. Use `safeInspectSignedTransaction` for a non-throwing form:

```ts
const result = safeInspectSignedTransaction(input, passphrase);
if (!result.valid) console.error(result.error.validation?.reason);
```

## See also

- [Authorisation Requirements](./auth-requirements.md) — what a transaction needs signed.
- [Safe Amount Model](./amount-model.md) — exact amount handling.
- [Offline Transaction Preparation](./offline-transaction-preparation.md) — where `SignedTransaction` comes from.
