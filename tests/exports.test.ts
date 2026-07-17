/**
 * Regression tests for the package root export surface.
 *
 * These tests guard the public SDK API used by the mobile app and external
 * consumers. If a core helper is removed from the root entrypoint, the suite
 * should fail and signal the regression immediately.
 */

import { describe, it, expect } from 'vitest';
import * as PocketPay from '../src';
import type {
  AccountBalance,
  BalanceResult,
  FailureResult,
  FundResult,
  PaymentRecord,
  PaymentResult,
  PocketPayResult,
  SDKConfig,
  SendXLMParams,
  SuccessResult,
  TransactionRecord,
  VaultBalanceParams,
  VaultDepositParams,
  VaultResult,
  VaultWithdrawParams,
  WalletKeypair,
} from '../src';

const EXPECTED_PUBLIC_EXPORTS = [
  // errors
  'PocketPayError',
  // wallet
  'createWallet',
  'importWallet',
  'getPublicKey',
  'getBalance',
  'fundTestnetAccount',
  // payments
  'sendXLM',
  // transactions
  'getTransactions',
  'getPayments',
  // soroban vault
  'depositToVault',
  'withdrawFromVault',
  'getVaultBalance',
  // config
  'resolveConfig',
  'getHorizonServer',
  'getNetworkPassphrase',
  'getFriendbotUrl',
  // utils
  'validatePublicKey',
  'validateSecretKey',
  'validateAmount',
  'stroopsToXLM',
  'xlmToStroops',
  'truncateAddress',
  // wallet (result-aware + safe)
  'getBalanceOrUnfunded',
  // config validators
  'validateNetwork',
  'validateHorizonUrl',
  'validateSorobanRpcUrl',
  'validateTimeout',
  'validateContractId',
  // memo validation
  'validateMemo',
  // result helpers
  'toSuccessResult',
  'toFailureResult',
  'toResult',
  // safe (non-throwing) wrappers
  'safeGetBalance',
  'safeFundTestnetAccount',
  'safeSendXLM',
  'safeGetTransactions',
  'safeGetPayments',
];

// Helpers that exist internally (e.g. in src/utils) but should never be
// exposed on the package root, since they're implementation details.
const INTERNAL_ONLY = ['wrapError', 'sleep'];

describe('Package root exports', () => {
  it('exports wallet helpers from the package root', () => {
    for (const name of REQUIRED_PUBLIC_EXPORTS.wallet) {
      expectExported(name);
    }
  });

  it('exports payment helpers from the package root', () => {
    for (const name of REQUIRED_PUBLIC_EXPORTS.payments) {
      expectExported(name);
    }
  });

  it('exports transaction helpers from the package root', () => {
    for (const name of REQUIRED_PUBLIC_EXPORTS.transactions) {
      expectExported(name);
    }
  });

  it('exports Soroban helper exports from the package root', () => {
    for (const name of REQUIRED_PUBLIC_EXPORTS.soroban) {
      expectExported(name);
    }
  });

  it('exports config and validation utilities from the package root', () => {
    for (const name of REQUIRED_PUBLIC_EXPORTS.config) {
      expectExported(name);
    }

    for (const name of REQUIRED_PUBLIC_EXPORTS.utilities) {
      expectExported(name);
    }
  });

  it('exports errors and public types from the package root', () => {
    for (const name of REQUIRED_PUBLIC_EXPORTS.errors) {
      expectExported(name);
    }

    const config: SDKConfig = {
      network: 'testnet',
      horizonUrl: 'https://horizon.testnet.stellar.org',
      sorobanRpcUrl: 'https://rpc.testnet.stellar.org',
    };

    const wallet: WalletKeypair = {
      publicKey: 'GABC123',
      secretKey: 'SABC123',
    };

    const balance: AccountBalance = {
      publicKey: wallet.publicKey,
      balances: [],
      nativeBalance: '0',
    };

    const payment: PaymentResult = {
      success: true,
      hash: 'tx-hash',
      ledger: 1,
      fee: '100',
      sourceAccount: wallet.publicKey,
      destinationAccount: 'GDEST123',
      amount: '1',
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    const payload: PocketPayResult<AccountBalance> = {
      ok: true,
      value: balance,
    };

    const successResult: SuccessResult<PaymentResult> = {
      ok: true,
      value: payment,
    };

    const failureResult: FailureResult = {
      ok: false,
      error: new PocketPay.PocketPayError('boom', 'TEST_ERROR'),
    };

    const transaction: TransactionRecord = {
      hash: 'tx-hash',
      ledger: 1,
      createdAt: '2024-01-01T00:00:00.000Z',
      sourceAccount: wallet.publicKey,
      fee: '100',
      operationCount: 1,
      successful: true,
      memo: undefined,
      memoType: '',
    };

    const paymentRecord: PaymentRecord = {
      id: 'op-1',
      transactionHash: 'tx-hash',
      type: 'payment',
      createdAt: '2024-01-01T00:00:00.000Z',
      from: wallet.publicKey,
      to: 'GDEST123',
      amount: '1',
      asset: 'XLM',
      assetIssuer: '',
    };

    const depositParams: VaultDepositParams = {
      sourceSecret: wallet.secretKey,
      amount: '1',
      contractId: 'C123',
    };

    const withdrawParams: VaultWithdrawParams = {
      sourceSecret: wallet.secretKey,
      amount: '1',
      contractId: 'C123',
    };

    const vaultParams: VaultBalanceParams = {
      publicKey: wallet.publicKey,
      contractId: 'C123',
    };

    const vaultResult: VaultResult = {
      success: true,
      hash: 'vault-hash',
    };

    const fundResult: FundResult = {
      success: true,
      publicKey: wallet.publicKey,
      hash: 'fund-hash',
    };

    const sendParams: SendXLMParams = {
      sourceSecret: wallet.secretKey,
      destination: 'GDEST123',
      amount: '1',
    };

    const balanceResult: BalanceResult = {
      status: 'funded',
      publicKey: wallet.publicKey,
      balance,
    };

    expect(config.network).toBe('testnet');
    expect(payment.hash).toBe('tx-hash');
    expect(payload.ok).toBe(true);
    expect(successResult.value.hash).toBe('tx-hash');
    expect(failureResult.ok).toBe(false);
    expect(transaction.hash).toBe('tx-hash');
    expect(paymentRecord.type).toBe('payment');
    expect(depositParams.contractId).toBe('C123');
    expect(withdrawParams.amount).toBe('1');
    expect(vaultParams.publicKey).toBe(wallet.publicKey);
    expect(vaultResult.success).toBe(true);
    expect(fundResult.publicKey).toBe(wallet.publicKey);
    expect(sendParams.destination).toBe('GDEST123');
    expect(balanceResult.status).toBe('funded');
  });

  it('does not expose internal-only helpers from the package root', () => {
    for (const name of INTERNAL_ONLY) {
      expect(
        (PocketPay as Record<string, unknown>)[name],
        `"${name}" is an internal helper and should not be exported from the package root`
      ).toBeUndefined();
    }
  });
});
