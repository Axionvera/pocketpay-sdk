/**
 * Stellar PocketPay SDK — Soroban Contract Client Factory
 *
 * Provides a reusable factory for creating typed contract clients.
 * Separates read-only and state-changing calls with consistent error mapping.
 */

import * as StellarSDK from '@stellar/stellar-sdk';
import { resolveConfig, getNetworkPassphrase, validateContractId } from '../config';
import { PocketPayError, SDKConfig } from '../types';
import { withTimeout } from '../network';
import { ErrorCode, ERROR_CODES } from '../errors/codes';
import { UnsupportedFeatureError } from '../errors/unsupported';

// ─── Type Definitions ───────────────────────────────────────────────────────────

/**
 * Configuration for creating a contract client.
 */
export interface ContractClientConfig {
  /** The Soroban contract ID (C...) */
  contractId: string;
  /** Optional SDK configuration overrides */
  config?: Partial<SDKConfig>;
}

/**
 * Result of a state-changing contract invocation.
 */
export interface ContractInvokeResult<T = unknown> {
  /** Whether the invocation succeeded */
  success: boolean;
  /** Transaction hash (if submitted on-chain) */
  hash?: string;
  /** Parsed return value from the contract (if available) */
  value?: T;
  /** Error message if failed */
  error?: string;
}

/**
 * Soroban ScVal type specification for parameter encoding.
 */
export type ScValType = 
  | 'address'
  | 'bool'
  | 'i128'
  | 'i256'
  | 'i64'
  | 'i32'
  | 'u128'
  | 'u256'
  | 'u64'
  | 'u32'
  | 'bytes'
  | 'string'
  | 'symbol'
  | 'vec'
  | 'map'
  | 'option'
  | 'void';

/**
 * Parameter type mapping for contract method calls.
 */
export interface ParamTypes {
  [paramName: string]: ScValType;
}

/**
 * Parameters for a read-only contract call.
 */
export interface ReadOnlyCallOptions<TParams = Record<string, unknown>> {
  /** The contract method name to call */
  method: string;
  /** Parameters to pass to the method */
  params: TParams;
  /** Type specification for each parameter */
  paramTypes: ParamTypes;
  /** Optional parser for the return value (defaults to scValToNative) */
  resultParser?: (scVal: StellarSDK.xdr.ScVal) => unknown;
  /** Source account for building the transaction (required for read calls) */
  sourcePublicKey: string;
}

/**
 * Parameters for a state-changing contract call.
 */
export interface InvokeCallOptions<TParams = Record<string, unknown>> {
  /** The contract method name to call */
  method: string;
  /** Parameters to pass to the method */
  params: TParams;
  /** Type specification for each parameter */
  paramTypes: ParamTypes;
  /** Secret key of the account signing the transaction */
  signWith: string;
  /** Optional parser for the return value (defaults to scValToNative) */
  resultParser?: (scVal: StellarSDK.xdr.ScVal) => unknown;
}

/**
 * Error mapping configuration for contract-specific error codes.
 */
export interface ErrorMapping {
  /** Map contract error strings to SDK error codes */
  [contractError: string]: string;
}

// ─── Contract Client Class ───────────────────────────────────────────────────────

/**
 * Typed contract client for Soroban smart contracts.
 *
 * Provides methods for read-only (simulated) calls and state-changing
 * (signed/submitted) calls with consistent error handling.
 */
export class ContractClient {
  private readonly contractId: string;
  private readonly config: SDKConfig;
  private readonly sorobanServer: StellarSDK.rpc.Server;
  private readonly networkPassphrase: string;
  private readonly contract: StellarSDK.Contract;
  private readonly errorMapping: ErrorMapping;

  constructor(
    config: ContractClientConfig,
    errorMapping: ErrorMapping = {}
  ) {
    validateContractId(config.contractId);
    this.contractId = config.contractId;
    this.config = resolveConfig(config.config);
    this.sorobanServer = new StellarSDK.rpc.Server(this.config.sorobanRpcUrl);
    this.networkPassphrase = getNetworkPassphrase(this.config.network);
    this.contract = new StellarSDK.Contract(this.contractId);
    this.errorMapping = errorMapping;
  }

