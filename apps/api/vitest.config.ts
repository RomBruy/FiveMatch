import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@fivematch\/types\/(.+)$/,
        replacement: path.resolve(__dirname, '../../packages/types/src') + '/$1',
      },
      {
        find: '@fivematch/types',
        replacement: path.resolve(__dirname, '../../packages/types/src/index.ts'),
      },
      {
        find: '@fivematch/test-utils',
        replacement: path.resolve(__dirname, '../../packages/test-utils/src/index.ts'),
      },
    ],
  },
  test: {
    // Exclude integration tests from the default unit test run
    // Integration tests require a live Postgres instance and run via test:integration
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'src/tests/integration/**',
      'src/**/*.integration.test.ts',
    ],
  },
})
