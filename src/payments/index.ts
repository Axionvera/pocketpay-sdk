/**
 * Stellar PocketPay SDK — Payments Module
 *
 * Send XLM payments on the Stellar network.
 */
import * as StellarSDK from '@stellar/stellar-sdk';
import { getHorizonServer, getNetworkPassphrase, resolveConfig } from '../config';
import { SendXLMParams, PaymentResult, PocketPayError, SDKConfig, PocketPayResult, EnhancedPocketPayResult } from '../types';
import { validateSecretKey, validatePublicKey, validateAmount, validateMemo, wrapError, toResult, toEnhancedSuccessResult, toEnhancedFailureResult, toEnhancedResult } from '../utils';
import type { ResultWarning, RecoveryHint } from '../errors';
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
    transaction = builder.build();
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
      // Only include transaction result code, not operation details (may contain sensitive data)
      throw new PocketPayError(
        `Payment failed with transaction result code: ${codes.transaction}`,
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

/**
 * Sends XLM with an enriched result containing warnings and recovery hints.
 *
 * This is a pilot of the enhanced result pattern. It wraps {@link sendXLM}
 * and returns an {@link EnhancedPocketPayResult} that may include:
 * - **Warnings** when the operation succeeds but with caveats (e.g. high fee
 *   relative to amount).
 * - **Recovery hints** on failure to guide the consumer toward a fix (e.g.
 *   "fund_account" when the source account doesn't exist).
 *
 * @param params - Payment parameters (sourceSecret, destination, amount, memo?)
 * @param config - Optional SDK config overrides
 * @returns An enriched result with optional warnings and recovery hints
 */
export async function enhancedSendXLM(
  params: SendXLMParams,
  config?: Partial<SDKConfig>,
): Promise<EnhancedPocketPayResult<PaymentResult>> {
  const { amount } = params;
  const warnings: ResultWarning[] = [];
  const recoveryHints: RecoveryHint[] = [];

  try {
    const result = await sendXLM(params, config);

    const feeNum = parseFloat(result.fee);
    const amountNum = parseFloat(amount);
    if (amountNum > 0 && feeNum / amountNum > 0.1) {
      warnings.push({
        code: 'HIGH_FEE_RATIO',
        message: `Transaction fee (${result.fee} stroops) is more than 10% of the payment amount.`,
      });
    }

    return toEnhancedSuccessResult(result, warnings, recoveryHints);
  } catch (error) {
    const pocketErr =
      error instanceof PocketPayError
        ? error
        : wrapError(error, 'Failed to send XLM', 'SEND_ERROR');

    if (pocketErr.code === 'ACCOUNT_NOT_FOUND') {
      recoveryHints.push({
        action: 'fund_account',
        message: 'Fund the source account with XLM before sending a payment.',
        retryable: false,
      });
    }

    if (pocketErr.code === 'PAYMENT_FAILED') {
      recoveryHints.push({
        action: 'check_input',
        message: 'Verify that the destination account exists and the amount is within your available balance.',
        retryable: false,
      });
    }

    if (pocketErr.code === 'REQUEST_TIMEOUT' || pocketErr.code === 'SEND_ERROR') {
      recoveryHints.push({
        action: 'retry',
        message: 'The network may be temporarily unavailable. Try again in a few seconds.',
        retryable: true,
        suggestedDelayMs: 3000,
      });
    }

    if (pocketErr.validation) {
      recoveryHints.push({
        action: 'check_input',
        message: `Fix the ${pocketErr.validation.field} field: ${pocketErr.validation.reason}.`,
        retryable: false,
      });
    }

    return toEnhancedFailureResult(pocketErr, warnings, recoveryHints);
  }
}

/**
 * Non-throwing wrapper for {@link enhancedSendXLM}.
 *
 * @param params - Payment parameters
 * @param config - Optional SDK config overrides
 * @returns An enriched result that never throws
 */
export async function safeEnhancedSendXLM(
  params: SendXLMParams,
  config?: Partial<SDKConfig>,
): Promise<EnhancedPocketPayResult<PaymentResult>> {
  return toEnhancedResult(() => sendXLM(params, config), {
    errorContext: 'Failed to send XLM',
    errorCode: 'SEND_ERROR',
  });
}

