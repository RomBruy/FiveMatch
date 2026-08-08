import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../db'
import {
  groupMemberships,
  groups,
  matchAttendances,
  matchParticipants,
  matches,
  players,
  users,
} from '../../db/schema'
import { attendanceFinalizationService } from '../../services/matches/attendance-finalization.service'
import { trustProjectionService } from '../../services/trust/trust-projection.service'
import { phase3Fixtures as fx, phase3SyntheticIdentity as identity } from '../fixtures/phase3-fixtures'

const ALL_USER_IDS = Object.values(fx.users)
const ALL_PLAYER_IDS = Object.values(fx.players)
const ALL_GROUP_IDS = Object.values(fx.groups)
const ALL_MATCH_IDS = [...Object.values(fx.matches), ...fx.windowMatches]

const KICKOFF = new Date('2099-03-01T19:00:00.000Z')
const COMPLETED_AT = new Date('2099-03-01T21:00:00.000Z')

const hoursBefore = (hours: number) => new Date(KICKOFF.getTime() - hours * 60 * 60 * 1000)

async function cleanup() {
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

  await db.insert(users).values(
    keys.map((key) => ({
      id: fx.users[key],
      clerkUserId: identity.clerkId(key),
      email: identity.email(key),
    })),
  )
  await db.insert(players).values(
    keys.map((key) => ({
      id: fx.players[key],
      userId: fx.users[key],
      displayName: identity.name(key),
      ovrScoreFloat: '65.000',
    })),
  )
  await db.insert(groups).values([
    {
      id: fx.groups.standard,
      organizerId: fx.users.host,
      name: identity.name('crew-standard'),
      formatPreset: '5v5',
      goalkeeperMode: 'none',
      generatorStyle: 'pure_ovr',
    },
    {
      // Same facts, stricter rule: 24h notice or it counts as late.
      id: fx.groups.strictDeadline,
      organizerId: fx.users.host,
      name: identity.name('crew-strict'),
      formatPreset: '5v5',
      goalkeeperMode: 'none',
      generatorStyle: 'pure_ovr',
      cancellationDeadlineHours: 24,
    },
  ])
}

async function seedMatch(
  matchId: string,
  groupId: string,
  options: { withResult?: boolean } = {},
) {
  const withResult = options.withResult ?? true

  await db.insert(matches).values({
    id: matchId,
    groupId,
    hostId: fx.users.host,
    status: withResult ? 'completed' : 'in_progress',
    scheduledAt: KICKOFF,
    completedAt: withResult ? COMPLETED_AT : null,
    format: '5v5',
    playersPerTeam: 5,
    goalkeeperMode: 'none',
    generatorStyle: 'pure_ovr',
    scoreA: withResult ? 3 : null,
    scoreB: withResult ? 2 : null,
  })

  // The snapshot is the evidence of who actually played.
  await db.insert(matchParticipants).values([
    {
      matchId,
      playerId: fx.players.host,
      userId: fx.users.host,
      displayName: identity.name('host'),
      teamSide: 'A' as const,
    },
    {
      matchId,
      playerId: fx.players.attended,
      userId: fx.users.attended,
      displayName: identity.name('attended'),
      teamSide: 'B' as const,
    },
  ])

  await db.insert(matchAttendances).values([
    { matchId, playerId: fx.players.host, status: 'in' as const },
    { matchId, playerId: fx.players.attended, status: 'in' as const },
    { matchId, playerId: fx.players.excused, status: 'out' as const, cancelledAt: hoursBefore(30) },
    { matchId, playerId: fx.players.lateCancel, status: 'out' as const, cancelledAt: hoursBefore(2) },
    { matchId, playerId: fx.players.noShow, status: 'in' as const },
    { matchId, playerId: fx.players.waitlisted, status: 'in' as const, waitlistPosition: 1 },
    { matchId, playerId: fx.players.neverIn, status: 'unknown' as const },
  ])
}

async function outcomesFor(matchId: string) {
  const rows = await db
    .select({
      playerId: matchAttendances.playerId,
      outcome: matchAttendances.outcome,
      finalizedAt: matchAttendances.finalizedAt,
      finalizedBy: matchAttendances.finalizedBy,
    })
    .from(matchAttendances)
    .where(eq(matchAttendances.matchId, matchId))

  return new Map(rows.map((row) => [row.playerId, row]))
}

/**
 * Seed `outcomes.length` completed matches, one per entry, oldest last. The
 * player's row on each carries the state that should produce that outcome once
 * finalized — the projection is never told the answer directly.
 */
