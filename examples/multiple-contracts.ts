/**
 * Example: Managing Multiple Contract Instances
 *
 * This example demonstrates how to manage multiple contract clients
 * with different configurations and contract IDs.
 */

import {
  createVaultClient,
  createContractClient,
  createWallet,
  fundTestnetAccount,
} from '../src';

async function main() {
  console.log('=== Multiple Contracts Example ===\n');

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

  // Get contract IDs from environment
  const vaultContractId = process.env.VAULT_CONTRACT_ID;
  const tokenContractId = process.env.TOKEN_CONTRACT_ID;

  if (!vaultContractId || !tokenContractId) {
    console.error('Both VAULT_CONTRACT_ID and TOKEN_CONTRACT_ID environment variables are required');
    return;
  }

  // Create multiple contract clients
  const vault = createVaultClient({
    contractId: vaultContractId,
    config: {
      network: 'testnet',
    },
  });

  const token = createContractClient({
    contractId: tokenContractId,
    config: {
      network: 'testnet',
    },
  });

  console.log('\nCreated contract clients:');
  console.log('- Vault:', vaultContractId);
  console.log('- Token:', tokenContractId);

  // Interact with the vault
  console.log('\n--- Vault Operations ---');
  try {
    const vaultBalance = await vault.getBalance(wallet.publicKey);
    console.log('Vault balance:', vaultBalance, 'XLM');

    const depositResult = await vault.deposit(wallet.secretKey, '5');
    if (depositResult.success) {
      console.log('Vault deposit successful, hash:', depositResult.hash);
    }
  } catch (error) {
    console.error('Vault operation failed:', error);
  }

  // Interact with the token contract
  console.log('\n--- Token Operations ---');
  try {
    const tokenBalance = await token.readOnly<bigint>({
      method: 'balance',
      params: { account: wallet.publicKey },
      paramTypes: { account: 'address' },
      sourcePublicKey: wallet.publicKey,
    });
    console.log('Token balance:', tokenBalance.toString());

    // Example: Transfer tokens
    const transferResult = await token.invoke<void>({
      method: 'transfer',
      params: {
        from: wallet.publicKey,
        to: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        amount: 1000000n,
      },
      paramTypes: {
        from: 'address',
        to: 'address',
        amount: 'i128',
      },
      signWith: wallet.secretKey,
    });

    if (transferResult.success) {
      console.log('Token transfer successful, hash:', transferResult.hash);
    } else {
      console.error('Token transfer failed:', transferResult.error);
    }
  } catch (error) {
    console.error('Token operation failed:', error);
  }

  // Example: Managing contracts on different networks
  console.log('\n--- Cross-Network Example ---');
  const mainnetVault = createVaultClient({
    contractId: process.env.MAINNET_VAULT_CONTRACT_ID || vaultContractId,
    config: {
      network: 'mainnet',
      sorobanRpcUrl: 'https://soroban.stellar.org',
    },
  });

  console.log('Mainnet vault client created for:', mainnetVault.getContractId());

  console.log('\n=== Example Complete ===');
}

main().catch(console.error);
