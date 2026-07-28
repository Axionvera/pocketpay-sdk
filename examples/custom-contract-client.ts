/**
 * Example: Creating a Custom Contract Client
 *
 * This example demonstrates how to extend the ContractClient
 * to create a specialized client for a custom Soroban contract.
 */

import {
  ContractClient,
  ContractClientConfig,
  ContractInvokeResult,
  createContractClient,
} from '../src';

// Custom error mapping for our contract
const CUSTOM_ERROR_MAPPING = {
  'insufficient allowance': 'CUSTOM_INSUFFICIENT_ALLOWANCE',
  'not approved': 'CUSTOM_NOT_APPROVED',
  'invalid recipient': 'CUSTOM_INVALID_RECIPIENT',
};

/**
 * Custom contract client for a hypothetical token contract.
 */
class TokenClient extends ContractClient {
  constructor(config: ContractClientConfig) {
    super(config, CUSTOM_ERROR_MAPPING);
  }

  /**
   * Get the token balance for an account.
   */
  async balanceOf(account: string): Promise<bigint> {
    return this.readOnly<bigint>({
      method: 'balance',
      params: { account },
      paramTypes: { account: 'address' },
      sourcePublicKey: account,
    });
  }

  /**
   * Get the total supply of tokens.
   */
  async totalSupply(): Promise<bigint> {
    // Use a dummy public key for read-only calls that don't require auth
    return this.readOnly<bigint>({
      method: 'total_supply',
      params: {},
      paramTypes: {},
      sourcePublicKey: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    });
  }

  /**
   * Transfer tokens to another account.
   */
  async transfer(
    from: string,
    to: string,
    amount: bigint
  ): Promise<ContractInvokeResult<void>> {
    return this.invoke({
      method: 'transfer',
      params: { from, to, amount },
      paramTypes: { from: 'address', to: 'address', amount: 'i128' },
      signWith: from,
    });
  }

  /**
   * Approve an allowance for a spender.
   */
  async approve(
    owner: string,
    spender: string,
    amount: bigint
  ): Promise<ContractInvokeResult<void>> {
    return this.invoke({
      method: 'approve',
      params: { owner, spender, amount },
      paramTypes: { owner: 'address', spender: 'address', amount: 'i128' },
      signWith: owner,
    });
  }

  /**
   * Get the allowance for a spender.
   */
  async allowance(owner: string, spender: string): Promise<bigint> {
    return this.readOnly<bigint>({
      method: 'allowance',
      params: { owner, spender },
      paramTypes: { owner: 'address', spender: 'address' },
      sourcePublicKey: owner,
    });
  }
}

async function main() {
  console.log('=== Custom Contract Client Example ===\n');

  // Get contract ID from environment
  const contractId = process.env.TOKEN_CONTRACT_ID;
  if (!contractId) {
    console.error('TOKEN_CONTRACT_ID environment variable is required');
    return;
  }

  // Create the custom token client
  const token = new TokenClient({
    contractId,
    config: {
      network: 'testnet',
    },
  });
  console.log('Created Token client for contract:', contractId);

  // Example: Query total supply
  console.log('\nQuerying total supply...');
  try {
    const totalSupply = await token.totalSupply();
    console.log('Total supply:', totalSupply.toString());
  } catch (error) {
    console.error('Failed to query total supply:', error);
  }

  // Example: Query balance (replace with actual public key)
  const examplePublicKey = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  console.log('\nQuerying balance for account:', examplePublicKey);
  try {
    const balance = await token.balanceOf(examplePublicKey);
    console.log('Balance:', balance.toString());
  } catch (error) {
    console.error('Failed to query balance:', error);
  }

  console.log('\n=== Example Complete ===');
}

main().catch(console.error);