async function seedWindow(outcomes: Array<'attended' | 'excused' | 'late_cancel' | 'no_show'>) {
  for (const [index, outcome] of outcomes.entries()) {
    const matchId = fx.windowMatches[index]
    // Index 0 is the most recent; each step back is a week earlier.
    const scheduledAt = new Date(KICKOFF.getTime() - index * 7 * 24 * 60 * 60 * 1000)

    await db.insert(matches).values({
      id: matchId,
      groupId: fx.groups.standard,
      hostId: fx.users.host,
      status: 'completed',
      scheduledAt,
      completedAt: new Date(scheduledAt.getTime() + 2 * 60 * 60 * 1000),
      format: '5v5',
      playersPerTeam: 5,
      goalkeeperMode: 'none',
      generatorStyle: 'pure_ovr',
      scoreA: 1,
      scoreB: 1,
    })

    if (outcome === 'attended') {
      await db.insert(matchParticipants).values({
        matchId,
        playerId: fx.players.attended,
        userId: fx.users.attended,
        displayName: identity.name('attended'),
        teamSide: 'A' as const,
      })
    }

    await db.insert(matchAttendances).values({
      matchId,
      playerId: fx.players.attended,
      status: outcome === 'attended' || outcome === 'no_show' ? ('in' as const) : ('out' as const),
      cancelledAt: outcome === 'excused'
        ? new Date(scheduledAt.getTime() - 30 * 60 * 60 * 1000)
        : outcome === 'late_cancel'
          ? new Date(scheduledAt.getTime() - 2 * 60 * 60 * 1000)
          : null,
    })

    await attendanceFinalizationService.finalizeMatch(matchId, fx.players.host)
  }
}

beforeEach(async () => {
  await cleanup()
  await seedIdentities()
})

afterEach(cleanup)

