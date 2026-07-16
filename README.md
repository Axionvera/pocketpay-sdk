# PocketPay SDK

Stellar-based payment SDK for the PocketPay ecosystem.

## Installation

npm install @axionvera/pocketpay-sdk

## Documentation

- [Network Error Handling](./docs/network-errors.md) - Retry guidance for Horizon, Friendbot, and Soroban RPC failures
- [Error Handling](./docs/error-handling.md) - SDK error handling overview
- [Logging Guidance](./docs/logging.md) - Safe logging practices for SDK applications
- [Security Best Practices](./docs/security.md) - Key management and transaction safety

## Examples

- [Fetch Transaction History](./examples/get-transactions.ts) - Query recent transactions and payments for an account

## Quick Start

import { PocketPay } from '@axionvera/pocketpay-sdk';
const sdk = new PocketPay({ network: 'testnet' });