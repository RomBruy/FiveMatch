import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import { db } from '../../db'
import { matchAttendances, matchSeries, matches, players, users } from '../../db/schema'
import { attendanceService } from '../../services/matches/attendance.service'

/**
 * AF-004: can concurrent claimants overfill a match?
 *
 * The audit asks for a concurrent 20-claim test specifically, so this is that
 * test. Phase 6B put a per-match row lock around every seat decision; whether
 * that actually closed AF-004 is a question to answer with evidence rather than
 * by reading the diff.
 *
 * The invariant is simple and absolute: confirmed players never exceed capacity,
 * no matter how many people press the button at the same instant.
 */

const PREFIX = 'p7-capacity-'
const CLAIMANTS = 20
const PLAYERS_PER_TEAM = 3 // capacity 6, so 20 claimants comfortably overrun it

const MATCH_ID = 'd7000000-0000-4000-8000-000000000001'
const HOST_USER = 'd7000000-0000-4000-8000-0000000000ff'

type Person = { userId: string; playerId: string }
const people: Person[] = []

async function cleanup() {
  await db.delete(matchAttendances).where(eq(matchAttendances.matchId, MATCH_ID))
  await db.delete(matches).where(eq(matches.id, MATCH_ID))
  await db.delete(matchSeries).where(eq(matchSeries.hostId, HOST_USER))

  const playerIds = people.map((p) => p.playerId)
  if (playerIds.length > 0) {
    await db.delete(matchAttendances).where(inArray(matchAttendances.playerId, playerIds))
    await db.delete(players).where(inArray(players.id, playerIds))
  }

  const userIds = [...people.map((p) => p.userId), HOST_USER]
  await db.delete(users).where(inArray(users.id, userIds))
  people.length = 0
}

async function seed() {
  await db.insert(users).values({
    id: HOST_USER, clerkUserId: `${PREFIX}host`, email: `${PREFIX}host@example.invalid`,
  })

  for (let i = 0; i < CLAIMANTS; i++) {
    const [user] = await db.insert(users).values({
      clerkUserId: `${PREFIX}${i}`,
      email: `${PREFIX}${i}@example.invalid`,
    }).returning({ id: users.id })

    const [player] = await db.insert(players).values({
      userId: user.id,
      displayName: `${PREFIX}${i}`,
      ovrScoreFloat: '65.000',
    }).returning({ id: players.id })

    people.push({ userId: user.id, playerId: player.id })
  }

  await db.insert(matches).values({
    id: MATCH_ID,
    groupId: null,
    hostId: HOST_USER,
    status: 'attendance_open',
    scheduledAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    format: '5v5',
    playersPerTeam: PLAYERS_PER_TEAM,
    goalkeeperMode: 'none',
    generatorStyle: 'pure_ovr',
    visibility: 'public',
    // Not seeded onto the sheet, so all capacity is genuinely up for grabs.
    hostPlays: false,
  })
}

async function sheet() {
  const rows = await db
    .select({
      playerId: matchAttendances.playerId,
      status: matchAttendances.status,
      waitlistPosition: matchAttendances.waitlistPosition,
    })
    .from(matchAttendances)
    .where(eq(matchAttendances.matchId, MATCH_ID))

  return {
    confirmed: rows.filter((r) => r.status === 'in' && r.waitlistPosition === null),
    waitlisted: rows.filter((r) => r.waitlistPosition !== null),
    all: rows,
  }
}

beforeEach(async () => {
  await cleanup()
  await seed()
})

afterEach(cleanup)

describe('Phase 7 capacity under concurrency (AF-004)', () => {
  it('never seats more players than capacity when 20 claim at once', async () => {
    const capacity = PLAYERS_PER_TEAM * 2

    // All twenty at the same instant, on separate connections.
    const outcomes = await Promise.allSettled(
      people.map((person) => attendanceService.joinOpenMatch(MATCH_ID, person.userId)),
    )

    const after = await sheet()

    // The invariant. Overfilling is the failure AF-004 describes.
    expect(after.confirmed.length).toBeLessThanOrEqual(capacity)

    // And nobody is lost: everyone who did not get a seat is either queued or
    // was told no. A claim that silently vanishes is its own bug.
    const rejected = outcomes.filter((o) => o.status === 'rejected').length
    expect(after.confirmed.length + after.waitlisted.length + rejected).toBe(CLAIMANTS)

    // One row per person, whatever happened.
    const distinct = new Set(after.all.map((r) => r.playerId))
    expect(distinct.size).toBe(after.all.length)
  })

  it('assigns every waitlist position exactly once under concurrency', async () => {
    await Promise.allSettled(
      people.map((person) => attendanceService.joinOpenMatch(MATCH_ID, person.userId)),
    )

    const rows = await db
      .select({ position: matchAttendances.waitlistPosition })
      .from(matchAttendances)
      .where(and(
        eq(matchAttendances.matchId, MATCH_ID),
        isNotNull(matchAttendances.waitlistPosition),
      ))

    const positions = rows.map((r) => r.position)
    expect(new Set(positions).size).toBe(positions.length)
  })

  it('fills exactly to capacity when there are more claimants than places', async () => {
    const capacity = PLAYERS_PER_TEAM * 2

    await Promise.allSettled(
      people.map((person) => attendanceService.joinOpenMatch(MATCH_ID, person.userId)),
    )

    const after = await sheet()

    // Not merely "no more than capacity" — the places should actually be taken.
    // A lock that serialised everyone into the waitlist would satisfy the
    // inequality above while leaving the pitch empty.
    expect(after.confirmed.length).toBe(capacity)
  })

  it('is idempotent when the same person claims repeatedly at once', async () => {
    const person = people[0]

    await Promise.allSettled(
      Array.from({ length: 8 }, () => attendanceService.joinOpenMatch(MATCH_ID, person.userId)),
    )

    const rows = await db
      .select({ id: matchAttendances.id })
      .from(matchAttendances)
      .where(and(
        eq(matchAttendances.matchId, MATCH_ID),
        eq(matchAttendances.playerId, person.playerId),
      ))

    // The unique constraint on (match, player) is what makes this safe; without
    // it a double-tap would take two places.
    expect(rows).toHaveLength(1)
  })

  it('does not lose a place when someone leaves while others are joining', async () => {
    const capacity = PLAYERS_PER_TEAM * 2

    // Fill it first.
    for (const person of people.slice(0, capacity)) {
      await attendanceService.joinOpenMatch(MATCH_ID, person.userId)
    }

    // One leaves while the rest pile in.
    await Promise.allSettled([
      attendanceService.markAttendance(MATCH_ID, people[0].userId, 'out'),
      ...people.slice(capacity).map((p) => attendanceService.joinOpenMatch(MATCH_ID, p.userId)),
    ])

    const after = await sheet()
    expect(after.confirmed.length).toBeLessThanOrEqual(capacity)

    // The freed place is either taken or promoted into — never left empty while
    // people are queuing for it.
    const queued = after.waitlisted.length
    if (queued > 0) expect(after.confirmed.length).toBe(capacity)
  })
})
