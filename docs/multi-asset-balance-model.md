# Multi-Asset Balance Model Guide

Resolves [Issue #166](https://github.com/Axionvera/pocketpay-sdk/issues/166).

This guide documents the PocketPay SDK **Multi-Asset Balance Model** designed for mobile and web UI consumers. It provides a rich, strongly typed representation of account balances supporting native XLM, issued credit assets (e.g. USDC, EURT), protocol reserve calculations, issuer authorization states, and unavailable/unknown balance handling.

---

## 1. Overview & Problem Statement

On the Stellar network, a single account can hold:
1. **Native XLM**: The native network currency required for account creation, transaction fees, and base reserves.
2. **Issued Credit Assets**: Custom tokens (such as USDC, EURT, or project tokens) issued by third-party Stellar accounts via trustlines (`ChangeTrust`).

A simple `nativeBalance` string does not scale for multi-asset wallets or mobile interfaces. Furthermore, Stellar accounts encumber balances for:
* **Base Reserve**: Minimum XLM reserve required to maintain the account and its subentries (`1.0 XLM + 0.5 XLM * subentry_count`).
* **Selling Liabilities**: Balances committed to open DEX sell offers.
* **Issuer Authorization**: Issued assets whose trustlines have been revoked or not yet authorized by the asset issuer.

The PocketPay SDK Multi-Asset Balance Model exposes these details cleanly to prevent accidental spend attempts and give UI consumers exact, display-ready data.

---

## 2. Model Structure

### `MultiAssetBalance`

```ts
export interface MultiAssetBalance {
  /** Stellar public key (G...) of the account */
  publicKey: string;
  /** Overall account status ('funded' | 'unfunded' | 'unavailable' | 'unknown') */
  accountState: AccountBalanceState;
  /** Native XLM balance entry (undefined if account is unfunded or unavailable) */
  native?: NativeAssetBalanceItem;
  /** Array of issued asset balance entries */
  issuedAssets: IssuedAssetBalanceItem[];
  /** Array of unknown/unparseable balance entries (if any) */
  unknownAssets: UnknownAssetBalanceItem[];
  /** Total number of asset entries held by the account */
  totalAssetCount: number;
  /** ISO 8601 timestamp when the balance snapshot was taken */
  updatedAt: string;
}
```

---

## 3. Native vs. Issued Assets

### Native XLM Balance (`NativeAssetBalanceItem`)

Native XLM includes Stellar protocol reserve calculations and DEX liabilities:

```ts
export interface NativeAssetBalanceItem {
  type: 'native';
  assetCode: 'XLM';
  totalBalance: string;        // e.g. "100.0000000"
  availableBalance: string;    // totalBalance - reservedBalance (e.g. "97.5000000")
  reservedBalance: string;     // minBalance + sellingLiabilities (e.g. "2.5000000")
  sellingLiabilities: string;  // DEX sell offer commitments
  buyingLiabilities: string;   // DEX buy offer commitments
  subentryCount: number;       // Number of trustlines, offers, signers, data entries
  state: AssetBalanceState;    // 'available' | 'reserved' | 'unavailable' | 'unknown'
  formattedDisplay: string;    // e.g. "97.50 XLM"
}
```

#### XLM Base Reserve Formula
$$\text{minBalance} = (2 + \text{subentryCount}) \times 0.5\text{ XLM} = 1.0\text{ XLM} + (\text{subentryCount} \times 0.5\text{ XLM})$$

* **Base Reserve**: $1.0\text{ XLM}$ for account maintenance.
* **Per Subentry**: $0.5\text{ XLM}$ per trustline, open offer, additional signer, or data entry.

---

### Issued Asset Balance (`IssuedAssetBalanceItem`)

Issued assets represent credit assets established via trustlines:

```ts
export interface IssuedAssetBalanceItem {
  type: 'issued';
  assetCode: string;           // e.g. "USDC", "EURT"
  issuer: string;              // Issuer public key (G...)
  totalBalance: string;        // e.g. "100.5000000"
  availableBalance: string;    // totalBalance - sellingLiabilities
  reservedBalance: string;     // sellingLiabilities
  sellingLiabilities: string;  // Open sell offer commitments
  buyingLiabilities: string;   // Open buy offer commitments
  limit: string;               // Maximum trustline capacity limit
  isAuthorized: boolean;       // Issuer authorization state (is_authorized !== false)
  state: AssetBalanceState;    // 'available' | 'reserved' | 'unauthorized' | 'unavailable' | 'unknown'
  formattedDisplay: string;    // e.g. "100.50 USDC"
}
```

---

## 4. State & Availability Taxonomy

### Account States (`AccountBalanceState`)

| State | Meaning | UI Action |
| :--- | :--- | :--- |
| `funded` | Account exists on-chain with native or issued balances | Display wallet balances |
| `unfunded` | Account 404 (has never received native XLM funding) | Show "Fund Account" button |
| `unavailable` | Network/Horizon endpoint unreachable or degraded | Show retry / offline warning |
| `unknown` | Account state unverified | Show loading / pending indicator |

### Asset Balance States (`AssetBalanceState`)

| State | Meaning | Spendable? |
| :--- | :--- | :--- |
| `available` | Asset is active and ready for transfers | Yes (`availableBalance`) |
| `reserved` | Balance encumbered by base reserve or DEX liabilities | No |
| `unauthorized` | Trustline exists but issuer revoked or hasn't granted authorization | No |
| `unavailable` | Balance data unavailable from Horizon | No |
| `unknown` | Unparseable asset entry | No |

---

## 5. Usage Code Examples

### Querying Multi-Asset Balances

```ts
import { getMultiAssetBalance } from 'stellar-pocketpay-sdk';

const balance = await getMultiAssetBalance('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H');

if (balance.accountState === 'funded') {
  console.log('Native XLM Available:', balance.native?.availableBalance);
  console.log('Native XLM Reserved:', balance.native?.reservedBalance);

  for (const asset of balance.issuedAssets) {
    console.log(`${asset.assetCode}: ${asset.formattedDisplay} (Authorized: ${asset.isAuthorized})`);
  }
} else if (balance.accountState === 'unfunded') {
  console.log('Wallet is unfunded on Testnet. Fund with friendbot first.');
}
```

### Safe Non-Throwing Query

```ts
import { safeGetMultiAssetBalance } from 'stellar-pocketpay-sdk';

const result = await safeGetMultiAssetBalance(publicKey);

if (result.ok) {
  const balance = result.value;
  console.log(`Total Assets Held: ${balance.totalAssetCount}`);
} else {
  console.error('Balance Query Failed:', result.error.message);
}
```

### Display Formatting & Asset Lookup Helpers

```ts
import {
  formatAssetBalanceDisplay,
  findAssetInMultiBalance,
  calculateNativeReserves,
} from 'stellar-pocketpay-sdk';

// Calculate reserves for 3 subentries (e.g., 2 trustlines + 1 offer)
const reserves = calculateNativeReserves(3);
console.log('Minimum XLM Required:', reserves.minBalance); // "2.5000000"

// Find USDC asset in multi-asset balance object
const usdcAsset = findAssetInMultiBalance(multiBalance, 'USDC', usdcIssuerPublicKey);

if (usdcAsset) {
  console.log(formatAssetBalanceDisplay(usdcAsset, 2)); // "50.00 USDC"
}
```

---

## 6. Summary of Exports

All multi-asset balance types and functions are exported from the package root (`stellar-pocketpay-sdk`):

```ts
import {
  // Types
  AssetBalanceState,
  AccountBalanceState,
  NativeAssetBalanceItem,
  IssuedAssetBalanceItem,
  UnknownAssetBalanceItem,
  AssetBalanceItem,
  MultiAssetBalance,
  MultiAssetBalanceResult,
  // Functions
  calculateNativeReserves,
  parseMultiAssetBalance,
  getMultiAssetBalance,
  safeGetMultiAssetBalance,
  formatAssetBalanceDisplay,
  findAssetInMultiBalance,
} from 'stellar-pocketpay-sdk';
```
