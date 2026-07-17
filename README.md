# PocketPay SDK

Stellar-based payment SDK for the PocketPay ecosystem.

## Installation

npm install @axionvera/pocketpay-sdk

## Documentation

- [API Reference: Pagination](./docs/api-reference.md) - Cursor-based pagination for `getTransactions` and `getPayments`
- [Network Error Handling](./docs/network-errors.md) - Retry guidance for Horizon, Friendbot, and Soroban RPC failures
- [Error Handling](./docs/error-handling.md) - SDK error handling overview
- [Logging Guidance](./docs/logging.md) - Safe logging practices for SDK applications
- [Security Best Practices](./docs/security.md) - Key management and transaction safety

## Quick Start

import { PocketPay } from '@axionvera/pocketpay-sdk';
const sdk = new PocketPay({ network: 'testnet' });