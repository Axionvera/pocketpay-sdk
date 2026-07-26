# Asset Formatting Rules and Display Guidelines

This document provides official guidance for SDK consumers building mobile and web applications within the PocketPay ecosystem. It defines standard rules for formatting asset codes, issuers, balance amounts, decimals, unknown asset entries, and visual warnings to ensure a consistent, secure, and user-friendly experience across all client applications.

---

## 1. Overview & Objectives

In the Stellar network ecosystem, assets can be native (XLM) or issued credit assets (tokens issued by accounts, e.g. USDC, EURT). Because anyone on Stellar can issue an asset with any code (such as creating a fake asset named "USDC" from a malicious issuer), mobile and web applications must present asset information strictly and unambiguously.

### Key UX & Security Objectives
1. **Consistency**: Uniform representation of asset codes, issuer public keys, and balance numbers across web and mobile platforms.
2. **Anti-Phishing & Spoof Prevention**: Displaying issuer identities clearly so users can distinguish legitimate tokens (e.g., Circle's USDC) from fake/impersonated assets.
3. **Financial Precision**: Clearly distinguishing spendable available balance from encumbered/reserved balances without rounding errors that mislead users.
4. **Safety & Resilience**: Handling unknown asset types or unverified trustlines gracefully without crashing UI layout components.

---

## 2. Asset Classification & Display Rules

Stellar assets fall into distinct categories in the PocketPay SDK model (`MultiAssetBalance`):

### A. Native Asset (`XLM`)
- **Asset Code**: Always uppercase `XLM`.
- **Issuer**: None (Native XLM does not have an issuer address).
- **Display Name**: Lumens / Stellar Lumens (`XLM`).
- **Display Rule**:
  - Show code `XLM` clearly.
  - Never display an issuer field or placeholder address for XLM.
  - Display available spendable balance as primary, with optional reserve breakdown.

### B. Issued Credit Assets (`credit_alphanum4` / `credit_alphanum12`)
- **Asset Code**: Alphanumeric string, 1 to 12 characters (e.g., `USDC`, `EURT`, `PYUSD`, `BTC`).
- **Issuer**: Mandatory 56-character Stellar public key starting with `G` (e.g., `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335WF2CCAJ3ZTH7A6AYUF2AEM2C`).
- **Display Rule**:
  - Always pair the Asset Code with its Issuer identification.
  - Display full or truncated issuer address alongside the code when listing custom or unverified assets.
  - Show authorization status (`Authorized` vs `Unauthorized` / `Revoked`) clearly.

### C. Unknown / Unsupported Assets
- **Asset Code**: Raw code or `UNKNOWN`.
- **Issuer**: Public key if available (`G...`).
- **Display Rule**:
  - Mark entry with explicit `(Unknown)` or `(Unsupported)` label.
  - Disable transfer/payment buttons for unknown asset structures.

---

## 3. Issuer Address Display Guidance

Because asset codes are not globally unique on Stellar, the Issuer Public Key (`G...`) is the primary key for asset identity.

### Truncation & Formatting Rules
When space is limited (e.g., mobile UI lists, table rows), issuers should be truncated using an abbreviated mask while preserving full copyability:

- **Standard Truncation Pattern**: Show first 4 characters and last 4 characters separated by an ellipsis (`…` or `...`).
  - *Example*: `GA5Z...EM2C`
- **Full Address Access**:
  - Provide a one-tap "Copy Issuer Address" action or detail tooltip/modal showing the complete 56-character `G...` key.
  - Include an external block explorer link (e.g. StellarExpert) where applicable.
- **Verification Badges**:
  - Display a verified checkmark or trust indicator when the issuer matches known domain anchors (e.g. Stellar TOML domain validation for `circle.com`).
  - Show an unverified warning icon when the issuer is unknown or unanchored.

> [!WARNING]
> **Never suppress or hide the issuer address for custom assets.** Concealing the issuer prevents users from discovering spoofed tokens.

---

## 4. Balance & Decimal Formatting Rules

Stellar represents asset amounts with 7 decimal places of precision (in 100-stroop units). Formatting balances for display requires balancing readability with accuracy.

### Precision & Decimal Rules
1. **Default Display Decimals**:
   - For standard UI balances, format amounts to **2 decimal places** by default (e.g., `100.50 USDC`, `97.50 XLM`).
   - For detailed views or crypto-denominated transactions, allow displaying up to **7 decimal places** (e.g., `0.0000123 XLM`).
2. **Truncation vs. Rounding**:
   - Always **truncate (floor)** rather than round up when displaying spendable balance to prevent users from trying to spend fractions of a unit they do not possess.
   - *Example*: `9.9999999` available balance formatted to 2 decimals must display as `9.99`, not `10.00`.
3. **Separators & Locales**:
   - Use locale-aware thousands separators for values $\ge 1,000$ (e.g., `1,250.50 XLM` in `en-US`).
4. **Zero Balances**:
   - Display `0.00` for active zero-balance trustlines rather than hiding them or displaying `NaN` / `null`.

### Spendable vs. Reserved Balances
Always present balances in terms of user usability:

| Balance Field | UI Label | Explanation |
| :--- | :--- | :--- |
| `availableBalance` | **Available** | Primary spendable amount after subtracting reserves & DEX liabilities. |
| `reservedBalance` | **Reserved** | Encumbered XLM base reserve ($1.0 + 0.5 \times \text{subentries}$) or DEX sell liabilities. |
| `totalBalance` | **Total** | Raw total balance held on-chain (`available` + `reserved`). |

---

## 5. Unknown Assets & Warning Indicators

Applications must handle unexpected or untrusted state gracefully:

### Unauthorized Trustline Warning
When `isAuthorized === false` (or `state === 'unauthorized'`), the issuer has revoked or not yet granted authorization for the account to hold/transfer the asset.
- **UI Label**: `(Unauthorized)` tag in red/orange tag badge.
- **Action**: Disable payment generation and display an informative notice: *"Issuer authorization required to transfer this asset."*

### Unknown Asset Warning
When an asset cannot be parsed into standard native or credit models:
- **UI Label**: `(Unknown Asset)` tag.
- **Action**: Render raw values safely without crashing; restrict high-risk operations.

---

## 6. SDK Helper Functions

The PocketPay SDK provides helper utilities in `@axionvera/pocketpay-sdk` to enforce these formatting rules automatically:

### `formatAssetBalanceDisplay(item, decimals)`
Formats any `AssetBalanceItem` into a standardized display string:

```typescript
import { formatAssetBalanceDisplay, getMultiAssetBalance } from '@axionvera/pocketpay-sdk';

const balance = await getMultiAssetBalance('GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H');

if (balance.native) {
  // Output: "97.50 XLM"
  console.log(formatAssetBalanceDisplay(balance.native, 2));
}

for (const asset of balance.issuedAssets) {
  // Output: "100.50 USDC" or "50.00 EURT (Unauthorized)"
  console.log(formatAssetBalanceDisplay(asset, 2));
}
```

### `findAssetInMultiBalance(multiBalance, assetCode, issuer)`
Safely retrieves an asset entry from a `MultiAssetBalance` snapshot:

```typescript
import { findAssetInMultiBalance } from '@axionvera/pocketpay-sdk';

const usdc = findAssetInMultiBalance(multiBalance, 'USDC', 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335WF2CCAJ3ZTH7A6AYUF2AEM2C');
if (usdc) {
  console.log('Available USDC:', usdc.availableBalance);
}
```

---

## 7. Summary Checklist for Consumers

- [ ] Native XLM displays as `XLM` with no issuer field.
- [ ] Issued assets display code and truncated issuer key (`G...`).
- [ ] Balances show `availableBalance` as primary spendable amount.
- [ ] Decimals use fixed precision without rounding up spendable limits.
- [ ] Unauthorized assets show an explicit `(Unauthorized)` warning state.
- [ ] Unknown asset types render gracefully without crashing UI components.
