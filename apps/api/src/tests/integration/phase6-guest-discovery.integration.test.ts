import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { inArray } from 'drizzle-orm'
import { db } from '../../db'
import { matchAttendances, matchSeries, matches, players, users } from '../../db/schema'
import { guestDiscoveryService } from '../../services/matches/guest-discovery.service'
import { phase3Fixtures as fx, phase3SyntheticIdentity as identity } from '../fixtures/phase3-fixtures'

/**
 * Guest discovery is the only anonymous surface in the product, so these tests
 * are mostly about what does NOT come out of it.
 */

const ALL_USER_IDS = Object.values(fx.users)
const ALL_PLAYER_IDS = Object.values(fx.players)
const ALL_MATCH_IDS = [...Object.values(fx.matches), ...fx.windowMatches]
const HOST_USER = fx.users.host

const SOON = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
const hours = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000)

/** Private details that must never reach an anonymous caller. */
const SECRETS = {
  location: '12 Rue Secrète, Building B, gate code 4471',
  venueName: 'Le Terrain Privé',
  notes: 'Bring the key from the cafe',
}

async function cleanup() {
  await db.delete(matchAttendances).where(inArray(matchAttendances.matchId, ALL_MATCH_IDS))
  await db.delete(matches).where(inArray(matches.id, ALL_MATCH_IDS))
  await db.delete(matchSeries).where(inArray(matchSeries.hostId, ALL_USER_IDS))
  await db.delete(players).where(inArray(players.id, ALL_PLAYER_IDS))
  await db.delete(users).where(inArray(users.id, ALL_USER_IDS))
}

async function seedIdentities() {
  const keys = Object.keys(fx.users) as Array<keyof typeof fx.users>
  await db.insert(users).values(keys.map((key) => ({
    id: fx.users[key], clerkUserId: identity.clerkId(`p6g-${key}`), email: identity.email(`p6g-${key}`),
  })))
  await db.insert(players).values(keys.map((key) => ({
    id: fx.players[key], userId: fx.users[key], displayName: identity.name(key), ovrScoreFloat: '65.000',
  })))
}

async function seedMatch(matchId: string, over: Record<string, unknown> = {}) {
  await db.insert(matches).values({
    id: matchId,
    groupId: null,
    hostId: HOST_USER,
    status: 'attendance_open',
    scheduledAt: SOON,
    format: '5v5',
    playersPerTeam: 5,
    goalkeeperMode: 'none',
    generatorStyle: 'pure_ovr',
    visibility: 'public',
    hostPlays: false,
    city: 'Lyon',
    latitude: '45.7640',
    longitude: '4.8357',
    ...SECRETS,
    ...over,
  } as never)
}

// Unwraps the page so existing cases keep reading a plain array.
const discover = async (over = {}) =>
  (await guestDiscoveryService.discoverPublicMatches({ limit: 20, ...over })).matches

const discoverPage = (over = {}) =>
  guestDiscoveryService.discoverPublicMatches({ limit: 20, ...over })

beforeEach(async () => {
  await cleanup()
  await seedIdentities()
})

afterEach(cleanup)

