# Transaction Fee Estimation

The PocketPay SDK provides robust transaction fee estimation capabilities to help consumers display safe fee bounds to users.

Stellar transactions require a fee, and during times of high network activity, the base fee may not be enough to get a transaction included in the next ledger (surge pricing). The SDK exposes a `fetchFeeEstimate()` helper to resolve these estimates and handle fallback scenarios securely.

## Fee Estimate Type

A `FeeEstimate` breaks down network fee statistics into actionable tiers. All fee values are in **stroops** (1 XLM = 10,000,000 stroops).

```typescript
export interface FeeEstimate {
  /** The estimated fee for a high probability of fast inclusion (e.g., p95) */
  high: string;
  /** The estimated fee for standard/average inclusion (e.g., p50) */
  standard: string;
  /** The estimated fee for low priority inclusion (e.g., p10) */
  low: string;
  /** The absolute minimum base fee required by the network (usually 100 stroops) */
  baseFee: string;
  
  /** True if the network is experiencing high capacity usage (> 80%) */
  surgePricing: boolean;
  /** True if the fee stats could not be fetched and the SDK is falling back */
  isFallback: boolean;
}
```

## Obtaining Fee Estimates

You can fetch fee estimates directly using `fetchFeeEstimate`:

```typescript
import { fetchFeeEstimate } from 'pocketpay-sdk';

const estimate = await fetchFeeEstimate();
console.log(`Standard fee recommendation: ${estimate.standard} stroops`);

if (estimate.surgePricing) {
  console.warn("Network is busy, recommending the 'high' fee tier!");
}
```

Alternatively, when using the offline transaction preparation workflow, `fetchNetworkState()` automatically resolves the fee estimate for you:

```typescript
import { fetchNetworkState } from 'pocketpay-sdk';

const state = await fetchNetworkState('G...');
console.log(state.feeEstimate);
```

## Fallback Behaviour

If the Horizon `/fee_stats` endpoint is unreachable or fails for any reason, the SDK **does not throw an error**. Instead, it falls back to safe default minimums derived from the hardcoded `StellarSDK.BASE_FEE` (100 stroops). 

In fallback mode:
- `isFallback` is set to `true`.
- `surgePricing` is set to `false`.
- The tiers are calculated as multiples of the base fee (e.g., `high` = 500, `standard` = 200, `low` = 100).

## Uncertainty Handling and Best Practices

1. **Never Guarantee Exact Fees:** Stellar fee estimation provides an *upper bound* (`max_fee`), not an exact cost. The network will only charge the minimum fee required for inclusion (`fee_charged`), up to the transaction's `max_fee`. You should clarify to users that the fee is an *estimate* or a *maximum*.
2. **Surge Pricing:** Use the `surgePricing` boolean to decide whether to prompt the user to use a higher fee or warn them about potential delays.
