/**
 * Stellar PocketPay SDK — Offline Transaction Preparation
 *
 * Provides support for preparing transactions offline before signing and later submission.
 * This module defines what can be prepared without network access and what requires
 * network state, enabling workflows where transaction preparation and signing happen
 * separately from submission.
 *
 * Offline Preparation Model
 * ────────────────────────────────────────────────────────────────────────────────
 *
 * CAN BE PREPARED OFFLINE (no network required):
 * - Transaction operations (payment, manage data, etc.)
 * - Memo construction
 * - Asset specifications
 * - Timebounds (can use estimated or provided values)
 * - Basic input validation
 *
 * REQUIRES NETWORK STATE (must be fetched or provided):
 * - Source account sequence number (CRITICAL - required for transaction validity)
 * - Account balance verification (optional but recommended)
 * - Fee estimation (optional - can use default BASE_FEE)
 * - Trustline verification for issued assets (optional but recommended)
 *
 * Workflow
 * ────────────────────────────────────────────────────────────────────────────────
 *
 * 1. PREPARE OFFLINE: Build transaction operations and metadata without network
 * 2. FETCH STATE: Get sequence number and optional account data (can be done later)
 * 3. BUILD: Assemble the transaction with sequence number and timebounds
 * 4. SIGN: Sign the transaction (can be done offline with local keys)
 * 5. SUBMIT: Submit to Horizon (requires network access)
 *
 * This enables use cases like:
 * - Air-gapped signing (prepare on online machine, sign on offline machine)
 * - Multi-party coordination (prepare transaction, get signatures from multiple parties)
 * - Delayed submission (prepare now, submit when network is available)
 * - Transaction queuing (prepare multiple transactions, submit in batch)
 */

import * as StellarSDK from '@stellar/stellar-sdk';
import { getHorizonServer, getNetworkPassphrase, resolveConfig } from '../config';
import {
  StellarAssetSpec,
  PocketPayError,
  SDKConfig,
  PocketPayResult,
} from '../types';
import { validatePublicKey, validateSecretKey, validateAmount, validateMemoInput, buildMemo, wrapError, toResult } from '../utils';
import { withTimeout } from '../network';

// ─── Type Definitions ───────────────────────────────────────────────────────────

/**
 * Payment operation that can be prepared offline.
 */
export interface OfflinePaymentOperation {
  /** Destination account public key */
  destination: string;
  /** Amount to send (as string for precision) */
  amount: string;
  /** Asset specification (native XLM or issued asset) */
  asset: StellarAssetSpec;
}

/**
 * Transaction preparation parameters that can be provided offline.
 */
export interface OfflineTransactionParams {
  /** Source account public key */
  sourcePublicKey: string;
  /** Payment operations to include in the transaction */
  operations: OfflinePaymentOperation[];
  /** Optional memo text (max 28 bytes) */
  memo?: string;
  /** Optional timebounds (if not provided, defaults will be used) */
  timebounds?: {
    /** Minimum timestamp (Unix seconds) */
    minTime?: number;
    /** Maximum timestamp (Unix seconds) */
    maxTime?: number;
  };
  /** Base fee in stroops (if not provided, uses network default) */
  baseFee?: string;
}

/**
 * Network state required to complete transaction building.
 * Some of this can be fetched later, some must be provided.
 */
export interface NetworkState {
  /** Source account sequence number (REQUIRED for valid transaction) */
  sequence: string;
  /** Current base fee from network (optional - can use default) */
  currentFee?: string;
  /** Account balance information (optional - for validation) */
  balance?: {
    /** Native XLM balance */
    native: string;
    /** Minimum balance required */
    minimum: string;
  };
}

/**
 * Prepared transaction that can be signed and submitted later.
 */
