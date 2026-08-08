import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db'
import {
  groupMemberships,
  groups,
  matchAttendances,
  matchSeries,
  matches,
  players,
  users,
} from '../../db/schema'
import { matchService } from '../../services/matches/match.service'
import { attendanceService } from '../../services/matches/attendance.service'
import { phase3Fixtures as fx, phase3SyntheticIdentity as identity } from '../fixtures/phase3-fixtures'

const ALL_USER_IDS = Object.values(fx.users)
const ALL_PLAYER_IDS = Object.values(fx.players)
const ALL_GROUP_IDS = Object.values(fx.groups)

const HOST_USER = fx.users.host
const HOST_PLAYER = fx.players.host

const KICKOFF = new Date('2099-07-01T19:00:00.000Z')
const hoursFromNow = (h: number) => new Date(Date.now() + h * 60 * 60 * 1000)

/** Matches are created by the service, so ids are not known in advance. */
const created: string[] = []

async function cleanup() {
  if (created.length > 0) {
    await db.delete(matchAttendances).where(inArray(matchAttendances.matchId, created))
    await db.delete(matches).where(inArray(matches.id, created))
    created.length = 0
  }
  await db.delete(matchSeries).where(inArray(matchSeries.groupId, ALL_GROUP_IDS))
  await db.delete(groupMemberships).where(inArray(groupMemberships.groupId, ALL_GROUP_IDS))
  await db.delete(players).where(inArray(players.id, ALL_PLAYER_IDS))
  await db.delete(groups).where(inArray(groups.id, ALL_GROUP_IDS))
  await db.delete(users).where(inArray(users.id, ALL_USER_IDS))
}

async function seedIdentities() {
  const keys = Object.keys(fx.users) as Array<keyof typeof fx.users>
  await db.insert(users).values(keys.map((key) => ({
    id: fx.users[key], clerkUserId: identity.clerkId(`p6-${key}`), email: identity.email(`p6-${key}`),
  })))
  await db.insert(players).values(keys.map((key) => ({
    id: fx.players[key], userId: fx.users[key], displayName: identity.name(key), ovrScoreFloat: '65.000',
  })))
  await db.insert(groups).values({
    id: fx.groups.standard,
    organizerId: HOST_USER,
    name: identity.name('crew'),
    formatPreset: '5v5',
    goalkeeperMode: 'none',
    generatorStyle: 'pure_ovr',
  })
}

async function createMatch(overrides: Record<string, unknown> = {}) {
  const match = await matchService.createMatch(HOST_USER, {
    scheduledAt: KICKOFF.toISOString(),
    format: '5v5',
    playersPerTeam: 5,
    goalkeeperMode: 'none',
    ...overrides,
  } as never)
  created.push(match.id)
  return match
}

async function reload(matchId: string) {
  const [row] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1)
  return row
}

beforeEach(async () => {
  await cleanup()
  await seedIdentities()
})

afterEach(cleanup)

describe('Phase 6 publication and host participation', () => {
  it('seeds the host onto their own sheet', async () => {
    const match = await createMatch()

    const [row] = await db
      .select({ status: matchAttendances.status })
      .from(matchAttendances)
      .where(and(
        eq(matchAttendances.matchId, match.id),
        eq(matchAttendances.playerId, HOST_PLAYER),
      ))

    // Before this, a host had to RSVP to their own match and every capacity
    // calculation started one place short (AF-007).
    expect(row?.status).toBe('in')
  })

  it('leaves a non-playing host off the sheet', async () => {
    const match = await createMatch({ hostPlays: false })

    const [row] = await db
      .select({ status: matchAttendances.status })
      .from(matchAttendances)
      .where(and(
        eq(matchAttendances.matchId, match.id),
        eq(matchAttendances.playerId, HOST_PLAYER),
      ))

    expect(row?.status ?? null).not.toBe('in')
  })

  it('publishes every remaining place when no cap is given', async () => {
    const match = await createMatch({ visibility: 'public' })
    const spots = await attendanceService.getSpots(await reload(match.id))

    // The old default of 1 made a public 5v5 look full to every stranger who
    // saw it — the opposite of what publishing is for (ADR-033).
    expect(spots.capacity).toBe(10)
    expect(spots.confirmed).toBe(1) // the host
    expect(spots.spotsRemaining).toBe(9)
  })

  it('honours an explicit cap without inventing places', async () => {
    const match = await createMatch({ visibility: 'public', openSpots: 3 })
    const spots = await attendanceService.getSpots(await reload(match.id))

    expect(spots.spotsRemaining).toBe(3)
  })

  it('never offers more than the sheet actually has', async () => {
    // A cap larger than the real remainder must not conjure places.
    const match = await createMatch({ visibility: 'public', openSpots: 50 })
    const spots = await attendanceService.getSpots(await reload(match.id))

    expect(spots.spotsRemaining).toBe(spots.capacity - spots.confirmed)
  })

  it('offers nothing publicly before the crew-first window opens', async () => {
    const match = await createMatch({
      visibility: 'public',
      publicOpensAt: hoursFromNow(6).toISOString(),
    })
    const spots = await attendanceService.getSpots(await reload(match.id))

    // The crew gets first refusal on their own fixture.
    expect(spots.spotsRemaining).toBe(0)
  })

  it('opens to outsiders once the window has passed', async () => {
    const match = await createMatch({
      visibility: 'public',
      publicOpensAt: hoursFromNow(-6).toISOString(),
    })
    const spots = await attendanceService.getSpots(await reload(match.id))

    expect(spots.spotsRemaining).toBeGreaterThan(0)
  })

  it('offers nothing publicly on a private match', async () => {
    const match = await createMatch({ visibility: 'private' })
    const spots = await attendanceService.getSpots(await reload(match.id))

    expect(spots.spotsRemaining).toBe(0)
  })
})
