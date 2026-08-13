import { Pool } from 'pg'
import { validateTestDatabaseUrl } from '../src/tests/support/test-database-url'

/**
 * Seed a city-scale dataset for latency measurement.
 *
 * The exit criterion for Phase 7 asks whether discovery meets a p95 target "at
 * representative load". Nobody could answer that, because every database this
 * code has ever run against held a handful of rows. Discovery does bounding-box
 * geo filtering plus a correlated subquery per row — fast over ten matches, and
 * an open question over fifty thousand.
 *
 * Guarded by the same check the integration suite uses, so it cannot be pointed
 * at a development or production database.
 *
 * Usage:
 *   TEST_DATABASE_URL=... pnpm --filter @fivematch/api seed:load
 */

const TARGET = validateTestDatabaseUrl(process.env.TEST_DATABASE_URL, process.env.DATABASE_URL)

const PLAYERS = Number(process.env.LOAD_PLAYERS ?? 5_000)
const MATCHES = Number(process.env.LOAD_MATCHES ?? 20_000)
/** Roughly the real distribution: most matches sit in a few dense cities. */
const CITIES = [
  { name: 'Paris', lat: 48.8566, lng: 2.3522, weight: 40 },
  { name: 'Lyon', lat: 45.7640, lng: 4.8357, weight: 25 },
  { name: 'Marseille', lat: 43.2965, lng: 5.3698, weight: 20 },
  { name: 'Toulouse', lat: 43.6047, lng: 1.4442, weight: 10 },
  { name: 'Lille', lat: 50.6292, lng: 3.0573, weight: 5 },
]

const BATCH = 1_000
const pool = new Pool({ connectionString: TARGET })

function pickCity() {
  const total = CITIES.reduce((sum, c) => sum + c.weight, 0)
  let roll = Math.random() * total
  for (const city of CITIES) {
    roll -= city.weight
    if (roll <= 0) return city
  }
  return CITIES[0]
}

/** Spread within roughly 15km of the centre, so radius filters have work to do. */
const jitter = () => (Math.random() - 0.5) * 0.25

/** Remove everything this script created. The test database is shared with the
 *  integration suite, and leaving 100k rows behind slows every run. */
async function purge() {
  await pool.query(`
    DELETE FROM match_attendances WHERE match_id IN (SELECT id FROM matches WHERE notes = 'loadtest');
    DELETE FROM matches WHERE notes = 'loadtest';
    DELETE FROM players WHERE display_name LIKE 'loadtest-%';
    DELETE FROM users WHERE clerk_user_id LIKE 'loadtest-%';
  `)
  await pool.query('ANALYZE matches; ANALYZE match_attendances; ANALYZE players;')
}

async function main() {
  const started = Date.now()

  if (process.env.LOAD_PURGE === '1') {
    await purge()
    console.log('load-test rows purged')
    await pool.end()
    return
  }
  console.log(`seeding ${MATCHES} matches / ${PLAYERS} players into ${TARGET.split('/').pop()}`)

  await pool.query(`
    DELETE FROM match_attendances WHERE match_id IN (SELECT id FROM matches WHERE notes = 'loadtest');
    DELETE FROM matches WHERE notes = 'loadtest';
    DELETE FROM players WHERE display_name LIKE 'loadtest-%';
    DELETE FROM users WHERE clerk_user_id LIKE 'loadtest-%';
  `)

  const userIds: string[] = []
  const playerIds: string[] = []

  for (let start = 0; start < PLAYERS; start += BATCH) {
    const size = Math.min(BATCH, PLAYERS - start)
    const values = Array.from({ length: size }, (_, i) =>
      `('loadtest-u${start + i}', 'loadtest-u${start + i}@example.invalid')`).join(',')

    const { rows } = await pool.query(
      `INSERT INTO users (clerk_user_id, email) VALUES ${values} RETURNING id`,
    )
    userIds.push(...rows.map((r) => r.id))

    const playerValues = rows
      .map((r, i) => `('${r.id}', 'loadtest-p${start + i}', 65.000)`)
      .join(',')
    const { rows: pRows } = await pool.query(
      `INSERT INTO players (user_id, display_name, ovr_score_float) VALUES ${playerValues} RETURNING id`,
    )
    playerIds.push(...pRows.map((r) => r.id))
  }
  console.log(`  players: ${playerIds.length}`)

  const matchIds: string[] = []
  for (let start = 0; start < MATCHES; start += BATCH) {
    const size = Math.min(BATCH, MATCHES - start)
    const values = Array.from({ length: size }, (_, i) => {
      const city = pickCity()
      const host = userIds[(start + i) % userIds.length]
      // Spread across the next 30 days, which is the discovery horizon.
      const days = Math.random() * 30
      // Most public, some private — private ones still have to be filtered out.
      const isPublic = Math.random() < 0.8
      return `(
        '${host}', 'attendance_open',
        now() + interval '${days.toFixed(3)} days',
        '5v5', 5, 'none', 'pure_ovr',
        '${city.name}', ${(city.lat + jitter()).toFixed(6)}, ${(city.lng + jitter()).toFixed(6)},
        '${isPublic ? 'public' : 'private'}', 'loadtest', false
      )`
    }).join(',')

    const { rows } = await pool.query(
      `INSERT INTO matches
         (host_id, status, scheduled_at, format, players_per_team, goalkeeper_mode,
          generator_style, city, latitude, longitude, visibility, notes, host_plays)
       VALUES ${values} RETURNING id`,
    )
    matchIds.push(...rows.map((r) => r.id))
  }
  console.log(`  matches: ${matchIds.length}`)

  // Attendance is what the per-row subqueries count, so it has to be realistic:
  // a partly-filled sheet on most matches rather than empty ones.
  let attendanceRows = 0
  for (let start = 0; start < matchIds.length; start += 200) {
    const slice = matchIds.slice(start, start + 200)
    const values: string[] = []
    for (const matchId of slice) {
      const taken = Math.floor(Math.random() * 9)
      for (let i = 0; i < taken; i++) {
        const player = playerIds[Math.floor(Math.random() * playerIds.length)]
        values.push(`('${matchId}', '${player}', 'in', 'open')`)
      }
    }
    if (values.length === 0) continue
    await pool.query(
      `INSERT INTO match_attendances (match_id, player_id, status, source)
       VALUES ${values.join(',')} ON CONFLICT DO NOTHING`,
    )
    attendanceRows += values.length
  }
  console.log(`  attendances: ~${attendanceRows}`)

  await pool.query('ANALYZE matches; ANALYZE match_attendances; ANALYZE players;')
  console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s`)
  await pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
