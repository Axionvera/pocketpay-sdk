/**
 * Example: Send an issued asset (USDC) between two testnet accounts.
 *
 * This example demonstrates the full lifecycle of an issued asset payment:
 *
 *   1. Two Testnet wallets are created — sender and receiver.
 *   2. Both are funded via Friendbot so they exist on-chain.
 *   3. The receiver establishes a trustline for a custom "DEMO" asset.
 *      (On Testnet you can do this offline via the Stellar Laboratory; this
 *      script skips the `ChangeTrust` operation for brevity and instead
 *      calls the trustline preflight helper to show what it reports.)
 *   4. The SDK's pre-flight trustline check (`checkDestinationTrustline`) is
 *      called — this surfaces the `missing_trustline` status before any
 *      payment is attempted.
 *   5. With `skipTrustlineCheck: true` the payment is submitted anyway to show
 *      the Horizon result-code mapping (the transaction will fail on-chain
 *      because the trustline does not exist, which is the expected behaviour).
 *
 * For a real production flow you would first submit a `ChangeTrust`
 * operation on the receiver's account before calling `sendAsset`.
 *
 * Usage:
 *   npx tsx examples/send-asset.ts
 *
 * Network: Required — Testnet Friendbot and Horizon.
 */

import {
  createWallet,
  fundTestnetAccount,
  checkDestinationTrustline,
  sendAsset,
  safeSendAsset,
  PocketPayError,
} from '../src';

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * The issuer address for "DEMO" — in production this would be a real issuer
 * public key that controls the asset. For this example we use a freshly
 * created wallet to represent the issuer.
 */

async function main() {
  console.log('=== PocketPay SDK — Issued Asset Payment Example ===\n');

  // ─── 1. Create wallets ──────────────────────────────────────────────────────
  console.log('🔑 Creating wallets...');
  const sender = createWallet();
  const receiver = createWallet();
  const issuer = createWallet(); // represents the DEMO asset issuer
  console.log(`  Sender:   ${sender.publicKey}`);
  console.log(`  Receiver: ${receiver.publicKey}`);
  console.log(`  Issuer:   ${issuer.publicKey}\n`);

  const demoAsset = { code: 'DEMO', issuer: issuer.publicKey };

  // ─── 2. Fund sender and receiver via Friendbot ──────────────────────────────
  console.log('💧 Funding sender via Friendbot...');
  await fundTestnetAccount(sender.publicKey);
  console.log('  ✅ Sender funded\n');

  console.log('💧 Funding receiver via Friendbot...');
  await fundTestnetAccount(receiver.publicKey);
  console.log('  ✅ Receiver funded\n');

  // ─── 3. Pre-flight trustline check ─────────────────────────────────────────
  // The receiver was just funded but has NOT submitted a ChangeTrust operation
  // for the DEMO asset. The preflight check surfaces this before we attempt to
  // build or sign any transaction.
  console.log('🔍 Running pre-flight trustline check for DEMO asset...');
  const trustlineResult = await checkDestinationTrustline(
    receiver.publicKey,
    demoAsset,
    { amount: '10' },
  );

  if (!trustlineResult.valid) {
    console.log(`  ⚠️  Trustline not ready: ${trustlineResult.status}`);
    console.log(`  Error code: ${trustlineResult.errorCode}`);
    console.log(`  Detail:     ${trustlineResult.message}`);

    switch (trustlineResult.status) {
      case 'missing_trustline':
        console.log('\n  💡 Recovery: The receiver must submit a ChangeTrust operation');
        console.log('     for DEMO:' + demoAsset.issuer + ' before this payment can succeed.');
        break;
      case 'account_not_found':
        console.log('\n  💡 Recovery: Fund the receiver account first via Friendbot.');
        break;
      case 'not_authorized':
        console.log('\n  💡 Recovery: The asset issuer must authorize the trustline.');
        break;
      case 'limit_exceeded':
        console.log(`\n  💡 Recovery: Available capacity is ${trustlineResult.availableCapacity}.`);
        console.log('     Either reduce the payment amount or ask receiver to raise their limit.');
        break;
    }
  } else {
    console.log('  ✅ Trustline is valid — ready to send!\n');
  }
  console.log();

  // ─── 4. Attempt payment with `safeSendAsset` ────────────────────────────────
  // This call will fail on-chain because the trustline has not been
  // established. The safe wrapper returns ok:false rather than throwing.
  console.log('💸 Attempting to send 10 DEMO (expected to fail — no trustline)...');
  const safeResult = await safeSendAsset({
    sourceSecret: sender.secretKey,
    destination: receiver.publicKey,
    amount: '10',
    asset: demoAsset,
    memo: 'PocketPay demo',
  });

  if (safeResult.ok) {
    // This branch would be reached once the trustline is in place
    console.log('  ✅ Payment succeeded!');
    console.log(`  TX Hash: ${safeResult.value.hash}`);
    console.log(`  Ledger:  ${safeResult.value.ledger}`);
    console.log(`  Asset:   ${safeResult.value.asset?.code}:${safeResult.value.asset?.issuer}`);
    console.log(`  Amount:  ${safeResult.value.amount}`);
  } else {
    console.log(`  ⚠️  Payment failed as expected: [${safeResult.error.code}] ${safeResult.error.message}`);
    console.log('  (This is the correct behaviour — no trustline exists yet.)\n');
  }

  // ─── 5. Native XLM via sendAsset (backward-compatible path) ─────────────────
  // sendAsset with code:'XLM' is functionally identical to sendXLM.
  // No trustline check is performed for native XLM.
  console.log('💸 Sending 5 XLM via sendAsset (native asset path)...');
  try {
    const xlmResult = await sendAsset({
      sourceSecret: sender.secretKey,
      destination: receiver.publicKey,
      amount: '5',
      asset: { code: 'XLM' },
      memo: 'native via sendAsset',
    });
    console.log('  ✅ XLM payment succeeded!');
    console.log(`  TX Hash: ${xlmResult.hash}`);
    console.log(`  Asset:   ${xlmResult.asset?.code} (native)`);
    console.log(`  Amount:  ${xlmResult.amount} XLM\n`);
  } catch (error) {
    if (error instanceof PocketPayError) {
      console.error(`  ✗ PocketPayError [${error.code}]: ${error.message}`);
    } else {
      throw error;
    }
  }

  console.log('✅ Example complete.\n');
  console.log('Next steps to make a real issued-asset payment:');
  console.log('  1. Submit a ChangeTrust operation on the receiver account.');
  console.log('  2. (If issuer requires auth) Have the issuer authorize the trustline.');
  console.log('  3. Call sendAsset — the pre-flight check will now pass.');
  console.log('  See docs/issued-asset-payments.md for the full guide.\n');
}

main().catch(console.error);
