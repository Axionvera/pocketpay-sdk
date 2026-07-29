/**
 * Soroban transaction simulation types.
 *
 * {@link SimulationMappedResult} is the typed outcome of mapping a raw RPC
 * simulation response into success / warning / failed / unsupported / unknown.
 */

import type * as StellarSDK from '@stellar/stellar-sdk';

/** Discriminated outcome of a mapped Soroban simulation response. */
export type SimulationResultStatus =
  | 'success'
  | 'warning'
  | 'failed'
  | 'unsupported'
  | 'unknown';

/** Non-fatal advisory attached to a successful or warning simulation. */
export interface SimulationWarning {
  code: string;
  message: string;
}

/**
 * Typed simulation outcome used by the SDK mapper and Soroban client.
 *
 * - `success` — simulation succeeded; safe to assemble/sign (when applicable)
 * - `warning` — simulation succeeded with non-fatal advisories
 * - `failed` — simulation returned an error (contract/runtime)
 * - `unsupported` — response indicates a path the client cannot complete
 *   (e.g. ledger entry restoration required before the call)
 * - `unknown` — response shape could not be classified safely
 */
export interface SimulationMappedResult<T = unknown> {
  /** `true` only for `success` and `warning`. */
  success: boolean;
  status: SimulationResultStatus;
  /** Parsed return value when present on a successful simulation. */
  result?: T;
  /** Cost metrics returned by the simulation (CPU, RAM, fees). */
  cost?: {
    cpuInstructions?: string;
    ramBytes?: string;
    minResourceFee?: string;
  };
  /** Non-fatal advisories (primarily for `warning`). */
  warnings?: SimulationWarning[];
  /** Human-readable failure / unsupported / unknown detail. */
  error?: string;
  /** Typed error code when applicable. */
  errorCode?: string | number;
  /** Original RPC payload for diagnostics (never logged by the SDK). */
  rawSimulation?: unknown;
}

/**
 * Parameters for simulating a Soroban contract call.
 * This ensures state-changing calls are validated before prompting the user for a signature.
 */
export interface ContractSimulationParams {
  /** The contract ID to invoke */
  contractId: string;
  /** The method/operation name to call on the contract */
  operation: string;
  /** The arguments to pass to the operation, wrapped as ScVals */
  args?: StellarSDK.xdr.ScVal[];
  /** The public key of the account invoking the contract */
  sourcePublicKey: string;
}

/**
 * Result of a contract call simulation.
 *
 * Extends {@link SimulationMappedResult} so consumers always receive a typed
 * `status` alongside the legacy `success` / `cost` / `error` fields.
 */
export type ContractSimulationResult<T = unknown> = SimulationMappedResult<T>;
