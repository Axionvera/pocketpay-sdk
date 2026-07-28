/**
 * Example: Query a Soroban savings-vault balance (read-only).
 *
 * Usage:
 *   VAULT_CONTRACT_ID=CXXXXX npx tsx examples/vault-balance.ts
 *
 * This is a minimal starting point that shows how to configure the
 * VAULT_CONTRACT_ID, create a funded wallet, and query a read-only
 * vault balance — before attempting deposit or withdraw flows.
 *
 * Requirements:
 *   - A deployed savings vault contract on Stellar Testnet
 *   - The contract ID set via the VAULT_CONTRACT_ID environment variable
 *
 * ⚠️  The vault contract is pre-release and does NOT move real XLM.
 *     See docs/soroban-vault.md for current limitations.
 */

import {
  createWallet,
  fundTestnetAccount,
  getVaultBalance,
  PocketPayError,
} from '../src';

async function main() {
  const contractId = process.env.VAULT_CONTRACT_ID;

  if (!contractId) {
    console.error('❌ VAULT_CONTRACT_ID is not set.');
    console.error('');
    console.error('   Set it to the ID of a deployed savings vault contract:');
    console.error('   VAULT_CONTRACT_ID=CXXXXX npx tsx examples/vault-balance.ts');
    console.error('');
    console.error('   To deploy a vault contract, see:');
    console.error('   https://github.com/Axionvera/pocketpay-contracts');
    process.exit(1);
  }

  // Basic contract ID format check
  if (!contractId.startsWith('C') || contractId.length !== 56) {
    console.error('❌ VAULT_CONTRACT_ID does not look like a valid Soroban contract ID.');
    console.error(`   Expected a 56-character string starting with "C", got "${contractId}"`);
    process.exit(1);
  }

  console.log('🔑 Creating a wallet...');
  const wallet = createWallet();
  console.log(`   Address: ${wallet.publicKey}\n`);

  console.log('💧 Funding wallet on testnet via Friendbot...');
  const fundResult = await fundTestnetAccount(wallet.publicKey);

  if (!fundResult.success) {
    console.error('❌ Funding failed:', fundResult.error);
    process.exit(1);
  }
  console.log('   ✅ Funded\n');

  // Query a read-only vault balance — no deposit needed
  console.log(`💰 Querying vault balance for user...`);

  try {
    const vaultResult = await getVaultBalance({
      publicKey: wallet.publicKey,
      contractId,
    });

    if (vaultResult.success) {
      console.log(`   Vault balance: ${vaultResult.balance} XLM`);
      console.log(`   (This is the available balance; locked funds not shown.)`);
      console.log(`\n   ℹ️  A zero balance is normal — no deposit was made.`);
      console.log(`   See examples/vault-operations.ts for deposit/withdraw flows.`);
    } else {
      console.error(`   ❌ Query failed: ${vaultResult.error}`);
    }
  } catch (error) {
    if (error instanceof PocketPayError) {
      console.error(`\n❌ SDK error [${error.code}]: ${error.message}`);
    } else {
      console.error(`\n❌ Unexpected error:`, error);
    }
    process.exit(1);
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
