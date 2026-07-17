# PocketPay SDK

Stellar-based payment SDK for the PocketPay ecosystem.

## Installation

npm install @axionvera/pocketpay-sdk

## Documentation

- [Network Error Handling](./docs/network-errors.md) - Retry guidance for Horizon, Friendbot, and Soroban RPC failures
- [Error Handling](./docs/error-handling.md) - SDK error handling overview
- [Logging Guidance](./docs/logging.md) - Safe logging practices for SDK applications
- [Security Best Practices](./docs/security.md) - Key management and transaction safety

## Package Root Imports

Everything the SDK exposes is available from the package root — this is the
only supported entry point:

```typescript
import { createWallet, sendXLM, getBalance } from 'stellar-pocketpay-sdk';
```

Deep imports (e.g. `stellar-pocketpay-sdk/wallet`) are **not supported** and
are not guaranteed to work across versions. Internal helpers that aren't
listed in the Features table above are implementation details and are not
part of the public API.

---

## Quick Start

import { PocketPay } from '@axionvera/pocketpay-sdk';
const sdk = new PocketPay({ network: 'testnet' });
