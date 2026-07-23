/**
 * Stellar PocketPay SDK — Soroban Vault Module
 *
 * Interact with the PocketPay Savings Vault smart contract on Soroban.
 * Provides deposit, withdraw, and balance-query wrappers.
 *
 * NOTE: This module requires a deployed Soroban vault contract.
 * The contract ID should be provided via params or VAULT_CONTRACT_ID env var.
 */

import * as StellarSDK from '@stellar/stellar-sdk';
import { resolveConfig, getNetworkPassphrase } from '../config';
import {
  VaultDepositParams, VaultWithdrawParams,
  VaultBalanceParams, VaultResult, VaultMappedResult,
  PocketPayError, SDKConfig,
} from '../types';
import { validateSecretKey, validatePublicKey, validateAmount, wrapError } from '../utils';
import { withTimeout } from '../network';
import {
  mapSorobanInvocationResult,
  mapVaultInvocationResult,
  mapSorobanContractError,
} from './mapper';

export {
  mapSorobanInvocationResult,
  mapVaultInvocationResult,
  mapSorobanContractError,
};

/**
 * Resolves the vault contract ID from params or environment.
 */
function resolveContractId(contractId?: string): string {
  const id = contractId || process.env.VAULT_CONTRACT_ID;
  if (!id) {
    throw new PocketPayError(
      'Vault contract ID is required. Pass it as a param or set VAULT_CONTRACT_ID env var.',
      'MISSING_CONTRACT_ID',
      {
        validation: {
          field: 'contractId',
          reason: 'missing'
        }
      }
    );
  }
  return id;
}

/**
 * Creates a SorobanRpc.Server instance for the configured network.
 */
function getSorobanServer(config?: Partial<SDKConfig>): StellarSDK.rpc.Server {
  const resolved = resolveConfig(config);
  return new StellarSDK.rpc.Server(resolved.sorobanRpcUrl);
}

/**
 * Deposits XLM into the savings vault contract.
 *
 * @param params - Deposit parameters (sourceSecret, amount, contractId)
 * @param config - Optional SDK config overrides
 * @returns Vault operation result
 */
export async function depositToVault(
  params: VaultDepositParams,
  config?: Partial<SDKConfig>
): Promise<VaultMappedResult> {
  const { sourceSecret, amount } = params;
  validateSecretKey(sourceSecret);
  validateAmount(amount);

  const contractId = resolveContractId(params.contractId);
  const keypair = StellarSDK.Keypair.fromSecret(sourceSecret);
  const publicKey = keypair.publicKey();

  try {
    const cfg = resolveConfig(config);
    const sorobanServer = getSorobanServer(config);
    const networkPassphrase = getNetworkPassphrase(cfg.network);
    const account = await withTimeout(
      'Soroban account lookup',
      cfg.timeout,
      sorobanServer.getAccount(publicKey),
    );

    // Convert amount to i128 (stroops-like representation)
    const amountInStroops = Math.round(parseFloat(amount) * 10_000_000);

    const contract = new StellarSDK.Contract(contractId);
    const tx = new StellarSDK.TransactionBuilder(account, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'deposit',
          StellarSDK.nativeToScVal(publicKey, { type: 'address' }),
          StellarSDK.nativeToScVal(amountInStroops, { type: 'i128' })
        )
      )
      .setTimeout(30)
      .build();

    // Simulate, then prepare and submit
    const simulated = await withTimeout(
      'Soroban transaction simulation',
      cfg.timeout,
      sorobanServer.simulateTransaction(tx),
    );

    if (StellarSDK.rpc.Api.isSimulationError(simulated)) {
      return mapVaultInvocationResult('deposit', simulated, { amount, contractId });
    }

    const prepared = StellarSDK.rpc.assembleTransaction(tx, simulated).build();
    prepared.sign(keypair);

    const sendResult = await withTimeout(
      'Soroban transaction submission',
      cfg.timeout,
      sorobanServer.sendTransaction(prepared),
    );

    if (sendResult.status === 'ERROR') {
      return mapVaultInvocationResult('deposit', sendResult, { amount, contractId });
    }

    // Poll for result
    let getResult = await withTimeout(
      'Soroban transaction status request',
      cfg.timeout,
      sorobanServer.getTransaction(sendResult.hash),
    );
    while (getResult.status === 'NOT_FOUND') {
      await new Promise((r) => setTimeout(r, 1000));
      getResult = await withTimeout(
        'Soroban transaction status request',
        cfg.timeout,
        sorobanServer.getTransaction(sendResult.hash),
      );
    }

    return mapVaultInvocationResult('deposit', getResult, { amount, contractId, hash: sendResult.hash });
  } catch (error) {
    if (error instanceof PocketPayError) throw error;
    throw wrapError(error, 'Vault deposit failed', 'VAULT_DEPOSIT_ERROR');
  }
}