  /**
   * Performs a read-only contract call via simulation.
   *
   * This method builds a transaction, simulates it, and returns the
   * parsed result without signing or submitting to the network.
   *
   * @param options - Read-only call options
   * @returns Parsed return value from the contract
   * @throws PocketPayError if the call fails
   */
  public async readOnly<T = unknown>(options: ReadOnlyCallOptions): Promise<T> {
    const { method, params, paramTypes, resultParser, sourcePublicKey } = options;

    try {
      // Build transaction with the contract call
      const account = await this.getAccount(sourcePublicKey);
      const tx = this.buildTransaction(account, method, params, paramTypes);

      // Simulate the transaction
      const simulated = await withTimeout(
        'Soroban transaction simulation',
        this.config.timeout,
        this.sorobanServer.simulateTransaction(tx),
      );

      if (StellarSDK.rpc.Api.isSimulationError(simulated)) {
        const error = this.mapContractError((simulated as any).error);
        throw new PocketPayError(
          `Simulation failed: ${error}`,
          ErrorCode.SOROBAN_SIMULATION_FAILED,
          {
            cause: new Error(error),
            category: ERROR_CODES[ErrorCode.SOROBAN_SIMULATION_FAILED].category,
            safeMessage: ERROR_CODES[ErrorCode.SOROBAN_SIMULATION_FAILED].safeMessage,
          }
        );
      }

      // Extract and parse return value
      const successSim = simulated as StellarSDK.rpc.Api.SimulateTransactionSuccessResponse;
      if (successSim.result && successSim.result.retval) {
        const parser = resultParser || StellarSDK.scValToNative;
        return parser(successSim.result.retval) as T;
      }

      return undefined as T;
    } catch (error) {
      if (error instanceof PocketPayError) throw error;
      throw this.wrapError(error, `Read-only call to ${method} failed`, 'CONTRACT_READONLY_ERROR');
    }
  }

  /**
   * Performs a state-changing contract call.
   *
   * This method builds, simulates, signs, and submits a transaction,
   * then polls for the final result.
   *
   * @param options - Invoke call options
   * @returns Contract invocation result with transaction details
   * @throws PocketPayError if the call fails
   */
  public async invoke<T = unknown>(options: InvokeCallOptions): Promise<ContractInvokeResult<T>> {
    const { method, params, paramTypes, signWith, resultParser } = options;

    try {
      const keypair = StellarSDK.Keypair.fromSecret(signWith);
      const publicKey = keypair.publicKey();
      const account = await this.getAccount(publicKey);

      // Build transaction with the contract call
      const tx = this.buildTransaction(account, method, params, paramTypes);

      // Simulate the transaction
      const simulated = await withTimeout(
        'Soroban transaction simulation',
        this.config.timeout,
        this.sorobanServer.simulateTransaction(tx),
      );

      if (StellarSDK.rpc.Api.isSimulationError(simulated)) {
        const error = this.mapContractError((simulated as any).error);
        return {
          success: false,
          error: `Simulation failed: ${error}`,
        };
      }

      // Prepare and sign the transaction
      const prepared = StellarSDK.rpc.assembleTransaction(tx, simulated).build();
      prepared.sign(keypair);

      // Submit the transaction
      const sendResult = await withTimeout(
        'Soroban transaction submission',
        this.config.timeout,
        this.sorobanServer.sendTransaction(prepared),
      );

      if (sendResult.status === 'ERROR') {
        return { success: false, error: `Send error: ${sendResult.errorResult}` };
      }

      // Poll for transaction status
      const getResult = await this.pollTransactionStatus(sendResult.hash);

      if (getResult.status === 'SUCCESS') {
        let value: T | undefined;
        const successResult = getResult as StellarSDK.rpc.Api.GetSuccessfulTransactionResponse;
        if (successResult.returnValue) {
          const parser = resultParser || StellarSDK.scValToNative;
          value = parser(successResult.returnValue) as T;
        }

        return {
          success: true,
          hash: sendResult.hash,
          value,
        };
      }

      return { success: false, error: `Transaction status: ${getResult.status}` };
    } catch (error) {
      if (error instanceof PocketPayError) throw error;
      throw this.wrapError(error, `Invoke call to ${method} failed`, 'CONTRACT_INVOKE_ERROR');
    }
  }

  /**
   * Gets the account information for building transactions.
   */
  private async getAccount(publicKey: string) {
    return await withTimeout(
      'Soroban account lookup',
      this.config.timeout,
      this.sorobanServer.getAccount(publicKey),
    );
  }

