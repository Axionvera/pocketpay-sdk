/**
 * End-to-end PocketPay SDK application integration blueprint.
 *
 * Demonstrates:
 * - early configuration validation;
 * - opt-in redacted diagnostics;
 * - wallet creation and secure-storage boundaries;
 * - account signing capability;
 * - balance and transaction-history reads;
 * - payment preview, confirmation, submission, and recovery;
 * - optional Soroban vault deposit, balance, and withdrawal flows.
 *
 * Run from the repository root:
 *
 *   STELLAR_NETWORK=testnet npx tsx examples/app-integration-blueprint.ts
 *
 * Optional vault demo:
 *
 *   STELLAR_NETWORK=testnet \
 *   VAULT_CONTRACT_ID=C... \
 *   RUN_VAULT_DEMO=true \
 *   npx tsx examples/app-integration-blueprint.ts
 *
 * Published applications should import the same names from
 * "stellar-pocketpay-sdk". This repository example imports from "../src" so it
 * can run directly against the current checkout.
 *
 * Security:
 * - This example never prints a secret key.
 * - DemoSecretStore keeps a secret in process memory only. Replace it with an
 *   OS keychain, Android Keystore, HSM, or another reviewed encrypted store.
 * - The current savings-vault contract is bookkeeping only and does not move
 *   real XLM into contract custody.
 */

import {
  buildDiagnosticsReport,
  canSignTransaction,
  createLocalAccount,
  createWallet,
  describeError,
  describeVaultReadiness,
  disableDiagnostics,
  enableDiagnostics,
  enhancedSendXLM,
  fundTestnetAccount,
  getBalanceOrUnfunded,
  getPayments,
  getTransactions,
  getVaultBalance,
  depositToVault,
  previewPayment,
  redactError,
  validatePocketPayConfig,
  withdrawFromVault,
  type DiagnosticsEvent,
  type SDKConfig,
  type WalletKeypair,
} from '../src';

interface SecretStore {
  saveWalletSecret(publicKey: string, secretKey: string): Promise<void>;
  loadWalletSecret(publicKey: string): Promise<string | null>;
  deleteWalletSecret(publicKey: string): Promise<void>;
}

/**
 * Demonstration-only storage.
 *
 * Do not copy this implementation into a production mobile or web app. It
 * deliberately keeps values only in memory so the example remains runnable
 * without adding a platform-specific storage dependency.
 */
class DemoSecretStore implements SecretStore {
  private readonly secrets = new Map<string, string>();

  async saveWalletSecret(publicKey: string, secretKey: string): Promise<void> {
    this.secrets.set(publicKey, secretKey);
  }

  async loadWalletSecret(publicKey: string): Promise<string | null> {
    return this.secrets.get(publicKey) ?? null;
  }

  async deleteWalletSecret(publicKey: string): Promise<void> {
    this.secrets.delete(publicKey);
  }
}

const sdkConfig = {
  network: 'testnet',
  timeout: 30_000,
} satisfies Partial<SDKConfig>;

const secretStore: SecretStore = new DemoSecretStore();
const diagnosticEvents: DiagnosticsEvent[] = [];

function validateConfiguration(): void {
  const validation = validatePocketPayConfig(sdkConfig);

  for (const warning of validation.warnings) {
    console.warn(
      `[config warning] ${warning.field} ${warning.code}: ${warning.message}`,
    );
  }

  if (!validation.valid) {
    for (const error of validation.errors) {
      console.error(
        `[config error] ${error.field} ${error.code}: ${error.message}`,
      );
    }

    throw new Error('PocketPay configuration validation failed');
  }

  if (validation.config?.network !== 'testnet') {
    throw new Error(
      'This runnable example is Testnet-only. Set STELLAR_NETWORK=testnet.',
    );
  }
}

function enableSafeDiagnostics(): void {
  enableDiagnostics({
    hooks: {
      onEvent: (event) => {
        diagnosticEvents.push(event);

        // Event data has already passed through SDK redaction. Production apps
        // should still send it only to an access-controlled log pipeline.
        console.debug(
          `[diagnostic] ${event.domain}:${event.type}`,
          event.data,
        );
      },
    },
  });
}

