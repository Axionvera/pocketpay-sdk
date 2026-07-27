# Typed Asset Model Architecture

The PocketPay SDK uses a discriminated union for asset representations across all SDK functions (balances, payments, transaction summaries, and validation logic). 

This model ensures type safety, prevents invalid asset configurations at compile time, and supports both native XLM and Stellar issued assets (AlphaNum4 & AlphaNum12).

---

## 1. Asset Type Hierarchy

The `Asset` type is a discriminated union of `NativeAsset` and `IssuedAsset`:

```typescript
import { Asset, NativeAsset, IssuedAsset, NATIVE_ASSET } from '@axionvera/pocketpay-sdk';

// Native XLM Asset
const xlm: NativeAsset = NATIVE_ASSET;
// { type: 'native', code: 'XLM' }

// Issued Credit Asset (AlphaNum4 or AlphaNum12)
const usdc: IssuedAsset = {
  type: 'issued',
  code: 'USDC',
  issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335WF2CCX3THRDU2C2FYM235AC2',
};