export interface PreparedTransaction {
  /** Source account public key */
  sourcePublicKey: string;
  /** Network passphrase */
  networkPassphrase: string;
  /** Transaction operations (serialized) */
  operations: OfflinePaymentOperation[];
  /** Optional memo */
  memo?: string;
  /** Timebounds */
  timebounds: {
    minTime: number;
    maxTime: number;
  };
  /** Base fee in stroops */
  baseFee: string;
  /** Network state used for preparation */
  networkState: NetworkState;
  /** Whether the transaction is ready to be built */
  readyToBuild: boolean;
  /** Transaction hash (calculated after building) */
  transactionHash?: string;
}

/**
 * Built but unsigned transaction ready for signing.
 */
export interface UnsignedTransaction {
  /** The Stellar SDK Transaction object (unsigned) */
  transaction: StellarSDK.Transaction;
  /** Network passphrase for signing */
  networkPassphrase: string;
  /** Source account public key */
  sourcePublicKey: string;
  /** Transaction hash (for verification) */
  hash: string;
}

/**
 * Signed transaction ready for submission.
 */
export interface SignedTransaction {
  /** The Stellar SDK Transaction object (signed) */
  transaction: StellarSDK.Transaction;
  /** Network passphrase */
  networkPassphrase: string;
  /** Transaction hash */
  hash: string;
  /** XDR representation of the signed transaction envelope */
  xdr: string;
}

/**
 * Transaction submission result.
 */
export interface SubmissionResult {
  /** Whether the submission was successful */
  success: boolean;
  /** Transaction hash */
  hash: string;
  /** Ledger number (if successful) */
  ledger?: number;
  /** Fee charged (if successful) */
  fee?: string;
  /** Error message (if failed) */
  error?: string;
  /** Error code (if failed) */
  errorCode?: string;
}

// ─── Offline Preparation Functions ─────────────────────────────────────────────

/**
 * Prepares a transaction offline without network access.
 *
 * This function validates inputs and constructs the transaction structure,
 * but cannot build the final transaction without the source account sequence number.
 *
 * @param params - Transaction preparation parameters
 * @param config - SDK config (for network passphrase)
 * @returns Prepared transaction (not yet ready to build)
 */
export function prepareTransactionOffline(
  params: OfflineTransactionParams,
  config?: Partial<SDKConfig>,
): PreparedTransaction {
  // Validate inputs
  validatePublicKey(params.sourcePublicKey);
  
  for (const op of params.operations) {
    validatePublicKey(op.destination);
    validateAmount(op.amount);
    validateAssetSpecOffline(op.asset);
  }
  
  validateMemoInput(params.memo);

  const cfg = resolveConfig(config);
  const networkPassphrase = getNetworkPassphrase(cfg.network);

  // Default timebounds: valid for 5 minutes from now (estimated)
  const now = Math.floor(Date.now() / 1000);
  const timebounds = params.timebounds || {
    minTime: now,
    maxTime: now + 300, // 5 minutes
  };
  
  // Ensure timebounds has both values
  const finalTimebounds = {
    minTime: timebounds.minTime ?? now,
    maxTime: timebounds.maxTime ?? (now + 300),
  };

  // Default base fee
  const baseFee = params.baseFee || String(StellarSDK.BASE_FEE);

  return {
    sourcePublicKey: params.sourcePublicKey,
    networkPassphrase,
    operations: params.operations,
    memo: params.memo,
    timebounds: finalTimebounds,
    baseFee,
    networkState: {
      sequence: '', // Not yet provided
    },
    readyToBuild: false, // Needs sequence number
  };
}

/**
 * Validates asset specification offline.
 */
