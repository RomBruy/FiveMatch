const APPROVED_TEST_NAME = /(^test(?:_|-|$)|(?:_|-)test(?:_|-|$))/i
const KNOWN_NON_TEST_NAMES = new Set([
  'postgres',
  'template0',
  'template1',
  'fivematch',
  'fivematch_dev',
  'fivematch_development',
  'fivematch_staging',
  'fivematch_prod',
  'development',
  'staging',
  'production',
  'prod',
])

/** Validate the explicit disposable PostgreSQL target before any integration import opens a pool. */
export function validateTestDatabaseUrl(
  rawTestUrl: string | undefined,
  applicationDatabaseUrl?: string,
): string {
  if (!rawTestUrl) {
    throw new Error('TEST_DATABASE_URL is required; integration tests never fall back to DATABASE_URL.')
  }

  let parsed: URL
  try {
    parsed = new URL(rawTestUrl)
  } catch {
    throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL URL.')
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('TEST_DATABASE_URL must use the postgres or postgresql protocol.')
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\/+/, '')).toLowerCase()
  if (!databaseName) throw new Error('TEST_DATABASE_URL must name a database.')
  if (KNOWN_NON_TEST_NAMES.has(databaseName) || !APPROVED_TEST_NAME.test(databaseName)) {
    throw new Error(
      `Refusing database "${databaseName}": the name must contain an explicit test prefix or suffix.`,
    )
  }

  if (applicationDatabaseUrl && applicationDatabaseUrl === rawTestUrl) {
    throw new Error('TEST_DATABASE_URL must not be the same value as the application DATABASE_URL.')
  }

  return rawTestUrl
}

