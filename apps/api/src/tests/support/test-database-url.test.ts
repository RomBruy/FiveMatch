import { describe, expect, it } from 'vitest'
import { validateTestDatabaseUrl } from './test-database-url'

describe('validateTestDatabaseUrl', () => {
  it.each([
    'postgresql://tester:tester@127.0.0.1:55432/fivematch_test',
    'postgres://tester:tester@db:5432/test_fivematch_ci',
    'postgresql://tester:tester@db:5432/fivematch-test-worker-1',
  ])('accepts an explicit test database: %s', (url) => {
    expect(validateTestDatabaseUrl(url)).toBe(url)
  })

  it.each([
    undefined,
    'not-a-url',
    'mysql://tester:tester@db/test_fivematch',
    'postgresql://tester:tester@db/postgres',
    'postgresql://tester:tester@db/fivematch_prod',
    'postgresql://tester:tester@db/fivematch_dev',
    'postgresql://tester:tester@db/fivematch',
  ])('rejects a missing or unsafe target: %s', (url) => {
    expect(() => validateTestDatabaseUrl(url)).toThrow()
  })

  it('rejects reuse of the application database URL even when its name contains test', () => {
    const url = 'postgresql://tester:tester@db/fivematch_test'
    expect(() => validateTestDatabaseUrl(url, url)).toThrow(/must not be the same/)
  })
})

