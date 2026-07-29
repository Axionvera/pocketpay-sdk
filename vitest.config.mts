import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30000, // Stellar network calls can be slow
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      // Scope the baseline to SDK source only (issue #367).
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        '**/node_modules/**',
        '**/dist/**',
        '**/tests/**',
        '**/examples/**',
        '**/scripts/**',
      ],
      // text = terminal baseline; html = local drill-down; json-summary + lcov = CI
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: 'coverage',
      // Coverage is reported but does not fail the run by default.
      // Raise these once the suite is mature (see docs/coverage-baseline.md).
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
});
