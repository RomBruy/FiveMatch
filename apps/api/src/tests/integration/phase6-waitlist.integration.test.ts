import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
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
import { attendanceService } from '../../services/matches/attendance.service'
import { phase3Fixtures as fx, phase3SyntheticIdentity as identity } from '../fixtures/phase3-fixtures'

const ALL_USER_IDS = Object.values(fx.users)
const ALL_PLAYER_IDS = Object.values(fx.players)
const ALL_GROUP_IDS = Object.values(fx.groups)
const MATCH_ID = fx.matches.completed

const HOST_USER = fx.users.host
const KICKOFF = new Date('2099-08-01T19:00:00.000Z')

/** Outsiders, so every join goes through the open path rather than a crew seed. */
const OUTSIDERS = [
  { user: fx.users.attended, player: fx.players.attended },
  { user: fx.users.excused, player: fx.players.excused },
  { user: fx.users.lateCancel, player: fx.players.lateCancel },
  { user: fx.users.noShow, player: fx.players.noShow },
  { user: fx.users.waitlisted, player: fx.players.waitlisted },
]

async function cleanup() {
  await db.delete(matchAttendances).where(eq(matchAttendances.matchId, MATCH_ID))
  await db.delete(matches).where(eq(matches.id, MATCH_ID))
  await db.delete(matchSeries).where(inArray(matchSeries.groupId, ALL_GROUP_IDS))
  await db.delete(groupMemberships).where(inArray(groupMemberships.groupId, ALL_GROUP_IDS))
  await db.delete(players).where(inArray(players.id, ALL_PLAYER_IDS))
  await db.delete(groups).where(inArray(groups.id, ALL_GROUP_IDS))
  await db.delete(users).where(inArray(users.id, ALL_USER_IDS))
}

async function seedIdentities() {
  const keys = Object.keys(fx.users) as Array<keyof typeof fx.users>
  await db.insert(users).values(keys.map((key) => ({
    id: fx.users[key], clerkUserId: identity.clerkId(`p6w-${key}`), email: identity.email(`p6w-${key}`),
  })))
  await db.insert(players).values(keys.map((key) => ({
    id: fx.players[key], userId: fx.users[key], displayName: identity.name(key), ovrScoreFloat: '65.000',
  })))
}

/**
 * A public match with `playersPerTeam` seats, already filled to capacity by
 * placeholder rows so every new arrival meets a full sheet.
 */
async function seedFullMatch(playersPerTeam = 1) {
  await db.insert(matches).values({
    id: MATCH_ID,
    groupId: null,
    hostId: HOST_USER,
    status: 'attendance_open',
    scheduledAt: KICKOFF,
    format: '5v5',
    playersPerTeam,
    goalkeeperMode: 'none',
    generatorStyle: 'pure_ovr',
    visibility: 'public',
    hostPlays: false,
  })

  // Fill it: capacity is playersPerTeam * 2.
  const fillers = OUTSIDERS.slice(0, playersPerTeam * 2)
  await db.insert(matchAttendances).values(fillers.map((f) => ({
    matchId: MATCH_ID,
    playerId: f.player,
    status: 'in' as const,
    source: 'open' as const,
  })))

  return OUTSIDERS.slice(playersPerTeam * 2)
}

async function waitlistRows() {
  return db
    .select({
      playerId: matchAttendances.playerId,
      position: matchAttendances.waitlistPosition,
    })
    .from(matchAttendances)
    .where(and(
      eq(matchAttendances.matchId, MATCH_ID),
      isNotNull(matchAttendances.waitlistPosition),
    ))
}

beforeEach(async () => {
  await cleanup()
  await seedIdentities()
})

afterEach(cleanup)

describe('Phase 6 external waitlist', () => {
  it('lets an outsider queue for a full published match', async () => {
    const remaining = await seedFullMatch(1)
    const result = await attendanceService.joinWaitlist(MATCH_ID, remaining[0].user)

    // Previously this was a flat refusal, which is the worst answer available:
    // it is the match they want and places open up constantly (AF-008).
    expect(result.waitlistPosition).toBe(1)
  })

  it('assigns positions in arrival order', async () => {
    const remaining = await seedFullMatch(1)

    const first = await attendanceService.joinWaitlist(MATCH_ID, remaining[0].user)
    const second = await attendanceService.joinWaitlist(MATCH_ID, remaining[1].user)

    expect(first.waitlistPosition).toBe(1)
    expect(second.waitlistPosition).toBe(2)
  })

  it('gives concurrent joiners distinct positions', async () => {
    const remaining = await seedFullMatch(1)

    // The old implementation read MAX(position) and wrote MAX+1 as two separate
    // statements, so two simultaneous joins both read the same maximum and
    // landed on the same place in the queue (AF-005).
    await Promise.all(remaining.slice(0, 3).map((o) => attendanceService.joinWaitlist(MATCH_ID, o.user)))

    const rows = await waitlistRows()
    const positions = rows.map((r) => r.position)

    expect(rows).toHaveLength(3)
    expect(new Set(positions).size).toBe(3)
    expect([...positions].sort()).toEqual([1, 2, 3])
  })

  it('does not move someone already waiting to the back', async () => {
    const remaining = await seedFullMatch(1)

    const first = await attendanceService.joinWaitlist(MATCH_ID, remaining[0].user)
    await attendanceService.joinWaitlist(MATCH_ID, remaining[1].user)
    const again = await attendanceService.joinWaitlist(MATCH_ID, remaining[0].user)

    // Tapping twice must not cost someone their place.
    expect(again.waitlistPosition).toBe(first.waitlistPosition)
    expect(await waitlistRows()).toHaveLength(2)
  })

  it('refuses to queue someone who already holds a seat', async () => {
    await seedFullMatch(1)
    await expect(attendanceService.joinWaitlist(MATCH_ID, OUTSIDERS[0].user))
      .rejects.toMatchObject({ code: 'ALREADY_JOINED' })
  })

  it('lets a host promote a specific waiting player', async () => {
    const remaining = await seedFullMatch(1)
    await attendanceService.joinWaitlist(MATCH_ID, remaining[0].user)
    await attendanceService.joinWaitlist(MATCH_ID, remaining[1].user)

    // Free a seat so there is room to promote into.
    await db
      .update(matchAttendances)
      .set({ status: 'out' })
      .where(and(
        eq(matchAttendances.matchId, MATCH_ID),
        eq(matchAttendances.playerId, OUTSIDERS[0].player),
      ))

    // The second in line, not the first — a host promoting by hand is usually
    // solving something the queue cannot see.
    const result = await attendanceService.promoteFromWaitlist(MATCH_ID, remaining[1].player)

    expect(result.promotedUserId).toBe(remaining[1].user)
    const rows = await waitlistRows()
    expect(rows.map((r) => r.playerId)).toEqual([remaining[0].player])
  })

  it('refuses promotion into a full sheet', async () => {
    const remaining = await seedFullMatch(1)
    await attendanceService.joinWaitlist(MATCH_ID, remaining[0].user)

    // The host may be looking at a screen from before the sheet filled up, so
    // capacity is re-checked under the lock rather than trusted from the client.
    await expect(attendanceService.promoteFromWaitlist(MATCH_ID, remaining[0].player))
      .rejects.toMatchObject({ code: 'NO_SPOTS_AVAILABLE' })
  })

  it('refuses to promote someone who is not waiting', async () => {
    await seedFullMatch(1)
    await expect(attendanceService.promoteFromWaitlist(MATCH_ID, OUTSIDERS[0].player))
      .rejects.toMatchObject({ code: 'NOT_ON_WAITLIST' })
  })
})
