import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { eq, inArray } from 'drizzle-orm'

/**
 * One walk through the real thing: HTTP in, real PostgreSQL out.
 *
 * This shape of test did not exist. Route tests mock the database away, so the
 * SQL never runs; integration tests call services directly, so the routes and
 * serializers never run. Every defect found during Phase 6 lived in the gap
 * between those two — four of them, over months, with every suite green:
 *
 *   - three copies of the availability arithmetic disagreed after 6A changed
 *     what a null `openSpots` means;
 *   - a correlated subquery compared a match id to the attendance row's own id,
 *     so every count returned zero.
 *
 * The second is why the fixtures below are deliberately **asymmetric and
 * non-zero**. A test where the right answer is 0 cannot tell a working query
 * from a broken one — which is exactly how that bug survived.
 *
 * Only Clerk is faked. Authorization, capability resolution, serializers and
 * every SQL statement are the real ones, because that is where the bugs were.
 */

vi.mock('@clerk/express', () => ({
  requireAuth: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  clerkMiddleware: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  getAuth: (req: express.Request) => ({ userId: req.headers['x-test-clerk-id'] as string | undefined }),
}))
vi.mock('../../services/notifications/notification.service', () => ({
  notificationService: { send: vi.fn() },
}))

import { db } from '../../db'
import { matchAttendances, matchSeries, matches, players, users } from '../../db/schema'
import apiRouter from '../../routes'

const PREFIX = 'lifecycle-scenario-'

const HOST = { userId: '', clerkId: `${PREFIX}host`, playerId: '' }
const JOINER = { userId: '', clerkId: `${PREFIX}joiner`, playerId: '' }
const GUEST_UNUSED = `${PREFIX}nobody`

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/v1', apiRouter)
  return app
}

/** Signed-in call. Omit `clerkId` for a genuinely anonymous one. */
const as = (clerkId?: string) => {
  const agent = request(makeApp())
  return {
    get: (url: string) => {
      const r = agent.get(url)
      return clerkId ? r.set('x-test-clerk-id', clerkId) : r
    },
    post: (url: string, body: unknown = {}) => {
      const r = agent.post(url).send(body as object)
      return clerkId ? r.set('x-test-clerk-id', clerkId) : r
    },
  }
}

const createdMatchIds: string[] = []

async function cleanup() {
  const ids = [...createdMatchIds]
  if (ids.length > 0) {
    await db.delete(matchAttendances).where(inArray(matchAttendances.matchId, ids))
    await db.delete(matches).where(inArray(matches.id, ids))
  }
  createdMatchIds.length = 0

  const seeded = await db.select({ id: users.id }).from(users)
    .where(inArray(users.clerkUserId, [HOST.clerkId, JOINER.clerkId, GUEST_UNUSED]))
  const userIds = seeded.map((u) => u.id)
  if (userIds.length > 0) {
    const seededPlayers = await db.select({ id: players.id }).from(players)
      .where(inArray(players.userId, userIds))
    const playerIds = seededPlayers.map((p) => p.id)
    if (playerIds.length > 0) {
      await db.delete(matchAttendances).where(inArray(matchAttendances.playerId, playerIds))
    }
    await db.delete(matchSeries).where(inArray(matchSeries.hostId, userIds))
    await db.delete(players).where(inArray(players.userId, userIds))
    await db.delete(users).where(inArray(users.id, userIds))
  }
}

async function seedPeople() {
  for (const person of [HOST, JOINER]) {
    const [user] = await db.insert(users).values({
      clerkUserId: person.clerkId,
      email: `${person.clerkId}@example.invalid`,
      name: person.clerkId,
    }).returning({ id: users.id })
    person.userId = user.id

    const [player] = await db.insert(players).values({
      userId: user.id,
      displayName: person.clerkId,
      ovrScoreFloat: '65.000',
    }).returning({ id: players.id })
    person.playerId = player.id
  }
}

/** Availability as each surface reports it, for the same match. */
async function availabilityEverywhere(matchId: string) {
  const preview = await as().get(`/v1/matches/${matchId}/preview`)
  const discovery = await as().get('/v1/discover/public?limit=50')
  const detail = await as(HOST.clerkId).get(`/v1/matches/${matchId}`)

  const listed = (discovery.body.data as Array<{ matchId: string; availability: unknown }>)
    .find((m) => m.matchId === matchId)

  return {
    preview: preview.body.data?.availability,
    discovery: listed?.availability,
    detail: detail.body.data?.availability,
  }
}

