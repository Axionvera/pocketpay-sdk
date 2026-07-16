# PocketPay SDK

Stellar-based payment SDK for the PocketPay ecosystem.

## Installation

npm install @axionvera/pocketpay-sdk

## Documentation

- [Getting Started](./docs/getting-started.md) - Step-by-step guide to install, create wallets, fund accounts, check balances, and send payments
- [Network Error Handling](./docs/network-errors.md) - Retry guidance for Horizon, Friendbot, and Soroban RPC failures
- [Error Handling](./docs/error-handling.md) - SDK error handling overview

## Quick Start

import { PocketPay } from '@axionvera/pocketpay-sdk';
const sdk = new PocketPay({ network: 'testnet' });