function validateAssetSpecOffline(asset: StellarAssetSpec): boolean {
  if (!asset || typeof asset !== 'object') {
    throw new PocketPayError('Invalid asset specification object', 'INVALID_ASSET', {
      validation: { field: 'asset', reason: 'invalid_object' },
    });
  }

  const code = (asset.code || '').trim();
  if (!code) {
    throw new PocketPayError('Asset code is required', 'INVALID_ASSET_CODE', {
      validation: { field: 'asset.code', reason: 'empty' },
    });
  }

  const isNative = code.toUpperCase() === 'XLM' || code.toLowerCase() === 'native';

  if (isNative) {
    if (asset.issuer && asset.issuer.trim().length > 0) {
      throw new PocketPayError('Native XLM asset must not specify an issuer', 'INVALID_ASSET', {
        validation: { field: 'asset.issuer', reason: 'native_asset_has_issuer', value: asset.issuer },
      });
    }
    return true;
  }

  // Issued asset code validation: 1-12 alphanumeric characters
  if (!/^[a-zA-Z0-9]{1,12}$/.test(code)) {
    throw new PocketPayError(
      `Invalid asset code: "${code}". Must be 1-12 alphanumeric characters.`,
      'INVALID_ASSET_CODE',
      {
        validation: { field: 'asset.code', reason: 'invalid_format', value: code },
      },
    );
  }

  if (!asset.issuer || asset.issuer.trim().length === 0) {
    throw new PocketPayError(
      `Issued asset "${code}" requires an issuer public key (G...).`,
      'MISSING_ASSET_ISSUER',
      {
        validation: { field: 'asset.issuer', reason: 'missing' },
      },
    );
  }

  validatePublicKey(asset.issuer);
  return true;
}

// ─── Network State Functions ─────────────────────────────────────────────────────

/**
 * Fetches the network state required to complete transaction building.
 *
 * This function makes a Horizon call to get the source account's sequence number
 * and optional balance information.
 *
 * @param publicKey - Source account public key
 * @param config - SDK config
 * @returns Network state including sequence number
 */
export async function fetchNetworkState(
  publicKey: string,
  config?: Partial<SDKConfig>,
): Promise<NetworkState> {
  validatePublicKey(publicKey);

  const cfg = resolveConfig(config);
  const server = getHorizonServer(config);

  try {
    const account = await withTimeout(
      'Horizon account lookup for transaction preparation',
      cfg.timeout,
      server.loadAccount(publicKey),
    ) as any;

    return {
      sequence: account.sequence,
      currentFee: String(StellarSDK.BASE_FEE), // Could fetch actual fee from network
      balance: {
        native: account.balances?.find((b: any) => b.asset_type === 'native')?.balance || '0',
        minimum: '2.5', // Minimum reserve on Stellar
      },
    };
  } catch (error) {
    if ((error as any)?.response?.status === 404) {
      throw new PocketPayError(
        `Source account not found: ${publicKey}. It may not be funded yet.`,
        'ACCOUNT_NOT_FOUND',
        404
      );
    }
    throw wrapError(error, 'Failed to fetch network state', 'NETWORK_STATE_ERROR');
  }
}

/**
 * Updates a prepared transaction with network state.
 *
 * This adds the sequence number and makes the transaction ready to build.
 *
 * @param prepared - Previously prepared transaction
 * @param networkState - Network state from fetchNetworkState or manual input
 * @returns Updated prepared transaction ready to build
 */
export function updateWithNetworkState(
  prepared: PreparedTransaction,
  networkState: NetworkState,
): PreparedTransaction {
  if (!networkState.sequence) {
    throw new PocketPayError(
      'Network state must include sequence number',
      'MISSING_SEQUENCE',
      {
        validation: { field: 'sequence', reason: 'required' },
      },
    );
  }

  return {
    ...prepared,
    networkState,
    readyToBuild: true,
  };
}

// ─── Transaction Building Functions ─────────────────────────────────────────────

/**
 * Builds an unsigned transaction from a prepared transaction.
 *
 * This function requires the prepared transaction to have network state (sequence number).
 *
 * @param prepared - Prepared transaction with network state
 * @returns Unsigned transaction ready for signing
 */
