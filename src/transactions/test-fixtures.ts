import * as StellarSDK from '@stellar/stellar-sdk';
import { 
  PreparedTransaction, 
  UnsignedTransaction, 
  SignedTransaction, 
  SubmissionResult 
} from './offline-preparation';

/** Deterministic mock source public key (G...) */
export const FIXTURE_SOURCE_PK = 'GBEDH75BXETOM2UPESSCHDVGV7XRDKS74YUKXTC7LR627DQ3SUZIJG3Y';
/** Deterministic mock destination public key (G...) */
export const FIXTURE_DESTINATION_PK = 'GBAW5KWLZU5PEUMR4PWXJVGFXDT4FRYIOKKTU74O5CGB24RWJS36LICH';
/** Deterministic mock secret key (S...) matching the source public key */
export const FIXTURE_SOURCE_SK = 'SDUTB2DT5NIGRKSGUHEU3TSZ4UJ45CJ3KVDSAKOOMHZEI64F2M4EIJCD'; 
/** We use Stellar Testnet as the deterministic network */
export const FIXTURE_NETWORK = StellarSDK.Networks.TESTNET;

/**
 * Creates a deterministic PreparedTransaction fixture.
 * 
 * @param overrides Optional overrides for the prepared transaction properties
 * @returns A deterministic PreparedTransaction
 */
export function createPreparedTransactionFixture(overrides?: Partial<PreparedTransaction>): PreparedTransaction {
  return {
    sourcePublicKey: FIXTURE_SOURCE_PK,
    networkPassphrase: FIXTURE_NETWORK,
    operations: [{
      destination: FIXTURE_DESTINATION_PK,
      amount: '10',
      asset: { code: 'XLM' }
    }],
    timebounds: { minTime: 1700000000, maxTime: 1700000300 },
    baseFee: '100',
    networkState: { sequence: '1234567890', fetchedAt: 1700000000 },
    readyToBuild: true,
    ...overrides
  };
}

/**
 * Creates a deterministic UnsignedTransaction fixture containing a real StellarSDK.Transaction.
 * 
 * @param overrides Optional overrides for the PreparedTransaction used to build it
 * @returns A deterministic UnsignedTransaction
 */
export function createUnsignedTransactionFixture(overrides?: Partial<PreparedTransaction>): UnsignedTransaction {
  const prepared = createPreparedTransactionFixture(overrides);
  
  const account = new StellarSDK.Account(
    prepared.sourcePublicKey,
    prepared.networkState.sequence
  );

  const builder = new StellarSDK.TransactionBuilder(account, {
    fee: prepared.baseFee,
    networkPassphrase: prepared.networkPassphrase,
    timebounds: prepared.timebounds,
  });

  for (const op of prepared.operations) {
    builder.addOperation(
      StellarSDK.Operation.payment({
        destination: op.destination,
        asset: StellarSDK.Asset.native(), // For simplicity in fixture, we assume native if XLM
        amount: op.amount,
      })
    );
  }

  if (prepared.memo) {
    builder.addMemo(StellarSDK.Memo.text(prepared.memo));
  }

  const transaction = builder.build();
  
  return {
    transaction,
    networkPassphrase: prepared.networkPassphrase,
    sourcePublicKey: prepared.sourcePublicKey,
    hash: transaction.hash().toString('hex'),
  };
}

/**
 * Creates a deterministic SignedTransaction fixture.
 * Note: Since we need a real signature, this uses a dummy keypair to sign the mock transaction.
 * 
 * @param secretKey Optional valid secret key to sign with. If omitted, a deterministic dummy key is used.
 * @param overrides Optional overrides for the underlying transaction
 * @returns A deterministic SignedTransaction
 */
export function createSignedTransactionFixture(
  secretKey: string = FIXTURE_SOURCE_SK,
  overrides?: Partial<PreparedTransaction>
): SignedTransaction {
  const unsigned = createUnsignedTransactionFixture(overrides);
  const keypair = StellarSDK.Keypair.fromSecret(secretKey);
  
  unsigned.transaction.sign(keypair);
  
  return {
    transaction: unsigned.transaction,
    networkPassphrase: unsigned.networkPassphrase,
    hash: unsigned.transaction.hash().toString('hex'),
    xdr: unsigned.transaction.toEnvelope().toXDR('base64'),
  };
}

/**
 * Creates a deterministic SubmissionResult fixture.
 * 
 * @param status The status of the submission ('success', 'failed', 'unknown')
 * @param overrides Optional overrides for the SubmissionResult properties
 * @returns A deterministic SubmissionResult
 */
export function createSubmissionResultFixture(
  status: 'success' | 'failed' | 'unknown', 
  overrides?: Partial<SubmissionResult>
): SubmissionResult {
  if (status === 'success') {
    return { 
      success: true, 
      hash: 'a1b2c3d4e5f678901234567890abcdef1234567890abcdef1234567890abcdef', 
      ledger: 12345, 
      fee: '100', 
      ...overrides 
    };
  } else if (status === 'failed') {
    return { 
      success: false, 
      hash: 'f6e5d4c3b2a109876543210987fedcba0987654321fedcba0987654321fedcba', 
      error: 'Transaction failed on network', 
      errorCode: 'TX_FAILED', 
      ...overrides 
    };
  } else {
    // unknown
    return { 
      success: false, 
      hash: '0000000000000000000000000000000000000000000000000000000000000000', 
      error: 'Transaction status unknown due to timeout', 
      errorCode: 'TX_STATUS_UNKNOWN', 
      ...overrides 
    };
  }
}
