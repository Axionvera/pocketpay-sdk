/**
 * Example: Using the VaultClient Factory
 *
 * This example demonstrates how to use the specialized VaultClient
 * for interacting with the PocketPay Savings Vault contract.
 */

import {
  createVaultClient,
  createWallet,
  fundTestnetAccount,
} from '../src';

async function main() {
  console.log('=== Vault Client Factory Example ===\n');

  // Create a wallet
  const wallet = createWallet();
  console.log('Created wallet:', wallet.publicKey);

  // Fund the wallet on testnet
  console.log('\nFunding wallet on testnet...');
  const fundResult = await fundTestnetAccount(wallet.publicKey);
  if (fundResult.success) {
    console.log('Wallet funded successfully');
  } else {
    console.error('Failed to fund wallet:', fundResult.error);
    return;
  }

  // Get the vault contract ID from environment
  const contractId = process.env.VAULT_CONTRACT_ID;
  if (!contractId) {
    console.error('VAULT_CONTRACT_ID environment variable is required');
    return;
  }

  // Create the Vault client
  const vault = createVaultClient({
    contractId,
    config: {
      network: 'testnet',
    },
  });
  console.log('\nCreated Vault client for contract:', contractId);

  // Check initial balance
  console.log('\nChecking initial balance...');
  const initialBalance = await vault.getBalance(wallet.publicKey);
  console.log('Initial balance:', initialBalance, 'XLM');

  // Deposit XLM to the vault
  console.log('\nDepositing 10 XLM to vault...');
  const depositResult = await vault.deposit(wallet.secretKey, '10');
  if (depositResult.success) {
    console.log('Deposit successful!');
    console.log('Transaction hash:', depositResult.hash);
  } else {
    console.error('Deposit failed:', depositResult.error);
    return;
  }

  // Check balance after deposit
  console.log('\nChecking balance after deposit...');
  const balanceAfterDeposit = await vault.getBalance(wallet.publicKey);
  console.log('Balance after deposit:', balanceAfterDeposit, 'XLM');

  // Withdraw XLM from the vault
  console.log('\nWithdrawing 5 XLM from vault...');
  const withdrawResult = await vault.withdraw(wallet.secretKey, '5');
  if (withdrawResult.success) {
    console.log('Withdrawal successful!');
    console.log('Transaction hash:', withdrawResult.hash);
  } else {
    console.error('Withdrawal failed:', withdrawResult.error);
    return;
  }

  // Check final balance
  console.log('\nChecking final balance...');
  const finalBalance = await vault.getBalance(wallet.publicKey);
  console.log('Final balance:', finalBalance, 'XLM');

  console.log('\n=== Example Complete ===');
}

main().catch(console.error);
