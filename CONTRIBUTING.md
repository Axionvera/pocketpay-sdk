# Contributing to PocketPay SDK

Thank you for your interest in contributing! Whether you're fixing a bug, improving docs, or adding a new feature, your help is welcome and appreciated. This guide will get you set up and show you what we expect from contributions.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Available Commands](#available-commands)
- [Project Structure](#project-structure)
- [Code Style](#code-style)
- [Writing Tests](#writing-tests)
- [Branching and Commits](#branching-and-commits)
- [Pull Request Checklist](#pull-request-checklist)
- [Reporting Issues](#reporting-issues)

---

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/pocketpay-sdk.git
   cd pocketpay-sdk
   ```
3. **Install dependencies** (Node.js ≥ 18 required):
   ```bash
   npm install
   ```
4. **Copy the environment template** and fill in any values you need for local testing:
   ```bash
   cp .env.example .env
   ```

---

## Development Setup

The SDK targets the Stellar Testnet by default. Most tests are unit-level and do not require a live network connection, but if you're working on Horizon or Soroban integration you can set the relevant URLs in your `.env` file.

| Variable | Description |
|---|---|
| `STELLAR_NETWORK` | `testnet` or `mainnet` (default: `testnet`) |
| `STELLAR_HORIZON_URL` | Override the default Horizon endpoint |
| `STELLAR_SOROBAN_RPC_URL` | Override the default Soroban RPC endpoint |
| `VAULT_CONTRACT_ID` | Deployed vault contract ID for Soroban tests |

> ⚠️ Never commit real secret keys. The `.env` file is gitignored for your protection.

---

## Available Commands

```bash
# Build the SDK (outputs to dist/)
npm run build

# Run all tests once
npm test

# Run tests in watch mode during development
npm run test:watch

# Type-check without emitting files
npm run lint

# Start the dev watcher
npm run dev
```

---

## Project Structure

```
src/
  config/       SDK configuration and network defaults
  payments/     XLM payment logic
  soroban/      Soroban vault contract interactions
  transactions/ Transaction building and history
  types/        Shared TypeScript types
  utils/        Helper utilities
  wallet/       Wallet creation and management
  index.ts      Public API surface

tests/
  fixtures/     Shared test data (accounts, transactions, payments)
  *.test.ts     Test files mirroring the src/ modules

docs/           Extended documentation (error handling, logging, security)
examples/       Runnable usage examples
```

---

## Code Style

- The project is written in **TypeScript** with strict mode enabled.
- Run `npm run lint` before pushing — this type-checks the full source tree.
- Match the naming and file conventions already present in `src/`.
- Keep functions focused and add JSDoc comments for any exported API.
- Do not introduce new runtime dependencies without discussion in the issue first.

---

## Writing Tests

Tests live in `tests/` and use [Vitest](https://vitest.dev/). We use fixtures in `tests/fixtures/` to keep test data consistent.

- **Write tests for any behaviour change or new feature.** Bug fixes should include a regression test.
- Keep tests isolated — avoid relying on live network calls. Mock external requests where needed.
- Use the existing fixture helpers (`tests/fixtures/accounts.ts`, `transactions.ts`, etc.) rather than hardcoding data.

Run the suite before opening a PR:

```bash
npm test
```

All tests must pass. ✅

---

## Branching and Commits

Use a descriptive branch name that references the issue:

```
feat/contributing-guide-6
fix/soroban-error-handling-42
docs/update-readme-15
```

Commit messages should be clear and in the imperative mood:

```
Add CONTRIBUTING.md for SDK contributors
Fix wallet keypair type mismatch on mainnet
```

Keep commits focused — one logical change per commit makes reviews easier.

---

## Pull Request Checklist

Before opening a PR, run through this list:

- [ ] `npm run lint` passes with no errors
- [ ] `npm test` passes with no failures
- [ ] New behaviour is covered by tests
- [ ] Relevant docs (`docs/`, `README.md`) are updated if needed
- [ ] The PR description explains **what** changed and **why**
- [ ] The PR references the related issue (e.g. `Closes #6`)
- [ ] No `.env` or secret values are committed

---

## Reporting Issues

Found a bug or have a feature idea? [Open an issue](https://github.com/Stellar-PocketPay/stellar-pocketpay-sdk/issues) and fill in as much detail as you can:

- What you expected to happen
- What actually happened
- Steps to reproduce
- SDK version and Node.js version

---

We appreciate every contribution, no matter the size. Thanks for helping make PocketPay SDK better! 🚀
