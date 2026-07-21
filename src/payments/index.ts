/**
 * Stellar PocketPay SDK — Payments Module
 *
 * Send XLM payments on the Stellar network.
 */

import * as StellarSDK from '@stellar/stellar-sdk';
import { getHorizonServer, getNetworkPassphrase } from '../config';
import { SendXLMParams, PaymentResult, PocketPayError, SDKConfig } from '../types';
import { validateSecretKey, validatePublicKey, validateAmount, wrapError } from '../utils';
import { submitTransactionIdempotently } from '../network/idempotency';
import { classifySubmitError } from '../errors';

/**
 * Sends XLM from one account to another.
 *
 * @param params - Payment parameters (sourceSecret, destination, amount, memo?)
 * @param config - Optional SDK config overrides
 * @returns Payment result with transaction hash and details
 * @throws PocketPayError on validation or network errors
 */
export async function sendXLM(
  params: SendXLMParams,
  config?: Partial<SDKConfig>
): Promise<PaymentResult> {
  const { sourceSecret, destination, amount, memo } = params;

  // Validate inputs
  validateSecretKey(sourceSecret);
  validatePublicKey(destination);
  validateAmount(amount);

  if (memo && Buffer.byteLength(memo, 'utf-8') > 28) {
    throw new PocketPayError('Memo text exceeds 28-byte limit', 'INVALID_MEMO');
  }

  const sourceKeypair = StellarSDK.Keypair.fromSecret(sourceSecret);
  const sourcePublic = sourceKeypair.publicKey();

  if (sourcePublic === destination) {
    throw new PocketPayError('Cannot send XLM to yourself', 'SELF_PAYMENT');
  }

  let transaction: StellarSDK.Transaction | undefined;
  try {
    const server = getHorizonServer(config);
    const networkPassphrase = getNetworkPassphrase();
    const sourceAccount = await server.loadAccount(sourcePublic);

    // Build transaction
    const builder = new StellarSDK.TransactionBuilder(sourceAccount, {
      fee: StellarSDK.BASE_FEE,
      networkPassphrase,
    });

    builder.addOperation(
      StellarSDK.Operation.payment({
        destination,
        asset: StellarSDK.Asset.native(),
        amount,
      })
    );

    if (memo) {
      builder.addMemo(StellarSDK.Memo.text(memo));
    }

    builder.setTimeout(30);
    transaction = builder.build();
    transaction.sign(sourceKeypair);

    const txHash = transaction.hash().toString('hex');

    try {
      const result = await submitTransactionIdempotently(transaction, {}, config);
      const resultObj = result as any;

      return {
        success: true,
        hash: resultObj.hash,
        ledger: resultObj.ledger,
        fee: resultObj.fee_charged || String(StellarSDK.BASE_FEE),
        sourceAccount: sourcePublic,
        destinationAccount: destination,
        amount,
        createdAt: resultObj.created_at || new Date().toISOString(),
      };
    } catch (submitError) {
      throw classifySubmitError(submitError, txHash);
    }
  } catch (error) {
    if (error instanceof PocketPayError) throw error;
    throw wrapError(error, 'Failed to send XLM', 'SEND_ERROR');
  }
}
