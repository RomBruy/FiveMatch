import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '../../db'
import {
  groupMemberships,
  groups,
  matchAttendances,
  matchParticipants,
  matches,
  playerMatchEligibilities,
  players,
  users,
} from '../../db/schema'
import { attendanceFinalizationService } from '../../services/matches/attendance-finalization.service'
import { eligibilityService } from '../../services/matches/eligibility.service'
import { phase3Fixtures as fx, phase3SyntheticIdentity as identity } from '../fixtures/phase3-fixtures'

/**
 * The card matrix from the audit brief, driven end to end: attendance is
 * finalized and eligibility falls out of it, rather than being written directly.
 * That is the whole point of Phase 4 — the ledger may only record what the
 * evidence supports.
 */

const ALL_USER_IDS = Object.values(fx.users)
const ALL_PLAYER_IDS = Object.values(fx.players)
const ALL_GROUP_IDS = Object.values(fx.groups)
const ALL_MATCH_IDS = [...Object.values(fx.matches), ...fx.windowMatches]

const SUBJECT = fx.players.attended
const HOST = fx.players.host

const BASE_KICKOFF = new Date('2099-05-01T19:00:00.000Z')

type Scenario = 'attended' | 'no_show' | 'waitlisted' | 'cancelled' | 'incomplete'

async function cleanup() {
  await db.delete(playerMatchEligibilities).where(inArray(playerMatchEligibilities.matchId, ALL_MATCH_IDS))
  await db.delete(matchAttendances).where(inArray(matchAttendances.matchId, ALL_MATCH_IDS))
  await db.delete(matchParticipants).where(inArray(matchParticipants.matchId, ALL_MATCH_IDS))
  await db.delete(matches).where(inArray(matches.id, ALL_MATCH_IDS))
  await db.delete(groupMemberships).where(inArray(groupMemberships.groupId, ALL_GROUP_IDS))
  await db.delete(players).where(inArray(players.id, ALL_PLAYER_IDS))
  await db.delete(groups).where(inArray(groups.id, ALL_GROUP_IDS))
  await db.delete(users).where(inArray(users.id, ALL_USER_IDS))
}

async function seedIdentities() {
  const keys = Object.keys(fx.users) as Array<keyof typeof fx.users>
  await db.insert(users).values(keys.map((key) => ({
    id: fx.users[key], clerkUserId: identity.clerkId(`p4-${key}`), email: identity.email(`p4-${key}`),
  })))
  await db.insert(players).values(keys.map((key) => ({
    id: fx.players[key], userId: fx.users[key], displayName: identity.name(key), ovrScoreFloat: '65.000',
  })))
  await db.insert(groups).values([fx.groups.standard, fx.groups.strictDeadline].map((id, index) => ({
    id,
    organizerId: fx.users.host,
    name: identity.name(`crew-${index}`),
    formatPreset: '5v5' as const,
    goalkeeperMode: 'none' as const,
    generatorStyle: 'pure_ovr' as const,
  })))
}

/**
 * One match in the given shape, finalized unless the scenario says otherwise.
 * `groupId` varies so the "card is global" case can span crews.
 */
async function playMatch(
  matchId: string,
  scenario: Scenario,
  options: { groupId?: string | null; index?: number; finalize?: boolean } = {},
) {
  const { groupId = fx.groups.standard, index = 0, finalize = true } = options
  const scheduledAt = new Date(BASE_KICKOFF.getTime() - index * 7 * 24 * 60 * 60 * 1000)
  const completed = scenario !== 'incomplete'

  await db.insert(matches).values({
    id: matchId,
    groupId,
    hostId: fx.users.host,
    status: completed ? 'completed' : 'in_progress',
    scheduledAt,
    completedAt: completed ? new Date(scheduledAt.getTime() + 2 * 60 * 60 * 1000) : null,
    format: '5v5',
    playersPerTeam: 5,
    goalkeeperMode: 'none',
    generatorStyle: 'pure_ovr',
    scoreA: completed ? 2 : null,
    scoreB: completed ? 1 : null,
  })

  // Only someone who actually played is in the snapshot.
  const inSnapshot = scenario === 'attended' || scenario === 'incomplete'
  const participants = [
    { matchId, playerId: HOST, userId: fx.users.host, displayName: identity.name('host'), teamSide: 'A' as const },
    ...(inSnapshot
      ? [{ matchId, playerId: SUBJECT, userId: fx.users.attended, displayName: identity.name('attended'), teamSide: 'B' as const }]
      : []),
  ]
  await db.insert(matchParticipants).values(participants)

  await db.insert(matchAttendances).values([
    { matchId, playerId: HOST, status: 'in' as const },
    {
      matchId,
      playerId: SUBJECT,
      status: scenario === 'cancelled' ? ('out' as const) : ('in' as const),
      waitlistPosition: scenario === 'waitlisted' ? 1 : null,
      cancelledAt: scenario === 'cancelled'
        ? new Date(scheduledAt.getTime() - 30 * 60 * 60 * 1000)
        : null,
    },
  ])

  if (finalize && completed) {
    await attendanceFinalizationService.finalizeMatch(matchId, HOST)
  }
}