  /**
   * Builds a transaction with a contract call operation.
   */
  private buildTransaction(
    account: any,
    method: string,
    params: Record<string, unknown>,
    paramTypes: ParamTypes
  ): StellarSDK.Transaction {
    const scParams = this.encodeParams(params, paramTypes);

    return new StellarSDK.TransactionBuilder(account, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...scParams))
      .setTimeout(30)
      .build();
  }

  /**
   * Encodes parameters to ScVal format based on type specifications.
   *
   * `ScValType` advertises every member below as usable, but the underlying
   * Stellar SDK rejects `vec` during encoding (`invalid type: vec`). Callers
   * used to receive that bare message with no code or category; the capability
   * is now reported through the published standard instead.
   */
  private encodeParams(params: Record<string, unknown>, paramTypes: ParamTypes): StellarSDK.xdr.ScVal[] {
    return Object.entries(paramTypes).map(([paramName, type]) => {
      const value = params[paramName];
      if (value === undefined) {
        throw new PocketPayError(
          `Missing parameter: ${paramName}`,
          'MISSING_CONTRACT_PARAM',
          { validation: { field: paramName, reason: 'missing' } }
        );
      }
      if (type === 'vec') {
        throw new UnsupportedFeatureError({
          module: 'soroban',
          operation: 'encodeParams',
          capability: 'soroban.param-type.vec',
          message:
            `Parameter "${paramName}" declares the ScVal type "vec", which this SDK cannot encode.`,
        });
      }
      return StellarSDK.nativeToScVal(value, { type });
    });
  }

  /**
   * Polls for transaction status until it resolves.
   */
  private async pollTransactionStatus(hash: string): Promise<StellarSDK.rpc.Api.GetSuccessfulTransactionResponse | StellarSDK.rpc.Api.GetFailedTransactionResponse> {
    let getResult = await withTimeout(
      'Soroban transaction status request',
      this.config.timeout,
      this.sorobanServer.getTransaction(hash),
    );

    while (getResult.status === 'NOT_FOUND') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      getResult = await withTimeout(
        'Soroban transaction status request',
        this.config.timeout,
        this.sorobanServer.getTransaction(hash),
      );
    }

    return getResult;
  }

  /**
   * Maps contract-specific errors to SDK error codes.
   */
  private mapContractError(error: string): string {
    for (const [contractError, sdkCode] of Object.entries(this.errorMapping)) {
      if (error.includes(contractError)) {
        return `${sdkCode}: ${error}`;
      }
    }
    return error;
  }

  /**
   * Wraps an error in a PocketPayError.
   */
  private wrapError(error: unknown, message: string, code: string): PocketPayError {
    if (error instanceof PocketPayError) return error;
    return new PocketPayError(message, code, { cause: error as Error });
  }

  /**
   * Gets the contract ID for this client.
   */
  getContractId(): string {
    return this.contractId;
  }

  /**
   * Gets the Soroban RPC server instance.
   */
  getSorobanServer(): StellarSDK.rpc.Server {
    return this.sorobanServer;
  }
}

// ─── Factory Function ───────────────────────────────────────────────────────────

/**
 * Factory function for creating typed contract clients.
 *
 * @param config - Contract client configuration
 * @param errorMapping - Optional error mapping for contract-specific errors
 * @returns A new ContractClient instance
 */
export function createContractClient(
  config: ContractClientConfig,
  errorMapping?: ErrorMapping
): ContractClient {
  return new ContractClient(config, errorMapping);
}

// ─── Specialized Vault Client ────────────────────────────────────────────────────

/**
 * Specialized client for the PocketPay Savings Vault contract.
 *
 * Provides typed methods for vault-specific operations with built-in
 * parameter encoding and result parsing.
 */
export class VaultClient extends ContractClient {
  constructor(config: ContractClientConfig) {
    const errorMapping: ErrorMapping = {
      'insufficient balance': 'VAULT_INSUFFICIENT_BALANCE',
      'unauthorized': 'VAULT_UNAUTHORIZED',
      'invalid amount': 'VAULT_INVALID_AMOUNT',
    };
    super(config, errorMapping);
  }

  /**
   * Deposits XLM into the vault.
   */
  async deposit(user: string, amount: string): Promise<ContractInvokeResult<void>> {
    const amountInStroops = Math.round(parseFloat(amount) * 10_000_000);
    
    return this.invoke({
      method: 'deposit',
      params: { user, amount: amountInStroops },
      paramTypes: { user: 'address', amount: 'i128' },
      signWith: user,
    });
  }

  /**
   * Withdraws XLM from the vault.
   */
  async withdraw(user: string, amount: string): Promise<ContractInvokeResult<void>> {
    const amountInStroops = Math.round(parseFloat(amount) * 10_000_000);
    
    return this.invoke({
      method: 'withdraw',
      params: { user, amount: amountInStroops },
      paramTypes: { user: 'address', amount: 'i128' },
      signWith: user,
    });
  }

  /**
   * Gets the available balance for a user.
   */
  async getBalance(user: string): Promise<string> {
    const balance = await this.readOnly<bigint>({
      method: 'get_balance',
      params: { user },
      paramTypes: { user: 'address' },
      sourcePublicKey: user,
    });

    const balanceXLM = (Number(balance) / 10_000_000).toFixed(7);
    return balanceXLM;
  }
}

/**
 * Factory function for creating a specialized Vault client.
 *
 * @param config - Contract client configuration
 * @returns A new VaultClient instance
 */
export function createVaultClient(config: ContractClientConfig): VaultClient {
  return new VaultClient(config);
}
