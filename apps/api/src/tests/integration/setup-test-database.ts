import { validateTestDatabaseUrl } from '../support/test-database-url'

const testDatabaseUrl = validateTestDatabaseUrl(
  process.env.TEST_DATABASE_URL,
  process.env.DATABASE_URL,
)

// db/index.ts reads DATABASE_URL while the test modules are imported. The guarded,
// explicit test value is installed here first; there is no application-DB fallback.
process.env.DATABASE_URL = testDatabaseUrl

