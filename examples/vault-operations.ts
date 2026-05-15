/**
 * Example: Interact with the PocketPay Savings Vault on Soroban.
 *
 * Usage:
 *   VAULT_CONTRACT_ID=CXXXXX npx tsx examples/vault-operations.ts
 *
 * Requirements:
 *   - A deployed savings vault contract on Stellar Testnet
 *   - The contract ID set via environment variable or passed directly
 */

import {
  createWallet,
  fundTestnetAccount,
  depositToVault,
  withdrawFromVault,
  getVaultBalance,
} from '../src';

async function main() {
  const contractId = process.env.VAULT_CONTRACT_ID;

  if (!contractId) {
    console.error('❌ Please set VAULT_CONTRACT_ID environment variable');
    console.error('   Example: VAULT_CONTRACT_ID=CXXXXX npx tsx examples/vault-operations.ts');
    process.exit(1);
  }

  // Create and fund a wallet
  console.log('🔑 Creating wallet...');
  const wallet = createWallet();
  console.log(`  Address: ${wallet.publicKey}\n`);

  console.log('💧 Funding via Friendbot...');
  await fundTestnetAccount(wallet.publicKey);
  console.log('  ✅ Funded\n');

  // Deposit into vault
  const depositAmount = '100';
  console.log(`📥 Depositing ${depositAmount} XLM into vault...`);
  const depositResult = await depositToVault({
    sourceSecret: wallet.secretKey,
    amount: depositAmount,
    contractId,
  });

  if (depositResult.success) {
    console.log(`  ✅ Deposited! Hash: ${depositResult.hash}\n`);
  } else {
    console.error(`  ❌ Deposit failed: ${depositResult.error}\n`);
    return;
  }

  // Check vault balance
  console.log('💰 Checking vault balance...');
  const balanceResult = await getVaultBalance({
    publicKey: wallet.publicKey,
    contractId,
  });

  if (balanceResult.success) {
    console.log(`  Vault Balance: ${balanceResult.balance} XLM\n`);
  }

  // Withdraw from vault
  const withdrawAmount = '50';
  console.log(`📤 Withdrawing ${withdrawAmount} XLM from vault...`);
  const withdrawResult = await withdrawFromVault({
    sourceSecret: wallet.secretKey,
    amount: withdrawAmount,
    contractId,
  });

  if (withdrawResult.success) {
    console.log(`  ✅ Withdrawn! Hash: ${withdrawResult.hash}\n`);
  } else {
    console.error(`  ❌ Withdrawal failed: ${withdrawResult.error}\n`);
  }

  console.log('✅ Done!');
}

main().catch(console.error);