async function createAndFundWallet(label: string): Promise<WalletKeypair> {
  const wallet = createWallet();

  // Save immediately. The SDK does not persist or recover this secret.
  await secretStore.saveWalletSecret(wallet.publicKey, wallet.secretKey);

  console.log(`${label} public key: ${wallet.publicKey}`);
  console.log(`${label} secret stored: yes (value not printed)`);

  const funding = await fundTestnetAccount(wallet.publicKey, sdkConfig);
  if (!funding.success) {
    throw new Error(funding.error ?? `${label} Friendbot funding failed`);
  }

  console.log(
    `${label} funded${funding.hash ? `; transaction ${funding.hash}` : ''}`,
  );

  return wallet;
}

async function showAccountState(publicKey: string): Promise<void> {
  const balance = await getBalanceOrUnfunded(publicKey, sdkConfig);

  if (balance.status === 'unfunded') {
    console.log('Account is not active on-chain yet.');
    return;
  }

  console.log(`Native balance: ${balance.balance.nativeBalance} XLM`);

  const [transactions, payments] = await Promise.all([
    getTransactions(publicKey, { limit: 10, order: 'desc' }, sdkConfig),
    getPayments(publicKey, { limit: 10, order: 'desc' }, sdkConfig),
  ]);

  console.log(
    `History: ${transactions.count} transaction(s), ${payments.count} payment(s)`,
  );

  for (const transaction of transactions.records) {
    console.log(
      `- transaction ${transaction.hash ?? 'unknown'} ` +
        `successful=${String(transaction.successful)}`,
    );
  }
}

async function runPaymentFlow(
  senderPublicKey: string,
  receiverPublicKey: string,
): Promise<string | null> {
  const senderSecret = await secretStore.loadWalletSecret(senderPublicKey);
  if (!senderSecret) {
    throw new Error('Sender signing secret is unavailable');
  }

  const account = createLocalAccount(senderSecret);
  if (!canSignTransaction(account)) {
    throw new Error('Sender account is read-only');
  }

  console.log(`Signing capability available for ${account.publicKey}`);

  const amount = '5';
  const memo = { type: 'text', value: 'Blueprint demo' } as const;

  const preview = await previewPayment(
    {
      sourceAccount: account.publicKey,
      destination: receiverPublicKey,
      amount,
      asset: { code: 'XLM' },
      memo,
    },
    sdkConfig,
  );

  // A real app must show this information and obtain explicit user
  // confirmation before loading the secret and submitting.
  console.log('Payment preview:', {
    sourceAccount: preview.sourceAccount,
    destination: preview.destination,
    amount: preview.amount,
    asset: preview.asset.code,
    memoType: preview.memoType,
    network: preview.network,
    estimatedFee: preview.estimatedFee,
  });

  const result = await enhancedSendXLM(
    {
      sourceSecret: senderSecret,
      destination: receiverPublicKey,
      amount,
      memo,
    },
    sdkConfig,
  );

  if (!result.ok) {
    const description = describeError(result.error.code);
    const safe = redactError(result.error);

    console.error('Payment failed:', {
      code: safe.code,
      category: safe.category,
      retryable: safe.retryable,
      safeMessage: description.safeMessage,
      transactionHash: safe.transactionHash,
    });

    for (const hint of result.recoveryHints ?? []) {
      console.error(
        `Recovery: ${hint.action} - ${hint.message}` +
          (hint.suggestedDelayMs
            ? ` (suggested delay ${hint.suggestedDelayMs}ms)`
            : ''),
      );
    }

    if (result.error.code === 'TX_STATUS_UNKNOWN') {
      console.error(
        'Do not send again yet. Resolve the existing transaction status first.',
      );
    }

    return safe.transactionHash ?? null;
  }

  for (const warning of result.warnings ?? []) {
    console.warn(`Payment warning ${warning.code}: ${warning.message}`);
  }

  console.log('Payment confirmed:', {
    transactionHash: result.value.hash,
    ledger: result.value.ledger,
    amount: result.value.amount,
    fee: result.value.fee,
  });

  return result.value.hash;
}