async function activeEligibilityCount(playerId: string) {
  const rows = await db
    .select({ id: playerMatchEligibilities.id })
    .from(playerMatchEligibilities)
    .where(and(
      eq(playerMatchEligibilities.playerId, playerId),
      isNull(playerMatchEligibilities.invalidatedAt),
    ))
  return rows.length
}

async function cardStateOf(playerId: string) {
  const [row] = await db
    .select({ cardState: players.cardState })
    .from(players)
    .where(eq(players.id, playerId))
  return row?.cardState
}

beforeEach(async () => {
  await cleanup()
  await seedIdentities()
})

afterEach(cleanup)

describe('Phase 4 card eligibility matrix', () => {
  it('unlocks at exactly four eligible completed matches', async () => {
    for (const [index, matchId] of fx.windowMatches.slice(0, 3).entries()) {
      await playMatch(matchId, 'attended', { index })
    }
    expect(await activeEligibilityCount(SUBJECT)).toBe(3)
    expect(await cardStateOf(SUBJECT)).toBe('in_progress_3')

    await playMatch(fx.windowMatches[3], 'attended', { index: 3 })
    expect(await activeEligibilityCount(SUBJECT)).toBe(4)
    expect(await cardStateOf(SUBJECT)).toBe('unlocked')
  })

  it('does not unlock on two matches', async () => {
    await playMatch(fx.windowMatches[0], 'attended', { index: 0 })
    await playMatch(fx.windowMatches[1], 'attended', { index: 1 })

    expect(await activeEligibilityCount(SUBJECT)).toBe(2)
    expect(await cardStateOf(SUBJECT)).toBe('in_progress_2')
  })

  it('counts the same match once however often it is settled', async () => {
    await playMatch(fx.windowMatches[0], 'attended')
    await attendanceFinalizationService.finalizeMatch(fx.windowMatches[0], HOST)
    await attendanceFinalizationService.finalizeMatch(fx.windowMatches[0], HOST)

    expect(await activeEligibilityCount(SUBJECT)).toBe(1)
  })

  it('does not count a no-show', async () => {
    // Held a seat, never released it, never appeared in the snapshot.
    await playMatch(fx.windowMatches[0], 'no_show')
    expect(await activeEligibilityCount(SUBJECT)).toBe(0)
  })

  it('does not count a waitlist place that never came up', async () => {
    await playMatch(fx.windowMatches[0], 'waitlisted')
    expect(await activeEligibilityCount(SUBJECT)).toBe(0)
  })

  it('does not count a match the player cancelled out of', async () => {
    await playMatch(fx.windowMatches[0], 'cancelled')
    expect(await activeEligibilityCount(SUBJECT)).toBe(0)
  })

  it('does not count a match with no result', async () => {
    await playMatch(fx.windowMatches[0], 'incomplete')
    expect(await activeEligibilityCount(SUBJECT)).toBe(0)
  })

  it('does not count a match whose sheet was never settled', async () => {
    // The evidence bar is a finalized outcome, not a team sheet. Until someone —
    // or the sweep — settles it, there is nothing to count.
    await playMatch(fx.windowMatches[0], 'attended', { finalize: false })
    expect(await activeEligibilityCount(SUBJECT)).toBe(0)

    await attendanceFinalizationService.finalizeMatch(fx.windowMatches[0], null)
    expect(await activeEligibilityCount(SUBJECT)).toBe(1)
  })

  it('does not count a voided match', async () => {
    await playMatch(fx.windowMatches[0], 'attended')
    expect(await activeEligibilityCount(SUBJECT)).toBe(1)

    await eligibilityService.voidMatch(fx.windowMatches[0], 'walkover', fx.users.host, HOST)
    expect(await activeEligibilityCount(SUBJECT)).toBe(0)
  })

  it('records who voided an eligibility and why', async () => {
    await playMatch(fx.windowMatches[0], 'attended')
    await eligibilityService.voidMatch(fx.windowMatches[0], 'bad result', fx.users.host, HOST)

    const [row] = await db
      .select()
      .from(playerMatchEligibilities)
      .where(and(
        eq(playerMatchEligibilities.matchId, fx.windowMatches[0]),
        eq(playerMatchEligibilities.playerId, SUBJECT),
      ))

    // A correction that does not explain itself is not an audit trail.
    expect(row?.invalidatedAt).not.toBeNull()
    expect(row?.invalidationReason).toBe('bad result')
    expect(row?.invalidatedBy).toBe(HOST)
  })

  it('never re-locks an unlocked card after a void', async () => {
    for (const [index, matchId] of fx.windowMatches.slice(0, 4).entries()) {
      await playMatch(matchId, 'attended', { index })
    }
    expect(await cardStateOf(SUBJECT)).toBe('unlocked')

    await eligibilityService.voidMatch(fx.windowMatches[0], 'voided', fx.users.host, HOST)

    // Count and card state legitimately disagree: the ledger is the audit truth,
    // card state is a high-water mark (ADR-017).
    expect(await activeEligibilityCount(SUBJECT)).toBe(3)
    expect(await cardStateOf(SUBJECT)).toBe('unlocked')
  })

  it('walks back progress below the unlock threshold', async () => {
    await playMatch(fx.windowMatches[0], 'attended', { index: 0 })
    await playMatch(fx.windowMatches[1], 'attended', { index: 1 })
    expect(await cardStateOf(SUBJECT)).toBe('in_progress_2')

    // Not yet unlocked, so there is nothing given to take back.
    await eligibilityService.voidMatch(fx.windowMatches[0], 'voided', fx.users.host, HOST)
    expect(await cardStateOf(SUBJECT)).toBe('in_progress_1')
  })

  it('is idempotent on voiding', async () => {
    await playMatch(fx.windowMatches[0], 'attended')
    const first = await eligibilityService.voidMatch(fx.windowMatches[0], 'first', fx.users.host, HOST)
    const second = await eligibilityService.voidMatch(fx.windowMatches[0], 'second', fx.users.host, HOST)

    expect(first.voided).toBe(true)
    expect(second.voided).toBe(false)

    const [row] = await db
      .select({ reason: playerMatchEligibilities.invalidationReason })
      .from(playerMatchEligibilities)
      .where(eq(playerMatchEligibilities.matchId, fx.windowMatches[0]))

    // The second attempt must not rewrite the original reason.
    expect(row?.reason).toBe('first')
  })

  it('keeps the card global across crews', async () => {
    // Two matches in one crew, two in another, and a standalone one.
    await playMatch(fx.windowMatches[0], 'attended', { index: 0, groupId: fx.groups.standard })
    await playMatch(fx.windowMatches[1], 'attended', { index: 1, groupId: fx.groups.standard })
    await playMatch(fx.windowMatches[2], 'attended', { index: 2, groupId: fx.groups.strictDeadline })
    await playMatch(fx.windowMatches[3], 'attended', { index: 3, groupId: null })

    expect(await activeEligibilityCount(SUBJECT)).toBe(4)
    expect(await cardStateOf(SUBJECT)).toBe('unlocked')
  })

  it('never recomputes historical OVR when a match is voided', async () => {
    await playMatch(fx.windowMatches[0], 'attended')

    const before = await db
      .select({ ovr: players.ovrScoreFloat, matchCount: players.matchCount })
      .from(players)
      .where(inArray(players.id, [SUBJECT, HOST]))

    await eligibilityService.voidMatch(fx.windowMatches[0], 'voided', fx.users.host, HOST)

    const after = await db
      .select({ ovr: players.ovrScoreFloat, matchCount: players.matchCount })
      .from(players)
      .where(inArray(players.id, [SUBJECT, HOST]))

    // PR-031: the result stood at the time and every rating built on it was
    // given in good faith. Rewriting ratings months later would be a far larger
    // correction than the one being made.
    expect(after).toEqual(before)
  })

  it('records the evidence version it was created under', async () => {
    await playMatch(fx.windowMatches[0], 'attended')

    const [row] = await db
      .select({ evidenceVersion: playerMatchEligibilities.evidenceVersion })
      .from(playerMatchEligibilities)
      .where(eq(playerMatchEligibilities.playerId, SUBJECT))

    // A later strengthening must be able to tell its rows from these.
    expect(row?.evidenceVersion).toBe('phase4_finalized_attendance_v1')
  })
})
