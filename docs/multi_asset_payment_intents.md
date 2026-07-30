# Multi-Asset Payment Intent Model

The Stellar PocketPay SDK provides a comprehensive **Multi-Asset Payment Intent Model** for creating, validating, and managing payment intents across Native XLM and issued Stellar assets (e.g. USDC, EURT).

## Overview & Key Capabilities

- **Distinct Asset Representations**: Strong TypeScript discriminated unions for `NativeAsset` and `IssuedAsset`.
- **Asset Metadata**: Attach metadata (name, domain, decimals, icon URL, issuer info) directly to payment intents.
- **Preflight Validation**: Validate source key, destination address, amount, asset structure, and memo before hitting the network.
- **Asset State Evaluation**: Categorize assets into `supported`, `unsupported`, `restricted`, or `pending_trustline`.
- **Trustline Validation Strategy**: Evaluates recipient account trustlines and available capacity prior to submission.

## Types & Interfaces

```typescript
import {
  Asset,
  NativeAsset,
  IssuedAsset,
  PaymentIntent,
  CreatePaymentIntentParams,
  AssetMetadata,
} from 'stellar-pocketpay-sdk';

// Native XLM Asset
const nativeAsset: NativeAsset = {
  type: 'native',
  code: 'XLM',
};

// Issued Asset (e.g., Circle USDC on Stellar)
const usdcAsset: IssuedAsset = {
  type: 'issued',
  code: 'USDC',
  issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335WF2CCAJ3KPXYSVGGAZAC47ZZ',
};
```

## Creating a Payment Intent

Use `createPaymentIntent` to instantiate a payment intent object with automatic preflight validation:

```typescript
import { createPaymentIntent } from 'stellar-pocketpay-sdk';

const intent = createPaymentIntent({
  source: 'G... (Source Public Key or Secret)',
  destination: 'G... (Destination Public Key)',
  amount: '100.5000000',
  asset: usdcAsset,
  assetMetadata: {
    name: 'USD Coin',
    domain: 'centre.io',
    decimals: 7,
    iconUrl: 'https://centre.io/usdc.png',
  },
  memo: 'Order #9872',
  trustlineStrategy: 'auto_check',
});

console.log(intent.status); // 'valid' | 'invalid' | 'unsupported_asset'
console.log(intent.assetState); // 'supported' | 'unsupported' | 'restricted'
```

## Trustline Validation Strategy

The SDK supports flexible trustline validation strategies for issued assets:

- `'auto_check'` (default): Queries Horizon to verify the recipient account has an active, authorized trustline with sufficient capacity for the transfer.
- `'require_existing'`: Fails immediately if the destination does not already possess an authorized trustline.
- `'skip'`: Skips network trustline pre-flight checks (useful for offline intent signing or custom validation wrappers).

```typescript
import { checkPaymentIntentTrustline } from 'stellar-pocketpay-sdk';

const trustlineResult = await checkPaymentIntentTrustline(intent);
if (!trustlineResult.hasTrustline) {
  console.error(`Destination missing trustline: ${trustlineResult.error}`);
}
```

## Error Handling & Asset Validation

Invalid inputs surface typed validation issues inside `intent.validationResult.issues`:

```typescript
if (!intent.validationResult?.valid) {
  for (const issue of intent.validationResult.issues) {
    console.error(`Field [${issue.field}] failed: ${issue.message}`);
  }
}
```

Unsupported or malformed asset states return typed errors (`PAYMENT_ASSET_UNSUPPORTED`, `TX_INVALID_ASSET`, `MISSING_TRUSTLINE`).