async function runOptionalVaultFlow(publicKey: string): Promise<void> {
  const contractId = process.env.VAULT_CONTRACT_ID;
  const runVaultDemo = process.env.RUN_VAULT_DEMO === 'true';

  const readiness = describeVaultReadiness();
  console.log(
    'Vault action readiness:',
    readiness.map(({ kind, supported }) => ({ kind, supported })),
  );

  if (!runVaultDemo) {
    console.log(
      'Vault demo skipped. Set RUN_VAULT_DEMO=true and VAULT_CONTRACT_ID=C... to run it.',
    );
    return;
  }

  if (!contractId) {
    throw new Error(
      'RUN_VAULT_DEMO=true requires a trusted VAULT_CONTRACT_ID.',
    );
  }

  const sourceSecret = await secretStore.loadWalletSecret(publicKey);
  if (!sourceSecret) {
    throw new Error('Vault signing secret is unavailable');
  }

  console.warn(
    'Vault limitation: current deposit/withdraw helpers update contract ' +
      'bookkeeping and do not move real XLM into or out of contract custody.',
  );

  const deposit = await depositToVault(
    {
      sourceSecret,
      amount: '1',
      contractId,
    },
    sdkConfig,
  );

  if (!deposit.success) {
    console.error(
      `Vault deposit returned failure: ${deposit.error ?? 'unknown error'}`,
    );
    return;
  }

  console.log(`Vault deposit submitted: ${deposit.hash ?? 'hash unavailable'}`);

  const balance = await getVaultBalance(
    {
      publicKey,
      contractId,
    },
    sdkConfig,
  );

  if (!balance.success) {
    console.error(
      `Vault balance returned failure: ${balance.error ?? 'unknown error'}`,
    );
    return;
  }

  console.log(`Vault bookkeeping balance: ${balance.balance ?? '0.0000000'}`);

  const withdrawal = await withdrawFromVault(
    {
      sourceSecret,
      amount: '1',
      contractId,
    },
    sdkConfig,
  );

  if (!withdrawal.success) {
    console.error(
      `Vault withdrawal returned failure: ${withdrawal.error ?? 'unknown error'}`,
    );
    return;
  }

  console.log(
    `Vault withdrawal submitted: ${withdrawal.hash ?? 'hash unavailable'}`,
  );
}

async function main(): Promise<void> {
  validateConfiguration();
  enableSafeDiagnostics();

  let senderPublicKey: string | null = null;
  let receiverPublicKey: string | null = null;

  try {
    const sender = await createAndFundWallet('Sender');
    senderPublicKey = sender.publicKey;

    const receiver = await createAndFundWallet('Receiver');
    receiverPublicKey = receiver.publicKey;

    await showAccountState(sender.publicKey);

    const transactionHash = await runPaymentFlow(
      sender.publicKey,
      receiver.publicKey,
    );

    if (transactionHash) {
      console.log(`Reconciliation key: ${transactionHash}`);
    }

    await showAccountState(sender.publicKey);
    await showAccountState(receiver.publicKey);
    await runOptionalVaultFlow(sender.publicKey);

    const report = buildDiagnosticsReport(sdkConfig);
    console.log('Support-safe diagnostics summary:', {
      generatedAt: report.generatedAt,
      sdkName: report.sdkName,
      sdkVersion: report.sdkVersion,
      diagnosticsEnabled: report.diagnosticsEnabled,
      network: report.config.network,
      vaultReady: report.vault.ready,
      capturedEventCount: diagnosticEvents.length,
    });
  } catch (error) {
    const safe = redactError(error);
    console.error('Application flow failed:', {
      code: safe.code,
      category: safe.category,
      safeMessage: safe.safeMessage,
      transactionHash: safe.transactionHash,
    });

    process.exitCode = 1;
  } finally {
    disableDiagnostics();

    // Demo cleanup. A real app normally retains the encrypted wallet secret
    // until the user explicitly removes the wallet.
    if (senderPublicKey) {
      await secretStore.deleteWalletSecret(senderPublicKey);
    }
    if (receiverPublicKey) {
      await secretStore.deleteWalletSecret(receiverPublicKey);
    }
  }
}

void main();