/**
 * Withdraws XLM from the savings vault contract.
 *
 * @param params - Withdrawal parameters (sourceSecret, amount, contractId)
 * @param config - Optional SDK config overrides
 * @returns Vault operation result
 */
export async function withdrawFromVault(
  params: VaultWithdrawParams,
  config?: Partial<SDKConfig>
): Promise<VaultMappedResult> {
  const { sourceSecret, amount } = params;
  validateSecretKey(sourceSecret);
  validateAmount(amount);

  const contractId = resolveContractId(params.contractId);
  const keypair = StellarSDK.Keypair.fromSecret(sourceSecret);
  const publicKey = keypair.publicKey();

  try {
    const cfg = resolveConfig(config);
    const sorobanServer = getSorobanServer(config);
    const networkPassphrase = getNetworkPassphrase(cfg.network);
    const account = await withTimeout(
      'Soroban account lookup',
      cfg.timeout,
      sorobanServer.getAccount(publicKey),
    );

    const amountInStroops = Math.round(parseFloat(amount) * 10_000_000);

    const contract = new StellarSDK.Contract(contractId);
    const tx = new StellarSDK.TransactionBuilder(account, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'withdraw',
          StellarSDK.nativeToScVal(publicKey, { type: 'address' }),
          StellarSDK.nativeToScVal(amountInStroops, { type: 'i128' })
        )
      )
      .setTimeout(30)
      .build();

    const simulated = await withTimeout(
      'Soroban transaction simulation',
      cfg.timeout,
      sorobanServer.simulateTransaction(tx),
    );

    if (StellarSDK.rpc.Api.isSimulationError(simulated)) {
      return mapVaultInvocationResult('withdraw', simulated, { amount, contractId });
    }

    const prepared = StellarSDK.rpc.assembleTransaction(tx, simulated).build();
    prepared.sign(keypair);

    const sendResult = await withTimeout(
      'Soroban transaction submission',
      cfg.timeout,
      sorobanServer.sendTransaction(prepared),
    );

    if (sendResult.status === 'ERROR') {
      return mapVaultInvocationResult('withdraw', sendResult, { amount, contractId });
    }

    let getResult = await withTimeout(
      'Soroban transaction status request',
      cfg.timeout,
      sorobanServer.getTransaction(sendResult.hash),
    );
    while (getResult.status === 'NOT_FOUND') {
      await new Promise((r) => setTimeout(r, 1000));
      getResult = await withTimeout(
        'Soroban transaction status request',
        cfg.timeout,
        sorobanServer.getTransaction(sendResult.hash),
      );
    }

    return mapVaultInvocationResult('withdraw', getResult, { amount, contractId, hash: sendResult.hash });
  } catch (error) {
    if (error instanceof PocketPayError) throw error;
    throw wrapError(error, 'Vault withdrawal failed', 'VAULT_WITHDRAW_ERROR');
  }
}

/**
 * Queries the vault balance for a given user.
 *
 * @param params - Balance query parameters (publicKey, contractId)
 * @param config - Optional SDK config overrides
 * @returns Vault result with balance
 */
export async function getVaultBalance(
  params: VaultBalanceParams,
  config?: Partial<SDKConfig>
): Promise<VaultMappedResult> {
  validatePublicKey(params.publicKey);
  const contractId = resolveContractId(params.contractId);

  try {
    const cfg = resolveConfig(config);
    const sorobanServer = getSorobanServer(config);
    const networkPassphrase = getNetworkPassphrase(cfg.network);
    const account = await withTimeout(
      'Soroban account lookup',
      cfg.timeout,
      sorobanServer.getAccount(params.publicKey),
    );

    const contract = new StellarSDK.Contract(contractId);
    const tx = new StellarSDK.TransactionBuilder(account, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(
        contract.call(
          'get_balance',
          StellarSDK.nativeToScVal(params.publicKey, { type: 'address' })
        )
      )
      .setTimeout(30)
      .build();

    const simulated = await withTimeout(
      'Soroban transaction simulation',
      cfg.timeout,
      sorobanServer.simulateTransaction(tx),
    );

    return mapVaultInvocationResult('get_balance', simulated, { contractId });
  } catch (error) {
    if (error instanceof PocketPayError) throw error;
    throw wrapError(error, 'Failed to query vault balance', 'VAULT_BALANCE_ERROR');
  }
}

