/**
 * Example: the full wallet lifecycle — create, fund, and check balance.
 *
 * Walks through the three things you do with a brand-new wallet:
 *   1. create a keypair,
 *   2. fund it on Testnet via Friendbot,
 *   3. read its on-chain balance.
 *
 * Run it with:
 *
 *   npm run example:wallet
 *
 * or directly:
 *
 *   npx tsx examples/create-wallet.ts
 *
 * This example is Testnet-only, because Friendbot funding only exists on
 * Testnet. It never prints the secret key — see the note in step 1.
 */

import {
  createWallet,
  fundTestnetAccount,
  getBalanceOrUnfunded,
  resolveConfig,
} from '../src';

async function main(): Promise<void> {
  // Friendbot funding is Testnet-only. Fail early with a clear message instead
  // of letting fundTestnetAccount throw TESTNET_ONLY deeper in the flow.
  const { network } = resolveConfig();
  if (network !== 'testnet') {
    console.error(
      `This example is Testnet-only, but the active network is "${network}".\n` +
        'Set STELLAR_NETWORK=testnet (or unset it) and try again.',
    );
    process.exitCode = 1;
    return;
  }

  // ─── 1. Create a wallet ─────────────────────────────────────────────────
  console.log('Creating a new Stellar wallet...\n');
  const wallet = createWallet();

  // The public key is safe to display and share.
  console.log(`  Public key:  ${wallet.publicKey}`);

  // SECURITY: never log the secret key. createWallet does not persist it
  // anywhere, and it cannot be recovered if lost. Your app (or the user) must
  // save wallet.secretKey to secure storage now. We only confirm it exists.
  console.log('  Secret key:  [hidden — back it up to secure storage now]');
  console.log(
    '\n  Warning: the secret key was NOT saved anywhere by the SDK. ' +
      'Store it securely before continuing; it cannot be recovered if lost.\n',
  );

  // ─── 2. Fund the wallet on Testnet ──────────────────────────────────────
  console.log('Funding the wallet on Testnet via Friendbot...');
  const fundResult = await fundTestnetAccount(wallet.publicKey);

  if (!fundResult.success) {
    console.error('  Funding failed:', fundResult.error);
    process.exitCode = 1;
    return;
  }
  console.log(`  Funded. Transaction hash: ${fundResult.hash}\n`);

  // ─── 3. Check the balance ───────────────────────────────────────────────
  // getBalanceOrUnfunded returns a discriminated union instead of throwing on
  // an unfunded account, so the two cases are handled explicitly.
  console.log('Checking the balance...');
  const result = await getBalanceOrUnfunded(wallet.publicKey);

  if (result.status === 'unfunded') {
    // Rare here since we just funded, but shown for completeness.
    console.log('  Account is not funded yet. Try again in a moment.');
    return;
  }

  console.log(`  XLM balance: ${result.balance.nativeBalance}`);
  console.log('  All balances:');
  for (const asset of result.balance.balances) {
    console.log(`    ${asset.asset}: ${asset.balance}`);
  }

  console.log('\nDone.');
}

main().catch((error) => {
  console.error('Example failed:', error);
  process.exitCode = 1;
});