export function buildUnsignedTransaction(
  prepared: PreparedTransaction,
): UnsignedTransaction {
  if (!prepared.readyToBuild) {
    throw new PocketPayError(
      'Transaction is not ready to build - missing network state (sequence number)',
      'TRANSACTION_NOT_READY',
      {
        validation: { field: 'networkState.sequence', reason: 'required' },
      },
    );
  }

  // Create account object for TransactionBuilder
  const account = new StellarSDK.Account(
    prepared.sourcePublicKey,
    prepared.networkState.sequence,
  );

  // Build transaction
  const builder = new StellarSDK.TransactionBuilder(account, {
    fee: prepared.baseFee,
    networkPassphrase: prepared.networkPassphrase,
    timebounds: prepared.timebounds,
  });

  // Add operations
  for (const op of prepared.operations) {
    const asset = resolveAsset(op.asset);
    builder.addOperation(
      StellarSDK.Operation.payment({
        destination: op.destination,
        asset,
        amount: op.amount,
      }),
    );
  }

  // Add memo if provided
  if (prepared.memo) {
    const preparedMemo = buildMemo(prepared.memo);
    if (preparedMemo) builder.addMemo(preparedMemo);
  }

  const transaction = builder.build();
  const hash = transaction.hash().toString('hex');

  return {
    transaction,
    networkPassphrase: prepared.networkPassphrase,
    sourcePublicKey: prepared.sourcePublicKey,
    hash,
  };
}

/**
 * Resolves a StellarAssetSpec to a Stellar SDK Asset object.
 */
function resolveAsset(asset: StellarAssetSpec): StellarSDK.Asset {
  const code = asset.code.trim().toUpperCase();
  if (code === 'XLM' || asset.code.toLowerCase() === 'native') {
    return StellarSDK.Asset.native();
  }
  return new StellarSDK.Asset(asset.code, asset.issuer!);
}

// ─── Signing Functions ───────────────────────────────────────────────────────────

/**
 * Signs an unsigned transaction with a secret key.
 *
 * @param unsigned - Unsigned transaction
 * @param secretKey - Source account secret key
 * @returns Signed transaction ready for submission
 */
export function signTransaction(
  unsigned: UnsignedTransaction,
  secretKey: string,
): SignedTransaction {
  validateSecretKey(secretKey);

  const keypair = StellarSDK.Keypair.fromSecret(secretKey);
  const transaction = unsigned.transaction;

  // Verify the secret key matches the source public key
  if (keypair.publicKey() !== unsigned.sourcePublicKey) {
    throw new PocketPayError(
      'Secret key does not match source public key',
      'KEY_MISMATCH',
      {
        validation: { field: 'secretKey', reason: 'mismatch' },
      },
    );
  }

  // Sign the transaction
  transaction.sign(keypair);

  const hash = transaction.hash().toString('hex');
  const xdr = transaction.toEnvelope().toXDR('base64');

  return {
    transaction,
    networkPassphrase: unsigned.networkPassphrase,
    hash,
    xdr,
  };
}

/**
 * Signs an unsigned transaction using a Signer interface.
 *
 * This enables integration with hardware wallets and other external signers.
 *
 * @param unsigned - Unsigned transaction
 * @param signer - Signer implementation
 * @returns Signed transaction ready for submission
 */
export async function signTransactionWithSigner(
  unsigned: UnsignedTransaction,
  signer: { publicKey: string; sign(tx: StellarSDK.Transaction, networkPassphrase: string): Promise<StellarSDK.Transaction> },
): Promise<SignedTransaction> {
  // Verify the signer matches the source public key
  if (signer.publicKey !== unsigned.sourcePublicKey) {
    throw new PocketPayError(
      'Signer public key does not match source public key',
      'KEY_MISMATCH',
      {
        validation: { field: 'signer', reason: 'mismatch' },
      },
    );
  }

  const transaction = await signer.sign(unsigned.transaction, unsigned.networkPassphrase);
  const hash = transaction.hash().toString('hex');
  const xdr = transaction.toEnvelope().toXDR('base64');

  return {
    transaction,
    networkPassphrase: unsigned.networkPassphrase,
    hash,
    xdr,
  };
}

// ─── Submission Functions ───────────────────────────────────────────────────────

/**
 * Submits a signed transaction to Horizon.
 *
 * @param signed - Signed transaction
 * @param config - SDK config
 * @returns Submission result
 */
