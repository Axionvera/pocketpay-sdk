/**
 * Example: Fetch and display recent transactions and payments for an account.
 *
 * Usage:
 *   npx tsx examples/get-transactions.ts
 *
 * This example queries the Stellar testnet for transaction and payment history
 * using only a public key (no secret key required).
 */

import { getTransactions, getPayments } from '../src';

// Replace with any funded testnet public key
const PUBLIC_KEY = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

async function main() {
  console.log(`📜 Fetching recent transactions for ${PUBLIC_KEY}...\n`);

  // Fetch recent transactions (newest first)
  const { records: txs, count: txCount } = await getTransactions(PUBLIC_KEY, 5, 'desc');
  console.log(`Transactions (${txCount} found):`);
  if (txCount === 0) {
    console.log('  No transactions found.\n');
  } else {
    for (const tx of txs) {
      const date = new Date(tx.createdAt).toLocaleString();
      const status = tx.successful ? '✅' : '❌';
      console.log(`  ${status} ${tx.hash}`);
      console.log(`    Ledger: ${tx.ledger} | Fee: ${tx.fee} stroops | Ops: ${tx.operationCount}`);
      console.log(`    Date: ${date}`);
      if (tx.memo) console.log(`    Memo: ${tx.memo}`);
      console.log();
    }
  }

  // Fetch recent payments
  console.log(`💸 Fetching recent payments for ${PUBLIC_KEY}...\n`);
  const { records: payments, count: payCount } = await getPayments(PUBLIC_KEY, 5, 'desc');
  console.log(`Payments (${payCount} found):`);
  if (payCount === 0) {
    console.log('  No payments found.\n');
  } else {
    for (const p of payments) {
      const date = new Date(p.createdAt).toLocaleString();
      console.log(`  ${p.type}: ${p.amount} ${p.asset}`);
      console.log(`    From: ${p.from}`);
      console.log(`    To:   ${p.to}`);
      console.log(`    Date: ${date}`);
      console.log(`    TX:   ${p.transactionHash}`);
      console.log();
    }
  }

  console.log('✅ Done!');
}

main().catch(console.error);
