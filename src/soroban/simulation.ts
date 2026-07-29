import * as StellarSDK from '@stellar/stellar-sdk';
import { resolveConfig } from '../config';
import { getNetworkPassphrase } from '../config';
import {
  ContractSimulationParams,
  ContractSimulationResult,
  SDKConfig,
  PocketPayError,
} from '../types';
import { validatePublicKey, wrapError } from '../utils';
import { withTimeout } from '../network';
import { mapSimulationResult, mapSorobanContractError } from './mapper';

/**
 * Simulates a Soroban contract call without signing or submitting it.
 *
 * Simulation is a critical safety step before executing state-changing transactions.
 * It allows the SDK to:
 * 1. Verify the contract call will succeed (preventing wasted fees on failures).
 * 2. Calculate the exact resource constraints (CPU, RAM, fee) required.
 * 3. Understand the authorization requirements before prompting the user to sign.
 *
 * Outcomes are classified via {@link mapSimulationResult} into
 * `success` | `warning` | `failed` | `unsupported` | `unknown`.
 *
 * @param params - The simulation parameters (contractId, operation, args, sourcePublicKey)
 * @param config - Optional SDK config overrides
 * @returns The mapped simulation result including cost metrics and status
 */
export async function simulateContractCall(
  params: ContractSimulationParams,
  config?: Partial<SDKConfig>,
): Promise<ContractSimulationResult> {
  const { contractId, operation, args = [], sourcePublicKey } = params;

  validatePublicKey(sourcePublicKey);

  try {
    const cfg = resolveConfig(config);
    const server = new StellarSDK.rpc.Server(cfg.sorobanRpcUrl);
    const networkPassphrase = getNetworkPassphrase(cfg.network);

    const account = await withTimeout(
      'Soroban account lookup for simulation',
      cfg.timeout,
      server.getAccount(sourcePublicKey),
    );

    const contract = new StellarSDK.Contract(contractId);

    const tx = new StellarSDK.TransactionBuilder(account, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase,
    })
      .addOperation(contract.call(operation, ...args))
      .setTimeout(30)
      .build();

    const simulationResponse = await withTimeout(
      'Soroban contract simulation',
      cfg.timeout,
      server.simulateTransaction(tx),
    );

    return mapSimulationResult(simulationResponse);
  } catch (error) {
    if (error instanceof PocketPayError) throw error;

    const mapped = mapSorobanContractError(error);
    throw wrapError(
      mapped,
      'Simulation failed due to network or configuration issue',
      'SIMULATION_ERROR',
    );
  }
}
