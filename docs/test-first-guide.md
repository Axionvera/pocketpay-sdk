# Test-First Contribution Guide

This guide exists because PRs have been merged with implementation but without
tests that prove it — or with only a happy-path test that never exercises the
failure case a reviewer actually cares about. **Merging a PR does not exempt
it from the test expectations below**; a maintainer or a later audit can still
request follow-up tests for a merged change.

This is not a replacement for the docs already covering testing — it complements
them and does not repeat their content:

| Doc | What it owns |
| :--- | :--- |
| [testing.md](./testing.md) | Unit vs integration lanes, the offline guarantee |
| [module-test-matrix.md](./module-test-matrix.md) | Required-coverage tables (Unit/Fixtures/Error paths/Integration) per module |
| [coverage-baseline.md](./coverage-baseline.md) | Coverage tooling, reports, changed-module targets |
| **This guide** | Copy-paste example tests per module, explicit negative paths, and concrete rules for when a PR may ship without new tests |

Read this **before** writing the implementation, not after.

## Test-first checklist

1. Identify which of the six modules below owns the change.
2. Write the failing test first: the happy path, then at least one negative
   path from the table for that module.
3. Implement until both are green.
4. Run `npm test` locally, then `npm run coverage:baseline` for the changed
   module.
5. Before opening the PR, run `npm run presubmit` (see
   [Pre-submission Verification](./pre-submission-verification.md)).

## Commands

| Command | What it does |
| :--- | :--- |
| `npm test` (= `npm run test:unit`) | Full offline unit suite |
| `npx vitest run tests/wallet.test.ts` | A single test file |
| `npx vitest run -t "rejects a non-string secret"` | A single test by name |
| `npm run test:watch` | Watch mode while writing tests |
| `npm run test:coverage` | Unit suite + V8 coverage report (`coverage/`) |
| `npm run coverage:baseline` | Coverage run + per-module summary |
| `RUN_INTEGRATION=1 npm run test:integration` | Opt-in live-Testnet suite |
| `npm run presubmit` | lint → circular-deps → tests → coverage → build |

Coverage is **informational, not a CI gate** today: `vitest.config.mts` sets
`thresholds: { statements: 0, branches: 0, functions: 0, lines: 0 }`. Don't cite
a hard coverage percentage as a merge blocker — there isn't one yet.

> Note on CI: the only workflow in `.github/workflows/` (`trigger-auto-merge.yml`)
> dispatches to an external automation repo on PR open — it does not itself run
> `npm test` in this repo. `npm run presubmit` / `npm run verify:pr` are the real
> local CI-parity gate; run them, don't assume a visible GitHub check will catch
> what they catch.

---

## Module expectations

### 1. Wallet helpers (`src/wallet/`)

Creates/imports Stellar keypairs, reads balances, funds Testnet accounts.
**Handles secret keys directly** — a test that logs or snapshots a full
`secretKey` is itself a bug.

| | |
| :--- | :--- |
| Test type | Pure sync for key format; mocked `Horizon.Server` (`vi.mock('@stellar/stellar-sdk', ...)`) for balance/funding |
| Happy path | `createWallet()` yields `publicKey` matching `/^G[A-Z0-9]{55}$/` and `secretKey` matching `/^S[A-Z0-9]{55}$/` |
| Negative path | Malformed secret on import → `INVALID_SECRET_KEY`; unfunded account balance lookup → `ACCOUNT_NOT_FOUND` (mocked 404), never a real request |

```ts
import { describe, it, expect, vi } from 'vitest';
import { getBalance, PocketPayError } from '../src';

const mockLoadAccount = vi.fn();
vi.mock('@stellar/stellar-sdk', async (importActual) => {
  const actual = await importActual<typeof import('@stellar/stellar-sdk')>();
  return {
    ...actual,
    Horizon: { ...actual.Horizon, Server: vi.fn().mockImplementation(() => ({
      loadAccount: mockLoadAccount,
    })) },
  };
});

it('maps an unfunded account to ACCOUNT_NOT_FOUND without retrying', async () => {
  const err = new Error('not found') as any;
  err.response = { status: 404 };
  mockLoadAccount.mockRejectedValueOnce(err);

  await expect(getBalance('GA...')).rejects.toMatchObject({
    code: 'ACCOUNT_NOT_FOUND',
  });
  expect(mockLoadAccount).toHaveBeenCalledTimes(1);
});
```

