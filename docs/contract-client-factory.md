# Contract Client Factory

The PocketPay SDK provides a reusable factory for creating typed contract clients for Soroban smart contracts. This factory eliminates code duplication when interacting with multiple contracts and provides a consistent interface for read-only and state-changing operations.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Basic Usage](#basic-usage)
- [Generic Contract Client](#generic-contract-client)
- [Specialized Vault Client](#specialized-vault-client)
- [Type System](#type-system)
- [Error Handling](#error-handling)
- [Advanced Usage](#advanced-usage)
- [Migration Guide](#migration-guide)

---

## Overview

The contract client factory provides:

- **Typed contract interactions** with parameter encoding and result parsing
- **Separation of read-only and state-changing calls** for clear intent
- **Consistent error mapping** from contract errors to SDK error codes
- **Reusable factory pattern** to avoid code duplication
- **Specialized clients** for common contract patterns (e.g., Vault)

---

## Key Features

### Read-Only Calls

Read-only calls use transaction simulation to query contract state without signing or submitting to the network. These operations cost no fees and return immediately.

```typescript
const balance = await client.readOnly<bigint>({
  method: 'get_balance',
  params: { user: publicKey },
  paramTypes: { user: 'address' },
  sourcePublicKey: publicKey,
});
```

### State-Changing Calls

State-changing calls build, simulate, sign, and submit transactions to the network. The SDK automatically polls for transaction completion.

```typescript
const result = await client.invoke<void>({
  method: 'deposit',
  params: { user: publicKey, amount: 10000000 },
  paramTypes: { user: 'address', amount: 'i128' },
  signWith: secretKey,
});
```

### Typed Contract IDs

Contract IDs are validated at initialization using the existing `validateContractId` function, ensuring they are properly formatted 56-character base32 strings starting with 'C'.

### Error Mapping

Contract-specific errors can be mapped to SDK error codes for consistent error handling across different contracts.

---

## Basic Usage

### Creating a Generic Contract Client

```typescript
import { createContractClient } from 'stellar-pocketpay-sdk';

const client = createContractClient({
  contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
  config: {
    network: 'testnet',
    sorobanRpcUrl: 'https://soroban-testnet.stellar.org',
  },
});
```

### Using the Vault Client (Specialized)

```typescript
import { createVaultClient } from 'stellar-pocketpay-sdk';

const vaultClient = createVaultClient({
  contractId: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
});

// Deposit
const depositResult = await vaultClient.deposit(wallet.secretKey, '100');

// Withdraw
const withdrawResult = await vaultClient.withdraw(wallet.secretKey, '50');

// Get balance
const balance = await vaultClient.getBalance(wallet.publicKey);
```

---

## Generic Contract Client

The generic `ContractClient` provides a flexible interface for interacting with any Soroban contract.

### Read-Only Operations

```typescript
const client = createContractClient({
  contractId: 'C...',
});

// Query contract state
const value = await client.readOnly<bigint>({
  method: 'get_value',
  params: { key: 'my_key' },
  paramTypes: { key: 'string' },
  sourcePublicKey: wallet.publicKey,
});

console.log('Contract value:', value.toString());
```

### State-Changing Operations

```typescript
// Modify contract state
const result = await client.invoke<void>({
  method: 'set_value',
  params: { key: 'my_key', value: 42 },
  paramTypes: { key: 'string', value: 'u64' },
  signWith: wallet.secretKey,
});

if (result.success) {
  console.log('Transaction hash:', result.hash);
} else {
  console.error('Transaction failed:', result.error);
}
```

### Custom Result Parsing

```typescript
const result = await client.invoke<MyCustomType>({
  method: 'complex_operation',
  params: { input: 'data' },
  paramTypes: { input: 'bytes' },
  signWith: wallet.secretKey,
  resultParser: (scVal) => {
    // Custom parsing logic
    return parseCustomScVal(scVal);
  },
});
```

---

## Specialized Vault Client

The `VaultClient` extends the generic client with vault-specific methods and built-in parameter encoding.

### Vault-Specific Methods

```typescript
import { createVaultClient, VaultClient } from 'stellar-pocketpay-sdk';

const vault = createVaultClient({
  contractId: 'C...',
});

// Deposit XLM (amount in XLM, converted to stroops internally)
const depositResult = await vault.deposit(
  wallet.secretKey,  // signer
  '100'             // amount in XLM
);

// Withdraw XLM
const withdrawResult = await vault.withdraw(
  wallet.secretKey,
  '50'
);

// Get available balance (returns XLM string)
const balance = await vault.getBalance(wallet.publicKey);
console.log('Balance:', balance, 'XLM');
```

### Vault Error Mapping

The VaultClient includes built-in error mapping for common vault errors:

| Contract Error | SDK Error Code |
| -------------- | -------------- |
| `insufficient balance` | `VAULT_INSUFFICIENT_BALANCE` |
| `unauthorized` | `VAULT_UNAUTHORIZED` |
| `invalid amount` | `VAULT_INVALID_AMOUNT` |

---

## Type System

### ScValType

Supported Soroban ScVal types for parameter encoding:

```typescript
type ScValType = 
  | 'address'    // Stellar public key
  | 'bool'       // Boolean
  | 'i128'       // 128-bit signed integer
  | 'i256'       // 256-bit signed integer
  | 'i64'        // 64-bit signed integer
  | 'i32'        // 32-bit signed integer
  | 'u128'       // 128-bit unsigned integer
  | 'u256'       // 256-bit unsigned integer
  | 'u64'        // 64-bit unsigned integer
  | 'u32'        // 32-bit unsigned integer
  | 'bytes'      // Byte array
  | 'string'     // String
  | 'symbol'     // Symbol
  | 'vec'        // Vector/array
  | 'map'        // Map/dictionary
  | 'option'     // Optional value
  | 'void';      // No value
```

### ParamTypes

Parameter type mapping for contract methods:

```typescript
interface ParamTypes {
  [paramName: string]: ScValType;
}

// Example
const paramTypes: ParamTypes = {
  user: 'address',
  amount: 'i128',
  timestamp: 'u64',
};
```

### ContractInvokeResult

Result type for state-changing operations:

```typescript
interface ContractInvokeResult<T = unknown> {
  success: boolean;      // Whether the invocation succeeded
  hash?: string;         // Transaction hash (if submitted)
  value?: T;             // Parsed return value
  error?: string;        // Error message if failed
}
```

---

## Error Handling

### Generic Error Mapping

Map contract-specific errors to SDK error codes:

```typescript
const errorMapping = {
  'insufficient funds': 'CONTRACT_INSUFFICIENT_FUNDS',
  'unauthorized access': 'CONTRACT_UNAUTHORIZED',
  'invalid parameter': 'CONTRACT_INVALID_PARAM',
};

const client = createContractClient(
  { contractId: 'C...' },
  errorMapping
);
```

### Error Handling Pattern

```typescript
try {
  const result = await client.invoke({
    method: 'my_method',
    params: { /* ... */ },
    paramTypes: { /* ... */ },
    signWith: secretKey,
  });

  if (!result.success) {
    // Handle expected on-chain failures
    console.error('Contract call failed:', result.error);
  }
} catch (error) {
  if (error instanceof PocketPayError) {
    // Handle SDK errors (validation, network, etc.)
    console.error('SDK error:', error.code, error.message);
  } else {
    // Handle unexpected errors
    console.error('Unexpected error:', error);
  }
}
```

---

## Advanced Usage

### Custom Contract Client

Extend the base `ContractClient` for contract-specific functionality:

```typescript
import { ContractClient, ContractClientConfig } from 'stellar-pocketpay-sdk';

class MyCustomClient extends ContractClient {
  constructor(config: ContractClientConfig) {
    const errorMapping = {
      'custom error': 'CUSTOM_ERROR_CODE',
    };
    super(config, errorMapping);
  }

  async customMethod(user: string, data: string): Promise<ContractInvokeResult<void>> {
    return this.invoke({
      method: 'custom_method',
      params: { user, data },
      paramTypes: { user: 'address', data: 'string' },
      signWith: user,
    });
  }

  async getCustomData(user: string): Promise<string> {
    return this.readOnly<string>({
      method: 'get_custom_data',
      params: { user },
      paramTypes: { user: 'address' },
      sourcePublicKey: user,
    });
  }
}

const customClient = new MyCustomClient({
  contractId: 'C...',
});
```

### Multiple Contract Instances

Manage multiple contracts with different configurations:

```typescript
const vaultClient = createVaultClient({
  contractId: 'C...vault...',
  config: { network: 'testnet' },
});

const tokenClient = createContractClient({
  contractId: 'C...token...',
  config: { network: 'mainnet' },
});

// Use each client independently
const vaultBalance = await vaultClient.getBalance(publicKey);
const tokenBalance = await tokenClient.readOnly<bigint>({
  method: 'balance',
  params: { account: publicKey },
  paramTypes: { account: 'address' },
  sourcePublicKey: publicKey,
});
```

---

## Migration Guide

### From Existing Vault Functions

The SDK's existing vault functions (`depositToVault`, `withdrawFromVault`, `getVaultBalance`) are still available and unchanged. The contract client factory provides an alternative pattern for new code or when you need more flexibility.

**Old pattern:**

```typescript
import { depositToVault, getVaultBalance } from 'stellar-pocketpay-sdk';

const depositResult = await depositToVault({
  sourceSecret: wallet.secretKey,
  amount: '100',
  contractId: 'C...',
});

const balanceResult = await getVaultBalance({
  publicKey: wallet.publicKey,
  contractId: 'C...',
});
```

**New pattern with factory:**

```typescript
import { createVaultClient } from 'stellar-pocketpay-sdk';

const vault = createVaultClient({ contractId: 'C...' });

const depositResult = await vault.deposit(wallet.secretKey, '100');
const balance = await vault.getBalance(wallet.publicKey);
```

### Benefits of Migration

- **Type safety**: Contract methods are typed with parameter specifications
- **Reusability**: Client instance can be reused for multiple calls
- **Extensibility**: Easy to extend with custom methods
- **Consistency**: Same pattern works for any Soroban contract

---

## Best Practices

1. **Reuse client instances**: Create a client once and reuse it for multiple calls
2. **Use specialized clients when available**: The VaultClient provides vault-specific conveniences
3. **Handle both success and error cases**: Check `result.success` for on-chain failures
4. **Validate parameters**: The SDK validates contract IDs and parameter types
5. **Use appropriate ScVal types**: Match the contract's parameter types exactly
6. **Implement error mapping**: Map contract-specific errors for better error handling

---

## Examples

See the `examples/` directory for complete runnable examples:

- `examples/vault-client-factory.ts` - Using the VaultClient
- `examples/custom-contract-client.ts` - Creating a custom contract client
- `examples/multiple-contracts.ts` - Managing multiple contract instances

---

## API Reference

### Functions

- `createContractClient(config, errorMapping?)` - Creates a generic contract client
- `createVaultClient(config)` - Creates a specialized Vault client

### Classes

- `ContractClient` - Generic contract client with read-only and invoke methods
- `VaultClient` - Specialized client for Savings Vault contract

### Types

- `ContractClientConfig` - Configuration for contract clients
- `ContractInvokeResult<T>` - Result of state-changing operations
- `ReadOnlyCallOptions<TParams>` - Options for read-only calls
- `InvokeCallOptions<TParams>` - Options for state-changing calls
- `ParamTypes` - Parameter type mapping
- `ScValType` - Supported Soroban ScVal types
- `ErrorMapping` - Contract error to SDK error code mapping
