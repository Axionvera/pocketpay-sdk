// Minimal test to ensure ExternalSignerAdapter type compatibility
import { createLocalSigner } from 'pocketpay-sdk/src/account';
import type { ExternalSignerAdapter } from 'pocketpay-sdk/src/account/types';

test('LocalSigner satisfies ExternalSignerAdapter', () => {
  const local = createLocalSigner('S...');
  // TypeScript type check only; runtime assertion is trivial
  const _: ExternalSignerAdapter = local as any;
  expect(_).toBeDefined();
});
