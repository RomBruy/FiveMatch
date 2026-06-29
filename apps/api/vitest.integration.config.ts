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
    include: ['src/tests/integration/**/*.integration.test.ts'],
    environment: 'node',
    testTimeout: 30000,
  },
})
