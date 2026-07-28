import * as StellarSDK from '@stellar/stellar-sdk';

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
 * Represents the result of a contract simulation.
 * The simulation happens before any cryptographic signing. 
 * If successful, the simulated transaction can be assembled and signed.
 */
export interface ContractSimulationResult {
  /** Whether the simulation succeeded without errors */
  success: boolean;
  
  /** The raw simulation response from Soroban RPC */
  rawSimulation?: StellarSDK.rpc.Api.SimulateTransactionResponse;

  /** Human-readable error message if the simulation failed */
  error?: string;
  
  /** 
   * If simulation fails, this may contain detailed contract errors or RPC errors 
   */
  errorCode?: string | number;

  /** Cost metrics returned by the simulation (CPU, RAM, fees) */
  cost?: {
    cpuInstructions?: string;
    ramBytes?: string;
    minResourceFee?: string;
  };
}
