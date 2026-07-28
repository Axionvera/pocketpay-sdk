# External Signer Integration

## Overview

The PocketPay SDK now supports an **external signer** model. Instead of exposing private keys, consumers can provide a signer that implements the `ExternalSignerAdapter` interface. This enables integration with hardware wallets, mobile wallets, browser extensions, or remote signing services.

## Interface

```ts
export interface ExternalSignerAdapter extends Signer {
  /** Transport or device family */
  readonly kind: 'hardware' | 'mobile' | 'browser' | 'remote';
  /** Simple synchronous probe – true when the adapter is available in the current environment */
  readonly isAvailable: boolean;
}
```

* `kind` is descriptive only; the SDK does not branch on its value.
* `isAvailable` tells callers whether the adapter is wired up (e.g., a browser extension is installed). It does **not** guarantee that a subsequent `sign` call will succeed.

## Usage Example

```ts
// Assume `myHardwareWallet` implements ExternalSignerAdapter
import { ExternalSignerAdapter } from 'pocketpay-sdk/src/account/types';
import { createAccountWithSigner } from 'pocketpay-sdk/src/account';

const identity = { publicKey: 'G...' };
const account = createAccountWithSigner(identity, myHardwareWallet);

if (account.canSign) {
  const tx = buildMyTransaction();
  const signedTx = await account.signer.sign(tx, Networks.TESTNET);
  // submit the signed transaction as usual
}
```

## Security Considerations

* **Never expose secret keys** – the external signer must keep the private material out of the JavaScript runtime.
* **Transport security** – if the signer communicates over a network, ensure TLS is used and verify the server's certificate.
* **User consent** – external devices often require explicit user confirmation (e.g., touching a hardware wallet). The SDK assumes the adapter handles this flow.

## Compatibility with Local Signer

The existing `LocalSigner` continues to work unchanged. Code that only needs a `Signer` can accept either implementation without modification.

## Testing

A minimal test demonstrates type compatibility:

```ts
import { createLocalSigner } from 'pocketpay-sdk/src/account';
import type { ExternalSignerAdapter } from 'pocketpay-sdk/src/account/types';

const local = createLocalSigner('S...');
// TypeScript verifies that `LocalSigner` satisfies `Signer`
const _: ExternalSignerAdapter = local as any; // cast for illustration only
```

---

**Reference**: See `src/account/types.ts` for the full interface definition.
