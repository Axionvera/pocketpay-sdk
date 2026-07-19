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
  VaultBalanceParams, VaultResult,
  PocketPayError, SDKConfig,
} from '../types';
import { validateSecretKey, validatePublicKey, validateAmount, wrapError } from '../utils';
import { withTimeout } from '../network';

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
): Promise<VaultResult> {
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
      return {
        success: false,
        error: `Simulation failed: ${(simulated as any).error}`,
      };
    }

    const prepared = StellarSDK.rpc.assembleTransaction(tx, simulated).build();
    prepared.sign(keypair);

    const sendResult = await withTimeout(
      'Soroban transaction submission',
      cfg.timeout,
      sorobanServer.sendTransaction(prepared),
    );

    if (sendResult.status === 'ERROR') {
      return { success: false, error: `Send error: ${sendResult.errorResult}` };
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

    if (getResult.status === 'SUCCESS') {
      return { success: true, hash: sendResult.hash };
    }

    return { success: false, error: `Transaction status: ${getResult.status}` };
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
): Promise<VaultResult> {
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
      return {
        success: false,
        error: `Simulation failed: ${(simulated as any).error}`,
      };
    }

    const prepared = StellarSDK.rpc.assembleTransaction(tx, simulated).build();
    prepared.sign(keypair);

    const sendResult = await withTimeout(
      'Soroban transaction submission',
      cfg.timeout,
      sorobanServer.sendTransaction(prepared),
    );

    if (sendResult.status === 'ERROR') {
      return { success: false, error: `Send error: ${sendResult.errorResult}` };
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

    if (getResult.status === 'SUCCESS') {
      return { success: true, hash: sendResult.hash };
    }

    return { success: false, error: `Transaction status: ${getResult.status}` };
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
): Promise<VaultResult> {
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

    if (StellarSDK.rpc.Api.isSimulationError(simulated)) {
      return {
        success: false,
        error: `Simulation failed: ${(simulated as any).error}`,
      };
    }

    // Extract return value
    const successSim = simulated as StellarSDK.rpc.Api.SimulateTransactionSuccessResponse;
    if (successSim.result) {
      const retVal = successSim.result.retval;
      const balance = StellarSDK.scValToNative(retVal);
      const balanceXLM = (Number(balance) / 10_000_000).toFixed(7);
      return { success: true, balance: balanceXLM };
    }

    return { success: true, balance: '0' };
  } catch (error) {
    if (error instanceof PocketPayError) throw error;
    throw wrapError(error, 'Failed to query vault balance', 'VAULT_BALANCE_ERROR');
  }
}
