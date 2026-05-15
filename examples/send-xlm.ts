/**
 * Example: Send XLM between two testnet accounts.
 *
 * Usage:
 *   npx tsx examples/send-xlm.ts
 *
 * This example creates two wallets, funds the sender, and sends XLM.
 */

import {
  createWallet,
  fundTestnetAccount,
  sendXLM,
  getBalance,
} from '../src';

async function main() {
  // Create sender and receiver wallets
  console.log('🔑 Creating sender wallet...');
  const sender = createWallet();
  console.log(`  Sender: ${sender.publicKey}\n`);

  console.log('🔑 Creating receiver wallet...');
  const receiver = createWallet();
  console.log(`  Receiver: ${receiver.publicKey}\n`);

  // Fund both wallets (receiver needs to exist on-chain for payment)
  console.log('💧 Funding sender via Friendbot...');
  await fundTestnetAccount(sender.publicKey);
  console.log('  ✅ Sender funded\n');

  console.log('💧 Funding receiver via Friendbot...');
  await fundTestnetAccount(receiver.publicKey);
  console.log('  ✅ Receiver funded\n');

  // Send XLM
  const amount = '25';
  console.log(`💸 Sending ${amount} XLM from sender to receiver...`);
  const result = await sendXLM({
    sourceSecret: sender.secretKey,
    destination: receiver.publicKey,
    amount,
    memo: 'PocketPay test',
  });

  console.log(`  ✅ Payment sent!`);
  console.log(`  TX Hash: ${result.hash}`);
  console.log(`  Ledger:  ${result.ledger}`);
  console.log(`  Fee:     ${result.fee} stroops\n`);

  // Check final balances
  console.log('💰 Final balances:');
  const senderBal = await getBalance(sender.publicKey);
  const receiverBal = await getBalance(receiver.publicKey);
  console.log(`  Sender:   ${senderBal.nativeBalance} XLM`);
  console.log(`  Receiver: ${receiverBal.nativeBalance} XLM`);

  console.log('\n✅ Done!');
}

main().catch(console.error);
