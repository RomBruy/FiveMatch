import { validateTestDatabaseUrl } from '../src/tests/support/test-database-url'

/**
 * Measure discovery latency against a seeded dataset.
 *
 * Answers the Phase 7 exit criterion, which asks whether discovery meets a p95
 * target at representative load and which nobody could answer before: every
 * database this code had run against held a handful of rows.
 *
 * Measures the service layer rather than HTTP. That is where the database time
 * is, and it isolates what can actually be optimised — Express, JSON
 * serialisation and TLS add a roughly constant few milliseconds on top, so a
 * service-level p95 is a floor for the real one, not a substitute.
 *
 * Usage:
 *   TEST_DATABASE_URL=... pnpm --filter @fivematch/api measure:latency
 */

validateTestDatabaseUrl(process.env.TEST_DATABASE_URL, process.env.DATABASE_URL)
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL

const ITERATIONS = 60
const WARMUP = 10

/** Where people actually are, so the geo path is exercised as it would be. */
const ORIGINS = [
  { city: 'Paris', latitude: 48.8566, longitude: 2.3522 },
  { city: 'Lyon', latitude: 45.7640, longitude: 4.8357 },
  { city: 'Marseille', latitude: 43.2965, longitude: 5.3698 },
]

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[index]
}

async function time(label: string, run: (i: number) => Promise<unknown>, target: number) {
  for (let i = 0; i < WARMUP; i++) await run(i)

  const samples: number[] = []
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint()
    await run(i)
    samples.push(Number(process.hrtime.bigint() - started) / 1_000_000)
  }

  samples.sort((a, b) => a - b)
  const p50 = percentile(samples, 50)
  const p95 = percentile(samples, 95)
  const p99 = percentile(samples, 99)
  const verdict = p95 <= target ? 'PASS' : 'FAIL'

  console.log(
    `${label.padEnd(34)} p50 ${p50.toFixed(1).padStart(7)}ms  `
    + `p95 ${p95.toFixed(1).padStart(7)}ms  p99 ${p99.toFixed(1).padStart(7)}ms  `
    + `target ${String(target).padStart(4)}ms  ${verdict}`,
  )

  return { label, p50, p95, p99, target, pass: p95 <= target }
}

async function main() {
  const { guestDiscoveryService } = await import('../src/services/matches/guest-discovery.service')
  const { matchService } = await import('../src/services/matches/match.service')

  console.log(`\n${ITERATIONS} samples each, after ${WARMUP} warmup runs\n`)

  const results = []

  results.push(await time('guest discovery (city)', (i) =>
    guestDiscoveryService.discoverPublicMatches({
      city: ORIGINS[i % ORIGINS.length].city,
      limit: 20,
    }), 400))

  results.push(await time('guest discovery (geo 15km)', (i) => {
    const origin = ORIGINS[i % ORIGINS.length]
    return guestDiscoveryService.discoverPublicMatches({
      latitude: origin.latitude,
      longitude: origin.longitude,
      radiusKm: 15,
      limit: 20,
    })
  }, 400))

  results.push(await time('guest discovery (geo 100km)', (i) => {
    const origin = ORIGINS[i % ORIGINS.length]
    return guestDiscoveryService.discoverPublicMatches({
      latitude: origin.latitude,
      longitude: origin.longitude,
      radiusKm: 100,
      limit: 20,
    })
  }, 400))

  results.push(await time('authenticated discovery (geo)', (i) => {
    const origin = ORIGINS[i % ORIGINS.length]
    return matchService.discoverMatches({
      latitude: origin.latitude,
      longitude: origin.longitude,
      radiusKm: 15,
      limit: 20,
    }, undefined)
  }, 400))

  const failed = results.filter((r) => !r.pass)
  console.log(
    failed.length === 0
      ? '\nAll within target.\n'
      : `\n${failed.length} over target: ${failed.map((f) => f.label).join(', ')}\n`,
  )

  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
