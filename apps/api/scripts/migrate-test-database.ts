import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateTestDatabaseUrl } from '../src/tests/support/test-database-url'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const testDatabaseUrl = validateTestDatabaseUrl(
  process.env.TEST_DATABASE_URL,
  process.env.DATABASE_URL,
)

const result = spawnSync('pnpm', ['exec', 'drizzle-kit', 'migrate'], {
  cwd: apiRoot,
  env: { ...process.env, DATABASE_URL: testDatabaseUrl },
  stdio: 'inherit',
})

if (result.error) throw result.error
if (result.status !== 0) process.exitCode = result.status ?? 1

