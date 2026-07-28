/**
* Smoke Test Script
*
* Verifies that the SDK builds correctly and that the compiled output
* can be imported and executed without errors. Focuses on non-network
* helpers to ensure tests are fast and reliable.
*/

// Import from the built output to verify packaging, not the source.
// We use require to verify CommonJS compatibility, which the compiler emits.
const path = require('path');
const fs = require('fs');

const distPath = path.resolve(__dirname, '../dist/index.js');

if (!fs.existsSync(distPath)) {
  console.error('❌ Smoke test failed: dist/index.js not found. Did you run npm run build?');
  process.exit(1);
}

try {
  console.log('📦 Loading compiled SDK...');
  const PocketPay = require(distPath);

  console.log('🧪 Running non-network smoke tests...');

  // 1. Test basic wallet creation
  const wallet = PocketPay.createWallet();
  if (!wallet.publicKey.startsWith('G') || !wallet.secretKey.startsWith('S')) {
    throw new Error('createWallet returned an invalid keypair format');
  }
  console.log('   ✅ createWallet() generated a valid keypair');

  // 2. Test unit conversion helpers
  const stroops = PocketPay.xlmToStroops('10.5');
  if (stroops !== 105000000) {
    throw new Error(`xlmToStroops calculation failed. Expected 105000000, got ${stroops}`);
  }
  console.log('   ✅ xlmToStroops() converted successfully');

  // 3. Test string formatting helper
  const truncated = PocketPay.truncateAddress('GABC1234567890XYZ', 4, 4);
  if (truncated !== 'GABC...0XYZ') {
    throw new Error(`truncateAddress formatting failed. Expected "GABC...0XYZ", got "${truncated}"`);
  }
  console.log('   ✅ truncateAddress() formatted successfully');

  // 4. Test validation logic
  try {
    PocketPay.validateAmount('-10');
    throw new Error('validateAmount should have thrown for a negative amount');
  } catch (error: any) {
    if (error.name !== 'PocketPayError') {
      throw new Error(`validateAmount threw unexpected error type: ${error.name}`);
    }
  }
  console.log('   ✅ validateAmount() rejected invalid input successfully');

  console.log('🎉 Smoke test passed! The SDK imports and runs properly.');
  process.exit(0);

} catch (error) {
  console.error('\n❌ Smoke test failed with an error:');
  console.error(error);
  process.exit(1);
}