describe('Phase 6 guest discovery', () => {
  it('returns an open public match', async () => {
    await seedMatch(fx.windowMatches[0])
    const results = await discover()

    expect(results).toHaveLength(1)
    expect(results[0].city).toBe('Lyon')
    expect(results[0].availability.spotsRemaining).toBe(10)
  })

  it('leaks no private detail whatsoever', async () => {
    await seedMatch(fx.windowMatches[0])
    const serialized = JSON.stringify(await discover())

    // The exact test that matters: none of what a committed participant sees
    // may appear in an anonymous response.
    expect(serialized).not.toContain(SECRETS.location)
    expect(serialized).not.toContain(SECRETS.venueName)
    expect(serialized).not.toContain(SECRETS.notes)
    expect(serialized).not.toContain('45.76')
    expect(serialized).not.toContain('4.8357')
    expect(serialized).not.toContain(identity.name('host'))
  })

  it('withholds the host name', async () => {
    await seedMatch(fx.windowMatches[0])
    const results = await discover()

    // The single-match preview shows one, but it needs an unguessable id. A
    // list hands out every host in a city to anyone who asks.
    expect(results[0].host.displayName).toBeNull()
  })

  it('gives distance without giving coordinates', async () => {
    await seedMatch(fx.windowMatches[0])
    const results = await discover({ latitude: 45.75, longitude: 4.85, radiusKm: 20 })

    // "3km away" helps someone choose; the pitch's position does not.
    expect(results[0].distanceKm).toBeGreaterThan(0)
    expect(results[0].distanceKm).toBeLessThan(20)
    expect(JSON.stringify(results)).not.toContain('45.76')
  })

  it('excludes private matches', async () => {
    await seedMatch(fx.windowMatches[0], { visibility: 'private' })
    expect(await discover()).toHaveLength(0)
  })

  it('excludes a crew-first match before its window opens', async () => {
    await seedMatch(fx.windowMatches[0], { publicOpensAt: hours(6) })
    expect(await discover()).toHaveLength(0)

    await db.delete(matches).where(inArray(matches.id, [fx.windowMatches[0]]))
    await seedMatch(fx.windowMatches[0], { publicOpensAt: hours(-6) })
    expect(await discover()).toHaveLength(1)
  })

  it('excludes locked, cancelled and voided matches', async () => {
    await seedMatch(fx.windowMatches[0], { status: 'attendance_locked' })
    await seedMatch(fx.windowMatches[1], { status: 'cancelled' })
    await seedMatch(fx.windowMatches[2], { voidedAt: new Date() })

    // A locked sheet is not an invitation, and showing it is a wasted tap.
    expect(await discover()).toHaveLength(0)
  })

  it('excludes matches in the past and beyond the horizon', async () => {
    await seedMatch(fx.windowMatches[0], { scheduledAt: hours(-2) })
    await seedMatch(fx.windowMatches[1], {
      scheduledAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    })
    expect(await discover()).toHaveLength(0)
  })

  it('filters by city case-insensitively', async () => {
    await seedMatch(fx.windowMatches[0], { city: 'Lyon' })
    await seedMatch(fx.windowMatches[1], { city: 'Paris' })

    expect(await discover({ city: 'lyon' })).toHaveLength(1)
    expect(await discover({ city: 'LYON' })).toHaveLength(1)
    expect(await discover({ city: 'Marseille' })).toHaveLength(0)
  })

  it('honours the limit', async () => {
    for (const [index, id] of fx.windowMatches.slice(0, 4).entries()) {
      await seedMatch(id, { scheduledAt: hours(24 + index) })
    }
    expect(await discover({ limit: 2 })).toHaveLength(2)
  })

  it('pages without repeating or skipping', async () => {
    for (const [index, id] of fx.windowMatches.slice(0, 5).entries()) {
      await seedMatch(id, { scheduledAt: hours(24 + index) })
    }

    const first = await discoverPage({ limit: 2 })
    expect(first.matches).toHaveLength(2)
    expect(first.nextCursor).not.toBeNull()

    const second = await discoverPage({ limit: 2, cursor: first.nextCursor! })
    const third = await discoverPage({ limit: 2, cursor: second.nextCursor! })

    const seen = [...first.matches, ...second.matches, ...third.matches].map((m) => m.matchId)

    expect(seen).toHaveLength(5)
    expect(new Set(seen).size).toBe(5)
    // Exhausted, so no cursor is offered.
    expect(third.nextCursor).toBeNull()
  })

  it('does not skip a match when one is inserted mid-page', async () => {
    for (const [index, id] of fx.windowMatches.slice(0, 4).entries()) {
      await seedMatch(id, { scheduledAt: hours(48 + index * 2) })
    }

    const first = await discoverPage({ limit: 2 })

    // A new fixture appears before the ones already read — exactly the case
    // where OFFSET 2 would shift everything and silently skip a row.
    await seedMatch(fx.matches.completed, { scheduledAt: hours(1) })

    const second = await discoverPage({ limit: 2, cursor: first.nextCursor! })
    const overlap = second.matches.filter((m) => first.matches.some((f) => f.matchId === m.matchId))

    expect(overlap).toHaveLength(0)
  })

  it('starts over rather than breaking on a stale or foreign cursor', async () => {
    await seedMatch(fx.windowMatches[0])

    const garbage = await discoverPage({ limit: 20, cursor: 'not-a-real-cursor' })
    expect(garbage.matches).toHaveLength(1)
  })

  it('shows a full match rather than hiding it', async () => {
    await seedMatch(fx.windowMatches[0], { playersPerTeam: 1 })
    await db.insert(matchAttendances).values([
      { matchId: fx.windowMatches[0], playerId: fx.players.attended, status: 'in' as const, source: 'open' as const },
      { matchId: fx.windowMatches[0], playerId: fx.players.excused, status: 'in' as const, source: 'open' as const },
    ])

    const results = await discover()

    // Places open up constantly; a guest can queue once they have an account.
    expect(results).toHaveLength(1)
    expect(results[0].availability.spotsRemaining).toBe(0)
    expect(results[0].availability.canWaitlist).toBe(true)
  })
})