---

### 2. Payment builders (`src/payments/`)

Builds and validates `sendXLM` / `sendAsset` payments before submission.
`validation.ts` is pure — no network, no signing.

| | |
| :--- | :--- |
| Test type | Pure sync for `validateSendXLMParams`; mocked Horizon for submission |
| Happy path | Valid params → `{ ok: true }` from `validateSendXLMParams` |
| Negative path | Amount overflow (> 7 decimal places) → `INVALID_AMOUNT_PRECISION`; source === destination → `SELF_PAYMENT` |

```ts
import { describe, it, expect } from 'vitest';
import { validateSendXLMParams } from '../src/payments/validation';
import * as StellarSDK from '@stellar/stellar-sdk';

it('rejects an amount with more than 7 decimal places', () => {
  const kp = StellarSDK.Keypair.random();
  const other = StellarSDK.Keypair.random();
  const result = validateSendXLMParams({
    sourceSecret: kp.secret(),
    destination: other.publicKey(),
    amount: '1.12345678', // 8 decimals — exceeds Stellar precision
  });

  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'amount', code: 'INVALID_AMOUNT' }),
    );
  }
});
```

---

### 3. Transaction utilities (`src/transactions/`)

Builds, validates, filters, sorts, and polls transactions.
`build-validation.ts` is fully synchronous and network-free.

| | |
| :--- | :--- |
| Test type | Pure sync for the validation pipeline; mocked Horizon for history/polling |
| Happy path | All seven stages pass → `{ valid: true, issues: [] }` |
| Negative path | Missing signer capability → `SIGNER_CANNOT_SIGN` on the `signerCapability` stage (the "firma ausente" case) |

```ts
import { describe, it, expect } from 'vitest';
import { validateTransactionBuild } from '../src/transactions/build-validation';

it('flags an account that cannot sign on the signerCapability stage', () => {
  const readOnlyAccount = { publicKey: 'GA...', signer: undefined } as any;
  const result = validateTransactionBuild(
    { account: readOnlyAccount },
    { stages: ['signerCapability'] },
  );

  expect(result.valid).toBe(false);
  expect(result.issues[0]).toMatchObject({
    stage: 'signerCapability',
    code: 'SIGNER_CANNOT_SIGN',
  });
});
```

---

### 4. Vault helpers (`src/vault/`, `src/soroban/`)

Deposit/withdraw/balance wrappers over a Soroban savings-vault contract.
**Security-sensitive**: signs and submits Soroban invocations — mock
`rpc.Server`, `Contract`, and `Keypair`, never call a live RPC endpoint.

| | |
| :--- | :--- |
| Test type | Mocked `@stellar/stellar-sdk` (`rpc.Server`, `Contract`, `Keypair`) — see the pattern already in `tests/vault.test.ts` |
| Happy path | `depositToVault` with a resolvable `contractId` returns a mapped success result |
| Negative path | No `contractId` resolvable from params/config/env → `VAULT_CONTRACT_NOT_CONFIGURED` (`CapabilityMismatchError`), thrown **before** any RPC call — the malformed-config case |

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { depositToVault } from '../src/soroban/index';

describe('depositToVault — missing contract configuration', () => {
  beforeEach(() => {
    delete process.env.VAULT_CONTRACT_ID;
    delete process.env.STELLAR_CONTRACT_ID;
  });

  it('rejects with VAULT_CONTRACT_NOT_CONFIGURED and never calls the RPC', async () => {
    const rpcSpy = vi.fn();
    await expect(
      depositToVault({ sourceSecret: 'S...', amount: '10' } as any),
    ).rejects.toMatchObject({ code: 'VAULT_CONTRACT_NOT_CONFIGURED' });
    expect(rpcSpy).not.toHaveBeenCalled();
  });
});
```

---

### 5. Config (`src/config/`)

Resolves network, Horizon/Soroban URLs, timeout, and feature flags from
overrides → env vars → defaults. Fully synchronous, no network.

| | |
| :--- | :--- |
| Test type | Pure sync, `beforeEach`/`afterEach` snapshot `process.env` |
| Happy path | `resolveConfig()` with no args resolves testnet defaults |
| Negative path | Malformed config: non-positive `timeout` → thrown `PocketPayError` (`resolveConfig`) or a structured `issues` entry (`validatePocketPayConfig`, non-throwing) |

```ts
import { describe, it, expect } from 'vitest';
import { resolveConfig, validatePocketPayConfig } from '../src';
import { PocketPayError } from '../src/types';