beforeEach(async () => {
  await cleanup()
  await seedPeople()
})

afterEach(cleanup)

describe('Lifecycle scenario: HTTP through real PostgreSQL', () => {
  it('reports the same availability on every surface, and it is not zero', async () => {
    const created = await as(HOST.clerkId).post('/v1/matches', {
      scheduledAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      format: '5v5',
      playersPerTeam: 5,
      goalkeeperMode: 'none',
      visibility: 'public',
      city: 'Lyon',
    })

    expect(created.status).toBe(201)
    const matchId = created.body.data.id ?? created.body.data.matchId
    createdMatchIds.push(matchId)

    // The host plays by default, so the sheet already has one confirmed player.
    // Non-zero on purpose: a broken count returns 0, and so does an empty match.
    const initial = await availabilityEverywhere(matchId)

    expect(initial.preview).toMatchObject({ capacity: 10, confirmedCount: 1, spotsRemaining: 9 })
    expect(initial.discovery).toMatchObject({ capacity: 10, confirmedCount: 1, spotsRemaining: 9 })
    expect(initial.detail).toMatchObject({ capacity: 10, confirmedCount: 1, spotsRemaining: 9 })

    // Someone joins: every surface must move together.
    const joined = await as(JOINER.clerkId).post(`/v1/matches/${matchId}/join`)
    expect([200, 201]).toContain(joined.status)

    const after = await availabilityEverywhere(matchId)

    expect(after.preview).toMatchObject({ confirmedCount: 2, spotsRemaining: 8 })
    expect(after.discovery).toMatchObject({ confirmedCount: 2, spotsRemaining: 8 })
    expect(after.detail).toMatchObject({ confirmedCount: 2, spotsRemaining: 8 })

    // The consistency claim itself: three copies of this arithmetic disagreed
    // for two packages without a single test noticing.
    expect(after.preview).toEqual(after.discovery)
    expect(after.discovery).toMatchObject({
      confirmedCount: (after.detail as { confirmedCount: number }).confirmedCount,
      spotsRemaining: (after.detail as { spotsRemaining: number }).spotsRemaining,
    })
  })

  it('publishes every remaining place on a recurring public match', async () => {
    const created = await as(HOST.clerkId).post('/v1/matches', {
      scheduledAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      format: '5v5',
      playersPerTeam: 5,
      goalkeeperMode: 'none',
      visibility: 'public',
      city: 'Lyon',
      recurrence: { frequency: 'weekly' },
    })

    expect(created.status).toBe(201)
    const matchId = created.body.data.id ?? created.body.data.matchId
    createdMatchIds.push(matchId)

    // Series materialization kept its own copy of the default and still offered
    // a single place after 6A changed the meaning of null.
    const occurrences = await db
      .select({ id: matches.id, openSpots: matches.openSpots })
      .from(matches)
      .where(eq(matches.hostId, HOST.userId))

    createdMatchIds.push(...occurrences.map((o) => o.id))

    expect(occurrences.length).toBeGreaterThan(1)
    for (const occurrence of occurrences) {
      expect(occurrence.openSpots).toBeNull()
    }

    const preview = await as().get(`/v1/matches/${matchId}/preview`)
    expect(preview.body.data.availability.spotsRemaining).toBe(9)
  })

  it('keeps a private match off every anonymous surface', async () => {
    const created = await as(HOST.clerkId).post('/v1/matches', {
      scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      format: '5v5',
      playersPerTeam: 5,
      goalkeeperMode: 'none',
      visibility: 'private',
      city: 'Lyon',
    })
    const matchId = created.body.data.id ?? created.body.data.matchId
    createdMatchIds.push(matchId)

    const preview = await as().get(`/v1/matches/${matchId}/preview`)
    expect(preview.status).toBe(404)

    const discovery = await as().get('/v1/discover/public?limit=50')
    const ids = (discovery.body.data as Array<{ matchId: string }>).map((m) => m.matchId)
    expect(ids).not.toContain(matchId)
  })

  it('refuses an unauthenticated call to anything behind the auth boundary', async () => {
    // The pre-auth allow-list is three routes. Everything else must reject an
    // anonymous caller — checked through the real middleware chain, not by
    // reading the mounting order.
    const guarded = await as().get('/v1/players/me')
    expect(guarded.status).toBe(401)
  })
})
