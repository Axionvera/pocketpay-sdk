/**
 * Example: Create a wallet, fund it, and check its balance.
 *
 * Usage:
 *   npx tsx examples/create-wallet.ts
 */

import { createWallet, fundTestnetAccount, getBalance } from '../src';

async function main() {
  console.log('🔑 Creating a new Stellar wallet...\n');
  const wallet = createWallet();

  console.log(`  Public Key:  ${wallet.publicKey}`);
  console.log(`  Secret Key:  ${wallet.secretKey}`);
  console.log('\n⚠️  Store your secret key securely! Never share it.\n');

  console.log('💧 Funding wallet on testnet via Friendbot...');
  const fundResult = await fundTestnetAccount(wallet.publicKey);

  if (fundResult.success) {
    console.log(`  ✅ Funded! TX Hash: ${fundResult.hash}\n`);
  } else {
    console.error('  ❌ Funding failed:', fundResult.error);
    return;
  }

  console.log('💰 Checking balance...');
  const balance = await getBalance(wallet.publicKey);

  console.log(`  XLM Balance: ${balance.nativeBalance}`);
  console.log(`  All Balances:`);
  for (const b of balance.balances) {
    console.log(`    ${b.asset}: ${b.balance}`);
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
