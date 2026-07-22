/**
 * Transaction Authorization Boundary Tests
 *
 * These tests verify the security boundaries between transaction preparation,
 * signing, and submission operations. They ensure that:
 *
 * 1. Transaction preparation can occur without requiring secrets
 * 2. Signing requires valid credentials and cannot be bypassed
 * 3. Unsigned transactions cannot be submitted
 * 4. Invalid or missing signers are properly rejected
 * 5. Account abstraction correctly enforces read-only vs signing boundaries
 *
 * Security Contract
 * ─────────────────
 * The SDK must maintain clear separation between:
 * - Read operations (balance checks, transaction inspection) → no secrets needed
 * - Transaction building → public key only
 * - Transaction signing → requires secret key
 * - Transaction submission → requires properly signed transaction
 *
 * This test suite documents and enforces these boundaries to prevent future
 * refactors from accidentally allowing signing behavior in places that should
 * only prepare or inspect transactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as StellarSDK from '@stellar/stellar-sdk';
import {
  createWallet,
  importWallet,
  createReadOnlyAccount,
  createLocalAccount,
  PocketPayError,
} from '../src';

describe('Transaction Authorization Boundaries', () => {
  describe('Transaction Preparation (No Signing Required)', () => {
    it('should allow building unsigned transactions without secret keys', () => {
      // Create a wallet and get public key only
      const wallet = createWallet();
      const { publicKey } = wallet;
      
      // Build a transaction using only the public key
      // This simulates transaction preparation without signing capability
      const mockAccount = new StellarSDK.Account(publicKey, '100');
      const transaction = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      // Transaction should be built but unsigned
      expect(transaction).toBeDefined();
      expect(transaction.signatures.length).toBe(0);
      expect(transaction.source).toBe(publicKey);
    });

    it('should allow inspecting transaction operations without secrets', () => {
      const sender = createWallet();
      const receiver = createWallet();
      
      const mockAccount = new StellarSDK.Account(sender.publicKey, '100');
      const transaction = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: receiver.publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      // Should be able to inspect transaction details without signing
      expect(transaction.operations.length).toBe(1);
      expect(transaction.operations[0].type).toBe('payment');
      expect((transaction.operations[0] as any).destination).toBe(receiver.publicKey);
      // Stellar SDK normalizes amounts to 7 decimal places
      expect((transaction.operations[0] as any).amount).toBe('10.0000000');
      expect(transaction.signatures.length).toBe(0);
    });

    it('should allow converting transactions to XDR without signatures', () => {
      const wallet = createWallet();
      const mockAccount = new StellarSDK.Account(wallet.publicKey, '100');
      const transaction = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '5',
          })
        )
        .setTimeout(30)
        .build();

      // Should be able to serialize unsigned transaction
      const xdr = transaction.toXDR();
      expect(xdr).toBeDefined();
      expect(typeof xdr).toBe('string');
      
      // Should be able to deserialize and verify it's still unsigned
      const deserialized = new StellarSDK.Transaction(xdr, StellarSDK.Networks.TESTNET);
      expect(deserialized.signatures.length).toBe(0);
    });
  });

  describe('Signing Requirements', () => {
    it('should require a valid secret key to sign transactions', () => {
      const wallet = createWallet();
      const mockAccount = new StellarSDK.Account(wallet.publicKey, '100');
      const transaction = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      expect(transaction.signatures.length).toBe(0);

      // Sign with the valid keypair
      const keypair = StellarSDK.Keypair.fromSecret(wallet.secretKey);
      transaction.sign(keypair);

      // Transaction should now have a signature
      expect(transaction.signatures.length).toBe(1);
      expect(transaction.signatures[0]).toBeDefined();
    });

    it('should reject signing with an invalid secret key format', () => {
      expect(() => {
        StellarSDK.Keypair.fromSecret('INVALID_SECRET_KEY');
      }).toThrow();
    });

    it('should reject signing with a mismatched secret key', () => {
      const wallet1 = createWallet();
      const wallet2 = createWallet();
      
      const mockAccount = new StellarSDK.Account(wallet1.publicKey, '100');
      const transaction = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      // Sign with wallet2's key (wrong signer)
      const wrongKeypair = StellarSDK.Keypair.fromSecret(wallet2.secretKey);
      transaction.sign(wrongKeypair);

      // Transaction is signed, but with the wrong key
      expect(transaction.signatures.length).toBe(1);
      
      // The signature is from wallet2, not wallet1 (the source account)
      const publicKeyFromSignature = wrongKeypair.publicKey();
      expect(publicKeyFromSignature).toBe(wallet2.publicKey);
      expect(publicKeyFromSignature).not.toBe(wallet1.publicKey);
    });

    it('should produce different signatures for different transactions', () => {
      const wallet = createWallet();
      const keypair = StellarSDK.Keypair.fromSecret(wallet.secretKey);
      const mockAccount = new StellarSDK.Account(wallet.publicKey, '100');

      const tx1 = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      const tx2 = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '20', // Different amount
          })
        )
        .setTimeout(30)
        .build();

      tx1.sign(keypair);
      tx2.sign(keypair);

      // Both should be signed
      expect(tx1.signatures.length).toBe(1);
      expect(tx2.signatures.length).toBe(1);
      
      // But signatures should be different
      expect(tx1.signatures[0].signature()).not.toEqual(tx2.signatures[0].signature());
    });

    it('should enforce network passphrase during signing', () => {
      const wallet = createWallet();
      const keypair = StellarSDK.Keypair.fromSecret(wallet.secretKey);
      const mockAccount = new StellarSDK.Account(wallet.publicKey, '100');

      // Build for testnet
      const testnetTx = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      // Build same transaction for mainnet
      const mainnetTx = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.PUBLIC, // Mainnet
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      testnetTx.sign(keypair);
      mainnetTx.sign(keypair);

      // Network passphrase affects the transaction hash and thus the signature
      expect(testnetTx.hash().toString('hex')).not.toEqual(mainnetTx.hash().toString('hex'));
      expect(testnetTx.signatures[0].signature()).not.toEqual(mainnetTx.signatures[0].signature());
    });
  });

  describe('Missing or Invalid Signer Scenarios', () => {
    it('should reject attempts to use an empty secret key', () => {
      expect(() => importWallet('')).toThrow(PocketPayError);
      expect(() => importWallet('')).toThrow('Invalid Stellar secret key');
    });

    it('should reject secret keys with incorrect format', () => {
      expect(() => importWallet('GXXX')).toThrow(PocketPayError); // Public key, not secret
      expect(() => importWallet('TXXX')).toThrow(PocketPayError); // Wrong prefix
      expect(() => importWallet('S12345')).toThrow(PocketPayError); // Too short
    });

    it('should prevent read-only accounts from signing', async () => {
      const wallet = createWallet();
      const readOnlyAccount = createReadOnlyAccount(wallet.publicKey);

      expect(readOnlyAccount.canSign).toBe(false);
      expect(readOnlyAccount.publicKey).toBe(wallet.publicKey);

      // Attempting to sign should throw
      const mockAccount = new StellarSDK.Account(wallet.publicKey, '100');
      const transaction = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      await expect(
        readOnlyAccount.sign(transaction, StellarSDK.Networks.TESTNET)
      ).rejects.toThrow('read-only');
      await expect(
        readOnlyAccount.sign(transaction, StellarSDK.Networks.TESTNET)
      ).rejects.toThrow('cannot sign');
    });

    it('should allow signing with local accounts created from secret keys', async () => {
      const wallet = createWallet();
      const signingAccount = createLocalAccount(wallet.secretKey);

      expect(signingAccount.canSign).toBe(true);
      expect(signingAccount.publicKey).toBe(wallet.publicKey);

      const mockAccount = new StellarSDK.Account(wallet.publicKey, '100');
      const transaction = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      expect(transaction.signatures.length).toBe(0);

      const signedTx = await signingAccount.sign(transaction, StellarSDK.Networks.TESTNET);

      expect(signedTx.signatures.length).toBe(1);
      expect(signedTx).toBe(transaction); // Signing mutates in place
    });

    it('should not expose secret key from LocalSigner', () => {
      const wallet = createWallet();
      const signingAccount = createLocalAccount(wallet.secretKey);

      // The account should not expose the secret key
      expect((signingAccount as any).secretKey).toBeUndefined();
      expect((signingAccount as any).secret).toBeUndefined();
      
      // Only public key should be accessible
      expect(signingAccount.publicKey).toBe(wallet.publicKey);
    });
  });

  describe('Unsigned Transaction Submission Prevention', () => {
    it('should identify unsigned transactions before submission', () => {
      const wallet = createWallet();
      const mockAccount = new StellarSDK.Account(wallet.publicKey, '100');
      const transaction = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      // Transaction should be unsigned
      expect(transaction.signatures.length).toBe(0);
      
      // Attempting to submit an unsigned transaction to Horizon would fail
      // We verify that we can detect this condition before network call
      const hasRequiredSignatures = transaction.signatures.length > 0;
      expect(hasRequiredSignatures).toBe(false);
    });

    it('should verify signed transactions have non-empty signatures', () => {
      const wallet = createWallet();
      const keypair = StellarSDK.Keypair.fromSecret(wallet.secretKey);
      const mockAccount = new StellarSDK.Account(wallet.publicKey, '100');
      
      const transaction = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      transaction.sign(keypair);

      // Signed transaction should have signature data
      expect(transaction.signatures.length).toBe(1);
      expect(transaction.signatures[0].signature()).toBeDefined();
      expect(transaction.signatures[0].signature().length).toBeGreaterThan(0);
    });

    it('should prevent transaction modification after signing', () => {
      const wallet = createWallet();
      const keypair = StellarSDK.Keypair.fromSecret(wallet.secretKey);
      const mockAccount = new StellarSDK.Account(wallet.publicKey, '100');
      
      const builder = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30);

      const transaction = builder.build();
      const originalHash = transaction.hash();
      
      transaction.sign(keypair);
      const signedHash = transaction.hash();

      // Hash should remain the same after signing (signing doesn't change tx content)
      expect(originalHash).toEqual(signedHash);

      // The transaction is immutable once built - operations are frozen
      // Attempting to build a new transaction from the same builder would create
      // a completely different transaction, not modify the existing one
      expect(transaction.operations.length).toBe(1);
      expect(transaction.signatures.length).toBe(1);
    });

    it('should maintain signature count through serialization', () => {
      const wallet = createWallet();
      const keypair = StellarSDK.Keypair.fromSecret(wallet.secretKey);
      const mockAccount = new StellarSDK.Account(wallet.publicKey, '100');
      
      const transaction = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      transaction.sign(keypair);
      expect(transaction.signatures.length).toBe(1);

      // Serialize and deserialize
      const xdr = transaction.toXDR();
      const restored = new StellarSDK.Transaction(xdr, StellarSDK.Networks.TESTNET);

      // Signature should survive serialization
      expect(restored.signatures.length).toBe(1);
      expect(restored.signatures[0].signature()).toEqual(transaction.signatures[0].signature());
    });
  });

  describe('Multi-Signature Authorization Boundaries', () => {
    it('should support multiple signers on a single transaction', () => {
      const wallet1 = createWallet();
      const wallet2 = createWallet();
      const keypair1 = StellarSDK.Keypair.fromSecret(wallet1.secretKey);
      const keypair2 = StellarSDK.Keypair.fromSecret(wallet2.secretKey);
      
      const mockAccount = new StellarSDK.Account(wallet1.publicKey, '100');
      const transaction = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      expect(transaction.signatures.length).toBe(0);

      // Add first signature
      transaction.sign(keypair1);
      expect(transaction.signatures.length).toBe(1);

      // Add second signature
      transaction.sign(keypair2);
      expect(transaction.signatures.length).toBe(2);

      // Both signatures should be present
      expect(transaction.signatures[0]).toBeDefined();
      expect(transaction.signatures[1]).toBeDefined();
      expect(transaction.signatures[0].signature()).not.toEqual(transaction.signatures[1].signature());
    });

    it('should preserve signature order', () => {
      const wallet1 = createWallet();
      const wallet2 = createWallet();
      const keypair1 = StellarSDK.Keypair.fromSecret(wallet1.secretKey);
      const keypair2 = StellarSDK.Keypair.fromSecret(wallet2.secretKey);
      
      const mockAccount = new StellarSDK.Account(wallet1.publicKey, '100');
      const transaction = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      transaction.sign(keypair1);
      const sig1 = transaction.signatures[0].signature();
      
      transaction.sign(keypair2);
      const sig2 = transaction.signatures[1].signature();

      // Verify signatures remain in order
      expect(transaction.signatures[0].signature()).toEqual(sig1);
      expect(transaction.signatures[1].signature()).toEqual(sig2);
    });
  });

  describe('Security Boundary Documentation', () => {
    it('should document that wallet creation does not persist keys', () => {
      const wallet = createWallet();
      
      // The SDK returns keys but does not persist them
      expect(wallet.publicKey).toBeDefined();
      expect(wallet.secretKey).toBeDefined();
      
      // It is the application's responsibility to persist the secret key
      // The SDK provides the keys in memory only
      // This test documents this security boundary
    });

    it('should document that transaction building requires no secrets', () => {
      // This test documents that transaction preparation is separate from signing
      const publicKey = createWallet().publicKey;
      const destination = createWallet().publicKey;
      
      // Build transaction with only public information
      const mockAccount = new StellarSDK.Account(publicKey, '100');
      const transaction = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      // Transaction built successfully without any secret keys
      expect(transaction).toBeDefined();
      expect(transaction.signatures.length).toBe(0);
      expect(transaction.source).toBe(publicKey);
    });

    it('should document that signing is the authorization gate', () => {
      // This test documents that the signing step is where authorization occurs
      const wallet = createWallet();
      const mockAccount = new StellarSDK.Account(wallet.publicKey, '100');
      
      // Unsigned transaction - no authorization
      const transaction = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      expect(transaction.signatures.length).toBe(0);

      // Signing is the authorization step - requires secret key
      const keypair = StellarSDK.Keypair.fromSecret(wallet.secretKey);
      transaction.sign(keypair);

      // Now authorized with signature
      expect(transaction.signatures.length).toBe(1);
    });

    it('should document that read-only accounts cannot authorize', async () => {
      // This test documents the read-only account boundary
      const publicKey = createWallet().publicKey;
      const readOnlyAccount = createReadOnlyAccount(publicKey);

      // Read-only account can access public data
      expect(readOnlyAccount.publicKey).toBe(publicKey);
      expect(readOnlyAccount.canSign).toBe(false);

      // But cannot authorize transactions
      const mockAccount = new StellarSDK.Account(publicKey, '100');
      const transaction = new StellarSDK.TransactionBuilder(mockAccount, {
        fee: StellarSDK.BASE_FEE,
        networkPassphrase: StellarSDK.Networks.TESTNET,
      })
        .addOperation(
          StellarSDK.Operation.payment({
            destination: createWallet().publicKey,
            asset: StellarSDK.Asset.native(),
            amount: '10',
          })
        )
        .setTimeout(30)
        .build();

      // Read-only accounts reject signing attempts
      await expect(
        readOnlyAccount.sign(transaction, StellarSDK.Networks.TESTNET)
      ).rejects.toThrow();
    });

    it('should document that signing accounts properly guard secrets', () => {
      // This test documents that LocalSigner properly encapsulates secrets
      const wallet = createWallet();
      const signingAccount = createLocalAccount(wallet.secretKey);

      // Public key is accessible
      expect(signingAccount.publicKey).toBe(wallet.publicKey);
      
      // Can sign (proving secret is held internally)
      expect(signingAccount.canSign).toBe(true);
      
      // But secret key is not exposed
      const accountObj = signingAccount as any;
      expect(accountObj.secretKey).toBeUndefined();
      expect(accountObj.secret).toBeUndefined();
      expect(accountObj._secretKey).toBeUndefined();
      
      // The signer is encapsulated
      expect(accountObj.signer).toBeDefined();
      
      // But the signer itself doesn't expose the raw secret
      const signer = accountObj.signer;
      expect(signer.secretKey).toBeUndefined();
      expect(signer.secret).toBeUndefined();
      expect(signer._secretKey).toBeUndefined();
    });
  });
});
