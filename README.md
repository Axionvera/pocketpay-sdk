# PocketPay SDK

Stellar-based payment SDK for the PocketPay ecosystem.

## Installation

npm install @axionvera/pocketpay-sdk

## Documentation

- [Network Error Handling](./docs/network-errors.md) - Retry guidance for Horizon, Friendbot, and Soroban RPC failures
- [Error Handling](./docs/error-handling.md) - Guide to handling validation, network, payment, and contract errors consistently
- [Transaction Polling](./docs/polling.md) - How to poll for transaction confirmation status

## Quick Start

import { PocketPay } from '@axionvera/pocketpay-sdk';
const sdk = new PocketPay({ network: 'testnet' });