describe('Phase 3A attendance finalization', () => {
  it('derives every outcome from stored facts in one pass', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)

    const { finalized } = await attendanceFinalizationService.finalizeMatch(
      fx.matches.completed,
      fx.players.host,
    )
    const outcomes = await outcomesFor(fx.matches.completed)

    expect(outcomes.get(fx.players.attended)?.outcome).toBe('attended')
    expect(outcomes.get(fx.players.host)?.outcome).toBe('attended')
    expect(outcomes.get(fx.players.excused)?.outcome).toBe('excused')
    expect(outcomes.get(fx.players.lateCancel)?.outcome).toBe('late_cancel')
    expect(outcomes.get(fx.players.noShow)?.outcome).toBe('no_show')

    // Neither of these ever held a seat, so neither carries a consequence.
    expect(outcomes.get(fx.players.waitlisted)?.outcome).toBeNull()
    expect(outcomes.get(fx.players.neverIn)?.outcome).toBeNull()

    expect(finalized).toHaveLength(5)
  })

  it('stamps inert rows so a replay cannot reconsider them', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)
    await attendanceFinalizationService.finalizeMatch(fx.matches.completed, fx.players.host)

    const outcomes = await outcomesFor(fx.matches.completed)

    // No outcome, but settled — otherwise every replay would re-evaluate them.
    expect(outcomes.get(fx.players.waitlisted)?.finalizedAt).not.toBeNull()
    expect(outcomes.get(fx.players.neverIn)?.finalizedAt).not.toBeNull()
    expect(outcomes.get(fx.players.attended)?.finalizedBy).toBe(fx.players.host)
  })

  it('is idempotent — replaying never moves an outcome or re-reports it', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)

    const first = await attendanceFinalizationService.finalizeMatch(
      fx.matches.completed,
      fx.players.host,
    )
    const afterFirst = await outcomesFor(fx.matches.completed)

    const second = await attendanceFinalizationService.finalizeMatch(
      fx.matches.completed,
      fx.players.attended,
    )
    const afterSecond = await outcomesFor(fx.matches.completed)

    expect(first.finalized).toHaveLength(5)
    // Nothing left to settle, so the second pass reports nothing downstream.
    expect(second.finalized).toHaveLength(0)

    for (const playerId of ALL_PLAYER_IDS) {
      expect(afterSecond.get(playerId)?.outcome).toBe(afterFirst.get(playerId)?.outcome)
      expect(afterSecond.get(playerId)?.finalizedAt?.getTime())
        .toBe(afterFirst.get(playerId)?.finalizedAt?.getTime())
      // The second caller must not overwrite who actually settled the match.
      expect(afterSecond.get(playerId)?.finalizedBy).toBe(fx.players.host)
    }
  })

  it('honours a crew deadline stricter than the platform default', async () => {
    await seedMatch(fx.matches.strictDeadline, fx.groups.strictDeadline)

    await attendanceFinalizationService.finalizeMatch(
      fx.matches.strictDeadline,
      fx.players.host,
    )
    const outcomes = await outcomesFor(fx.matches.strictDeadline)

    // Cancelled 30h out: excused under the 12h default, still excused at 24h.
    expect(outcomes.get(fx.players.excused)?.outcome).toBe('excused')
    // Cancelled 2h out: late under either rule.
    expect(outcomes.get(fx.players.lateCancel)?.outcome).toBe('late_cancel')
  })

  it('finalizes nothing for a match with no result evidence', async () => {
    await seedMatch(fx.matches.noResult, fx.groups.standard, { withResult: false })

    const { finalized } = await attendanceFinalizationService.finalizeMatch(
      fx.matches.noResult,
      fx.players.host,
    )
    const outcomes = await outcomesFor(fx.matches.noResult)

    expect(finalized).toHaveLength(0)
    for (const playerId of ALL_PLAYER_IDS) {
      expect(outcomes.get(playerId)?.outcome ?? null).toBeNull()
      expect(outcomes.get(playerId)?.finalizedAt ?? null).toBeNull()
    }
  })

  it('projects reliability from finalized outcomes end to end', async () => {
    await seedWindow(['attended', 'attended', 'attended', 'attended', 'attended'])

    const projection = await trustProjectionService.getProjection(fx.players.attended)

    expect(projection.sampleCount).toBe(5)
    expect(projection.reliability).toBe(100)
    // Five matches is short of the eight the mark requires.
    expect(projection.isReliable).toBe(false)
  })

  it('weighs a recent no-show more heavily than an older one', async () => {
    await seedWindow(['no_show', 'attended', 'attended', 'attended', 'attended'])
    const recent = await trustProjectionService.getProjection(fx.players.attended)

    await cleanup()
    await seedIdentities()
    await seedWindow(['attended', 'attended', 'attended', 'attended', 'no_show'])
    const old = await trustProjectionService.getProjection(fx.players.attended)

    // Proves the window really is ordered by kickoff, not by insertion.
    expect(old.reliability!).toBeGreaterThan(recent.reliability!)
  })

  it('forgives the first two excused absences end to end', async () => {
    await seedWindow(['excused', 'excused', 'attended', 'attended', 'attended'])
    const forgiven = await trustProjectionService.getProjection(fx.players.attended)

    await cleanup()
    await seedIdentities()
    await seedWindow(['excused', 'excused', 'excused', 'attended', 'attended'])
    const third = await trustProjectionService.getProjection(fx.players.attended)

    expect(forgiven.reliability).toBe(100)
    expect(third.reliability!).toBeLessThan(100)
  })

  it('excludes rows finalized without an outcome from the window', async () => {
    await seedWindow(['attended', 'attended', 'attended', 'attended'])

    await db.insert(matches).values({
      id: fx.windowMatches[4],
      groupId: fx.groups.standard,
      hostId: fx.users.host,
      status: 'completed',
      scheduledAt: KICKOFF,
      completedAt: COMPLETED_AT,
      format: '5v5',
      playersPerTeam: 5,
      goalkeeperMode: 'none',
      generatorStyle: 'pure_ovr',
      scoreA: 1,
      scoreB: 1,
    })
    // A waitlist row that never came up is finalized but carries no outcome.
    await db.insert(matchAttendances).values({
      matchId: fx.windowMatches[4],
      playerId: fx.players.waitlisted,
      status: 'in' as const,
      waitlistPosition: 1,
    })
    await attendanceFinalizationService.finalizeMatch(fx.windowMatches[4], fx.players.host)

    const projection = await trustProjectionService.getProjection(fx.players.waitlisted)

    // Never on the hook, so there is nothing to score — not a zero.
    expect(projection.sampleCount).toBe(0)
    expect(projection.reliability).toBeNull()
    expect(projection.isReliable).toBe(false)
  })

  it('leaves historical rows unknown rather than guessing an outcome', async () => {
    // A pre-Phase-3 match is simply never finalized. Nothing backfills it.
    await seedMatch(fx.matches.completed, fx.groups.standard)
    const outcomes = await outcomesFor(fx.matches.completed)

    for (const playerId of ALL_PLAYER_IDS) {
      expect(outcomes.get(playerId)?.outcome ?? null).toBeNull()
    }
  })
})