export async function submitSignedTransaction(
  signed: SignedTransaction,
  config?: Partial<SDKConfig>,
): Promise<SubmissionResult> {
  const cfg = resolveConfig(config);
  const server = getHorizonServer(config);

  try {
    const result = await withTimeout(
      'Horizon transaction submission',
      cfg.timeout,
      server.submitTransaction(signed.transaction),
    );

    const resultObj = result as any;
    return {
      success: true,
      hash: resultObj.hash,
      ledger: resultObj.ledger,
      fee: resultObj.fee_charged || String(StellarSDK.BASE_FEE),
    };
  } catch (error) {
    const horizonError = error as any;
    
    if (horizonError?.response?.data?.extras?.result_codes) {
      const codes = horizonError.response.data.extras.result_codes;
      return {
        success: false,
        hash: signed.hash,
        error: `Payment failed with transaction result code: ${codes.transaction}`,
        errorCode: codes.transaction,
      };
    }

    if (horizonError?.response?.status === 404) {
      return {
        success: false,
        hash: signed.hash,
        error: 'Source account not found',
        errorCode: 'ACCOUNT_NOT_FOUND',
      };
    }

    return {
      success: false,
      hash: signed.hash,
      error: horizonError?.message || String(error),
      errorCode: 'SUBMISSION_ERROR',
    };
  }
}

// ─── Complete Workflow Functions ───────────────────────────────────────────────

/**
 * Complete offline preparation workflow: prepare, fetch state, build, sign.
 *
 * This combines the steps for a typical offline preparation flow.
 *
 * @param params - Transaction preparation parameters
 * @param secretKey - Source account secret key
 * @param config - SDK config
 * @returns Signed transaction ready for submission
 */
export async function prepareAndSignTransaction(
  params: OfflineTransactionParams,
  secretKey: string,
  config?: Partial<SDKConfig>,
): Promise<SignedTransaction> {
  // 1. Prepare offline
  const prepared = prepareTransactionOffline(params, config);

  // 2. Fetch network state
  const networkState = await fetchNetworkState(params.sourcePublicKey, config);

  // 3. Update with network state
  const updated = updateWithNetworkState(prepared, networkState);

  // 4. Build unsigned transaction
  const unsigned = buildUnsignedTransaction(updated);

  // 5. Sign
  return signTransaction(unsigned, secretKey);
}

/**
 * Prepare transaction with manual sequence number (fully offline).
 *
 * This allows completely offline preparation if the sequence number is known.
 *
 * @param params - Transaction preparation parameters
 * @param sequence - Manual sequence number
 * @param config - SDK config
 * @returns Prepared transaction ready to build
 */
export function prepareTransactionWithManualSequence(
  params: OfflineTransactionParams,
  sequence: string,
  config?: Partial<SDKConfig>,
): PreparedTransaction {
  const prepared = prepareTransactionOffline(params, config);
  return updateWithNetworkState(prepared, { sequence });
}

// ─── Safe Wrappers ─────────────────────────────────────────────────────────────

/**
 * Non-throwing wrapper for fetchNetworkState.
 */
export async function safeFetchNetworkState(
  publicKey: string,
  config?: Partial<SDKConfig>,
): Promise<PocketPayResult<NetworkState>> {
  return toResult(
    () => fetchNetworkState(publicKey, config),
    'Failed to fetch network state',
    'NETWORK_STATE_ERROR',
  );
}

/**
 * Non-throwing wrapper for submitSignedTransaction.
 */
export async function safeSubmitSignedTransaction(
  signed: SignedTransaction,
  config?: Partial<SDKConfig>,
): Promise<PocketPayResult<SubmissionResult>> {
  return toResult(
    () => submitSignedTransaction(signed, config),
    'Failed to submit transaction',
    'SUBMISSION_ERROR',
  );
}

/**
 * Non-throwing wrapper for prepareAndSignTransaction.
 */
export async function safePrepareAndSignTransaction(
  params: OfflineTransactionParams,
  secretKey: string,
  config?: Partial<SDKConfig>,
): Promise<PocketPayResult<SignedTransaction>> {
  return toResult(
    () => prepareAndSignTransaction(params, secretKey, config),
    'Failed to prepare and sign transaction',
    'PREPARATION_ERROR',
  );
}
