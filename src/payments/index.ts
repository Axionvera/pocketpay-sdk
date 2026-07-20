/**
 * Stellar PocketPay SDK — Payments Module
 *
 * Send XLM payments on the Stellar network.
 */
import * as StellarSDK from '@stellar/stellar-sdk';
import { getHorizonServer, getNetworkPassphrase, resolveConfig } from '../config';
import { SendXLMParams, PaymentResult, PocketPayError, SDKConfig, PocketPayResult } from '../types';
import { validateSecretKey, validatePublicKey, validateAmount, validateMemo, wrapError, toResult } from '../utils';
import { withTimeout } from '../network';

/**
 * Sends XLM from one account to another.
 *
 * All inputs are validated before any transaction is built or submitted, so
 * invalid parameters produce a synchronous PocketPayError rather than a late
 * network failure. An unfunded or nonexistent source account is surfaced as a
 * clear ACCOUNT_NOT_FOUND error.
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
  // ─── Preflight validation (before any network call) ─────────────────────────
  validateSecretKey(sourceSecret);
  validatePublicKey(destination);
  validateAmount(amount);
  validateMemo(memo);
  const sourceKeypair = StellarSDK.Keypair.fromSecret(sourceSecret);
  const sourcePublic = sourceKeypair.publicKey();
  if (sourcePublic === destination) {
    throw new PocketPayError('Cannot send XLM to yourself', 'SELF_PAYMENT', {
      validation: {
        field: 'destination',
        reason: 'same_as_source',
        value: destination
      }
    });
  }
  try {
    const cfg = resolveConfig(config);
    const server = getHorizonServer(config);
    const networkPassphrase = getNetworkPassphrase(cfg.network);
    const sourceAccount = await withTimeout(
      'Horizon source account lookup',
      cfg.timeout,
      server.loadAccount(sourcePublic),
    );
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
    const transaction = builder.build();
    transaction.sign(sourceKeypair);
    const result = await withTimeout(
      'Horizon transaction submission',
      cfg.timeout,
      server.submitTransaction(transaction),
    );
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
  } catch (error) {
    if (error instanceof PocketPayError) throw error;
    const horizonError = error as any;
    // Unfunded / nonexistent source account → clear preflight-style error
    if (horizonError?.response?.status === 404) {
      throw new PocketPayError(
        `Source account not found: ${sourcePublic}. It may not be funded yet.`,
        'ACCOUNT_NOT_FOUND',
        404
      );
    }
    // Horizon transaction-failure result codes
    if (horizonError?.response?.data?.extras?.result_codes) {
      const codes = horizonError.response.data.extras.result_codes;
      throw new PocketPayError(
        `Payment failed: tx=${codes.transaction}, ops=${JSON.stringify(codes.operations)}`,
        'PAYMENT_FAILED',
        400
      );
    }
    throw wrapError(error, 'Failed to send XLM', 'SEND_ERROR');
  }
}

// ─── Safe Wrappers ──────────────────────────────────────────────────────────

export async function safeSendXLM(
  params: SendXLMParams,
  config?: Partial<SDKConfig>
): Promise<PocketPayResult<PaymentResult>> {
  return toResult(() => sendXLM(params, config), 'Failed to send XLM', 'SEND_ERROR');
}

