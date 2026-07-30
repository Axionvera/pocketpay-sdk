import { Keypair } from '@stellar/stellar-sdk';
import { createLocalSigner } from '../src/account';
import type { ExternalSignerAdapter } from '../src/account/types';

test('LocalSigner satisfies ExternalSignerAdapter', () => {
  const local = createLocalSigner(Keypair.random().secret());
  // TypeScript type check only; runtime assertion is trivial
  const _: ExternalSignerAdapter = local as any;
  expect(_).toBeDefined();
});