it('resolveConfig throws on a non-positive timeout', () => {
  expect(() => resolveConfig({ timeout: 0 })).toThrow(PocketPayError);
});

it('validatePocketPayConfig reports the same failure without throwing', () => {
  const result = validatePocketPayConfig({ timeout: -5 });
  expect(result.valid).toBe(false);
  expect(result.errors).toContainEqual(
    expect.objectContaining({ field: 'timeout', code: 'INVALID_TIMEOUT' }),
  );
});
```

---

### 6. SDK errors (`src/errors/`)

Classifies raw Horizon/network failures into typed `PocketPayError`s and
redacts secrets before they reach logs. This module has real tests today
(`tests/error-standard.test.ts`) but — unlike the other five — never got a
dedicated example in [module-test-matrix.md](./module-test-matrix.md); this
section fills that gap.

| | |
| :--- | :--- |
| Test type | Pure sync — feed `classifySubmitError` a fake raw error, assert the typed output |
| Happy path | A generic Horizon transaction-result-code failure → `TX_FAILED`, `retryable: false` |
| Negative / boundary path | `tx_bad_seq` is the **one** result code with a different recovery story: it must classify to `TX_BAD_SEQUENCE`, not `TX_FAILED`, and `requiresRebuild()` must return `true` for it and `false` for everything else |

```ts
import { describe, it, expect } from 'vitest';
import { classifySubmitError, requiresRebuild } from '../src/errors';

function horizonResultCodeError(transactionCode: string) {
  const err = new Error('Transaction failed') as any;
  err.response = { status: 400, data: { extras: { result_codes: { transaction: transactionCode, operations: [] } } } };
  return err;
}

it('classifies tx_bad_seq distinctly from other result codes', () => {
  const stale = classifySubmitError(horizonResultCodeError('tx_bad_seq'));
  expect(stale.code).toBe('TX_BAD_SEQUENCE');
  expect(requiresRebuild(stale)).toBe(true);

  const other = classifySubmitError(horizonResultCodeError('tx_insufficient_balance'));
  expect(other.code).toBe('TX_FAILED');
  expect(requiresRebuild(other)).toBe(false);
});
```

---

## When a PR may ship without new tests

A PR may skip adding tests **only** when it matches one of these, stated
explicitly in the PR template's "Docs-only / config-only" field — not "used my
judgment":

- [ ] **Comments/types/JSDoc only** — `git diff` shows no change to executable
      logic (no changed line outside a comment, type annotation, or `.d.ts`).
- [ ] **Docs-only** — the diff touches only `docs/`, `README.md`, or `examples/`.
- [ ] **Pure rename/move with no behavior change** — and the PR names which
      existing test file(s) already exercise the moved code and still pass.
- [ ] **Refactor that provably preserves behavior** — existing tests already
      cover every changed branch and stay green unmodified; the PR lists which
      test file(s) prove this.
- [ ] **Config/tooling change with no runtime branch** — e.g. a `package.json`
      script rename, a `tsconfig.json` tweak — and `npm run build` still passes.

**Not acceptable, ever:**
- "Tested manually" with no automated test.
- "Will add tests in a follow-up."
- "It's a small change."
- Any change to `src/wallet/`, `src/payments/`, `src/transactions/`,
  `src/vault/`, `src/soroban/`, or `src/errors/` that changes behavior.

If none of the checked boxes apply, the PR needs tests before it's ready for
review — see [Contribution Quality Gate](./contribution-quality-gate.md) for
what a maintainer checks before approving.

## Related docs

- [testing.md](./testing.md) — unit vs integration lanes, the offline guarantee
- [module-test-matrix.md](./module-test-matrix.md) — full per-module requirement tables
- [coverage-baseline.md](./coverage-baseline.md) — coverage tooling and reports
- [error-handling.md](./error-handling.md) — `PocketPayError` code reference
- [contribution-quality-gate.md](./contribution-quality-gate.md) — maintainer pass/hold checklist
