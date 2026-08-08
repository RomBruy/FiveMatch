import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../../db'
import {
  groupMemberships,
  groups,
  matchAttendances,
  matchParticipants,
  matches,
  ovrProcessingEvents,
  playerMatchEligibilities,
  players,
  pronoBets,
  pronos,
  ratingEvents,
  ratings,
  users,
} from '../../db/schema'
import { eligibilityService } from '../../services/matches/eligibility.service'
import { membershipService } from '../../services/groups/membership.service'
import { RatingSubmissionError, ratingService } from '../../services/ratings/rating.service'
import { phase1Fixtures as fx, phase1SyntheticIdentity as identity } from '../fixtures/phase1-fixtures'

const ALL_USER_IDS = Object.values(fx.users)
const ALL_PLAYER_IDS = Object.values(fx.players)
const ALL_GROUP_IDS = Object.values(fx.groups)
const ALL_MATCH_IDS = Object.values(fx.matches)

const completedAt = new Date('2099-01-01T20:00:00.000Z')
const scheduledAt = new Date('2099-01-01T18:00:00.000Z')

const ratingValues = {
  pace: 7,
  technique: 7,
  passing: 7,
  defending: 7,
  physicality: 7,
  effort: 7,
}

async function cleanup() {
  await db.delete(matchAttendances).where(inArray(matchAttendances.matchId, ALL_MATCH_IDS))
  await db.delete(ovrProcessingEvents).where(inArray(ovrProcessingEvents.playerId, ALL_PLAYER_IDS))
  await db.delete(ratingEvents).where(inArray(ratingEvents.playerId, ALL_PLAYER_IDS))
  await db.delete(ratings).where(inArray(ratings.ratedPlayerId, ALL_PLAYER_IDS))
  await db.delete(pronoBets).where(inArray(pronoBets.playerId, ALL_PLAYER_IDS))
  await db.delete(pronos).where(inArray(pronos.playerId, ALL_PLAYER_IDS))
  await db.delete(playerMatchEligibilities).where(inArray(playerMatchEligibilities.playerId, ALL_PLAYER_IDS))
  await db.delete(matchParticipants).where(inArray(matchParticipants.matchId, ALL_MATCH_IDS))
  await db.delete(matches).where(inArray(matches.id, ALL_MATCH_IDS))
  await db.delete(groupMemberships).where(inArray(groupMemberships.groupId, ALL_GROUP_IDS))
  await db.delete(players).where(inArray(players.id, ALL_PLAYER_IDS))
  await db.delete(groups).where(inArray(groups.id, ALL_GROUP_IDS))
  await db.delete(users).where(inArray(users.id, ALL_USER_IDS))
}

async function seedIdentities() {
  await db.insert(users).values([
    { id: fx.users.host, clerkUserId: identity.clerkId('host'), email: identity.email('host') },
    { id: fx.users.playerA, clerkUserId: identity.clerkId('player-a'), email: identity.email('player-a') },
    { id: fx.users.teammateA, clerkUserId: identity.clerkId('teammate-a'), email: identity.email('teammate-a') },
    { id: fx.users.opponentB, clerkUserId: identity.clerkId('opponent-b'), email: identity.email('opponent-b') },
    { id: fx.users.outsider, clerkUserId: identity.clerkId('outsider'), email: identity.email('outsider') },
  ])
  await db.insert(players).values([
    { id: fx.players.host, userId: fx.users.host, displayName: identity.name('host'), ovrScoreFloat: '65.000' },
    { id: fx.players.playerA, userId: fx.users.playerA, displayName: identity.name('player-a'), ovrScoreFloat: '65.000' },
    { id: fx.players.teammateA, userId: fx.users.teammateA, displayName: identity.name('teammate-a'), ovrScoreFloat: '65.000' },
    { id: fx.players.opponentB, userId: fx.users.opponentB, displayName: identity.name('opponent-b'), ovrScoreFloat: '65.000' },
    { id: fx.players.outsider, userId: fx.users.outsider, displayName: identity.name('outsider'), ovrScoreFloat: '65.000' },
  ])
  await db.insert(groups).values([
    {
      id: fx.groups.primary,
      organizerId: fx.users.host,
      name: identity.name('group-primary'),
      formatPreset: '5v5',
      goalkeeperMode: 'none',
      generatorStyle: 'pure_ovr',
    },
    {
      id: fx.groups.secondary,
      organizerId: fx.users.outsider,
      name: identity.name('group-secondary'),
      formatPreset: '5v5',
      goalkeeperMode: 'none',
      generatorStyle: 'pure_ovr',
    },
  ])
  await db.insert(groupMemberships).values([
    { groupId: fx.groups.primary, userId: fx.users.host, role: 'organizer', joinedAt: scheduledAt },
    { groupId: fx.groups.primary, userId: fx.users.playerA, role: 'member', joinedAt: scheduledAt },
    { groupId: fx.groups.secondary, userId: fx.users.playerA, role: 'member', joinedAt: scheduledAt },
  ])
}

async function seedMatch(
  matchId: string,
  status: 'completed' | 'cancelled' = 'completed',
  result: { scoreA: number | null; scoreB: number | null } = { scoreA: 2, scoreB: 1 },
  includePlayerA = true,
) {
  await db.insert(matches).values({
    id: matchId,
    groupId: fx.groups.primary,
    hostId: fx.users.host,
    status,
    scheduledAt,
    completedAt: status === 'completed' ? completedAt : null,
    format: '5v5',
    playersPerTeam: 5,
    goalkeeperMode: 'none',
    generatorStyle: 'pure_ovr',
    scoreA: result.scoreA,
    scoreB: result.scoreB,
  })

  const participants = [
    ...(includePlayerA ? [{ matchId, playerId: fx.players.playerA, userId: fx.users.playerA, displayName: identity.name('player-a'), teamSide: 'A' as const }] : []),
    { matchId, playerId: fx.players.teammateA, userId: fx.users.teammateA, displayName: identity.name('teammate-a'), teamSide: 'A' as const },
    { matchId, playerId: fx.players.opponentB, userId: fx.users.opponentB, displayName: identity.name('opponent-b'), teamSide: 'B' as const },
    { matchId, playerId: fx.players.host, userId: fx.users.host, displayName: identity.name('host'), teamSide: 'B' as const },
  ]
  await db.insert(matchParticipants).values(participants)

  // Phase 4 raised the bar from "named on the sheet" to "finalized as attended".
  // These cases are about counting and idempotency, not about the evidence rule,
  // so the evidence is seeded directly rather than driven through finalization.
  await db.insert(matchAttendances).values(
    participants.map((participant) => ({
      matchId,
      playerId: participant.playerId,
      status: 'in' as const,
      outcome: 'attended' as const,
      finalizedAt: completedAt,
    })),
  )
}

beforeEach(async () => {
  await cleanup()
  await seedIdentities()
})

afterEach(cleanup)

describe('Phase 1 canonical eligible-match and card integrity', () => {
  it('accepts one repeated/concurrent result transition and records eligibility once', async () => {
    await seedMatch(fx.matches.valid)
    await db.update(matches).set({
      status: 'in_progress',
      completedAt: null,
      scoreA: null,
      scoreB: null,
    }).where(eq(matches.id, fx.matches.valid))

    const submitResult = () => db.transaction(async (tx) => {
      const transitioned = await tx
        .update(matches)
        .set({ status: 'completed', completedAt, scoreA: 2, scoreB: 1 })
        .where(and(eq(matches.id, fx.matches.valid), eq(matches.status, 'in_progress')))
        .returning({ id: matches.id })
      if (transitioned.length === 0) return false
      await eligibilityService.recordCompletedMatchInTransaction(tx, fx.matches.valid)
      return true
    })

    const results = await Promise.all([submitResult(), submitResult()])
    expect(results.sort()).toEqual([false, true])
    expect(await db.select().from(playerMatchEligibilities).where(and(
      eq(playerMatchEligibilities.matchId, fx.matches.valid),
      eq(playerMatchEligibilities.playerId, fx.players.playerA),
    ))).toHaveLength(1)
    const [player] = await db.select({ matchCount: players.matchCount }).from(players).where(eq(players.id, fx.players.playerA))
    expect(player?.matchCount).toBe(1)
  })

  it('stores one match/player record and counts repeated processing once', async () => {
    await seedMatch(fx.matches.valid)

    await eligibilityService.recordCompletedMatch(fx.matches.valid)
    await eligibilityService.recordCompletedMatch(fx.matches.valid)

    const rows = await db.select().from(playerMatchEligibilities).where(and(
      eq(playerMatchEligibilities.matchId, fx.matches.valid),
      eq(playerMatchEligibilities.playerId, fx.players.playerA),
    ))
    expect(rows).toHaveLength(1)

    const [player] = await db.select({ matchCount: players.matchCount }).from(players).where(eq(players.id, fx.players.playerA))
    expect(player?.matchCount).toBe(1)
    expect(await eligibilityService.getMatchCountDrift(fx.players.playerA)).toEqual({ cached: 1, canonical: 1, delta: 0 })
  })

  it('unlocks at four unique matches and never from two matches processed twice', async () => {
    for (const matchId of [fx.matches.valid, fx.matches.validTwo]) {
      await seedMatch(matchId)
      await eligibilityService.recordCompletedMatch(matchId)
      await eligibilityService.recordCompletedMatch(matchId)
    }

    let [player] = await db.select({ matchCount: players.matchCount, cardState: players.cardState }).from(players).where(eq(players.id, fx.players.playerA))
    expect(player).toMatchObject({ matchCount: 2, cardState: 'in_progress_2' })

    for (const matchId of [fx.matches.validThree, fx.matches.validFour]) {
      await seedMatch(matchId)
      await eligibilityService.recordCompletedMatch(matchId)
    }

    ;[player] = await db.select({ matchCount: players.matchCount, cardState: players.cardState }).from(players).where(eq(players.id, fx.players.playerA))
    expect(player).toMatchObject({ matchCount: 4, cardState: 'unlocked' })
  })

  it('excludes cancelled, incomplete and absent-snapshot players', async () => {
    await seedMatch(fx.matches.cancelled, 'cancelled')
    await seedMatch(fx.matches.incomplete, 'completed', { scoreA: 2, scoreB: null })
    await seedMatch(fx.matches.missingParticipant, 'completed', { scoreA: 2, scoreB: 1 }, false)

    await eligibilityService.recordCompletedMatch(fx.matches.cancelled)
    await eligibilityService.recordCompletedMatch(fx.matches.incomplete)
    await eligibilityService.recordCompletedMatch(fx.matches.missingParticipant)

    const rows = await db.select().from(playerMatchEligibilities).where(eq(playerMatchEligibilities.playerId, fx.players.playerA))
    expect(rows).toHaveLength(0)
  })
})

describe('Phase 1 post-match rating integrity', () => {
  beforeEach(async () => {
    await seedMatch(fx.matches.valid)
  })

  const submit = (raterPlayerId: string, ratedPlayerId: string) => ratingService.submitPostMatchRating({
    matchId: fx.matches.valid,
    raterPlayerId,
    ratedPlayerId,
    values: ratingValues,
  })

  it('accepts an opponent and rejects self, teammate and nonparticipants', async () => {
    await expect(submit(fx.players.playerA, fx.players.opponentB)).resolves.toEqual({ rated: true })

    await expect(submit(fx.players.playerA, fx.players.playerA)).rejects.toMatchObject({ code: 'CANNOT_RATE_SELF' })
    await expect(submit(fx.players.playerA, fx.players.teammateA)).rejects.toMatchObject({ code: 'CANNOT_RATE_TEAMMATE' })
    await expect(submit(fx.players.playerA, fx.players.outsider)).rejects.toMatchObject({ code: 'NOT_A_PARTICIPANT' })
    await expect(submit(fx.players.outsider, fx.players.opponentB)).rejects.toMatchObject({ code: 'NOT_A_PARTICIPANT' })
  })

  it('stores one row under concurrent duplicate submissions with a deterministic conflict', async () => {
    const settled = await Promise.allSettled([
      submit(fx.players.playerA, fx.players.opponentB),
      submit(fx.players.playerA, fx.players.opponentB),
    ])

    expect(settled.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
    const rejected = settled.find((item): item is PromiseRejectedResult => item.status === 'rejected')
    expect(rejected?.reason).toBeInstanceOf(RatingSubmissionError)
    expect(rejected?.reason).toMatchObject({ code: 'ALREADY_RATED', statusCode: 409 })

    const stored = await db.select().from(ratings).where(and(
      eq(ratings.matchId, fx.matches.valid),
      eq(ratings.raterPlayerId, fx.players.playerA),
      eq(ratings.ratedPlayerId, fx.players.opponentB),
    ))
    expect(stored).toHaveLength(1)
  })

  it('rejects closed, incomplete and cancelled match evidence', async () => {
    await db.update(matches).set({ ratingWindowClosedAt: new Date('2099-01-01T21:00:00.000Z') }).where(eq(matches.id, fx.matches.valid))
    await expect(submit(fx.players.playerA, fx.players.opponentB)).rejects.toMatchObject({ code: 'RATING_WINDOW_CLOSED' })

    await seedMatch(fx.matches.incomplete, 'completed', { scoreA: 1, scoreB: null })
    await expect(ratingService.submitPostMatchRating({
      matchId: fx.matches.incomplete,
      raterPlayerId: fx.players.playerA,
      ratedPlayerId: fx.players.opponentB,
      values: ratingValues,
    })).rejects.toMatchObject({ code: 'WRONG_MATCH_STATUS' })

    await seedMatch(fx.matches.cancelled, 'cancelled')
    await expect(ratingService.submitPostMatchRating({
      matchId: fx.matches.cancelled,
      raterPlayerId: fx.players.playerA,
      ratedPlayerId: fx.players.opponentB,
      values: ratingValues,
    })).rejects.toMatchObject({ code: 'WRONG_MATCH_STATUS' })
  })
})

describe('Phase 1 OVR processing idempotency', () => {
  it('creates one processing/event record under repeated concurrent closure without changing canonical match count', async () => {
    await seedMatch(fx.matches.valid)
    await eligibilityService.recordCompletedMatch(fx.matches.valid)

    await ratingService.submitPostMatchRating({ matchId: fx.matches.valid, raterPlayerId: fx.players.opponentB, ratedPlayerId: fx.players.playerA, values: ratingValues })
    await ratingService.submitPostMatchRating({ matchId: fx.matches.valid, raterPlayerId: fx.players.host, ratedPlayerId: fx.players.playerA, values: ratingValues })

    await Promise.all([
      ratingService.closeWindow(fx.matches.valid),
      ratingService.closeWindow(fx.matches.valid),
    ])

    const processing = await db.select().from(ovrProcessingEvents).where(and(
      eq(ovrProcessingEvents.matchId, fx.matches.valid),
      eq(ovrProcessingEvents.playerId, fx.players.playerA),
      eq(ovrProcessingEvents.processingType, 'MATCH_UPDATE'),
    ))
    expect(processing).toHaveLength(1)

    const events = await db.select().from(ratingEvents).where(and(
      eq(ratingEvents.matchId, fx.matches.valid),
      eq(ratingEvents.playerId, fx.players.playerA),
      eq(ratingEvents.eventType, 'MATCH_UPDATE'),
    ))
    expect(events).toHaveLength(1)

    const [player] = await db.select({ matchCount: players.matchCount }).from(players).where(eq(players.id, fx.players.playerA))
    expect(player?.matchCount).toBe(1)
  })
})

describe('Phase 1 historical group participation', () => {
  it('ends only the selected membership and preserves multi-group history, ratings and pronostics across re-addition', async () => {
    await seedMatch(fx.matches.valid)
    await db.insert(ratings).values({
      id: fx.ratings.valid,
      groupId: fx.groups.primary,
      matchId: fx.matches.valid,
      raterPlayerId: fx.players.opponentB,
      ratedPlayerId: fx.players.playerA,
      ...ratingValues,
      mentality: 5,
      isInitial: false,
    })
    await db.insert(pronos).values({
      matchId: fx.matches.valid,
      playerId: fx.players.playerA,
      predictionResult: 'teamA',
      predictionScore: '2-1',
      submittedAt: scheduledAt,
    })
    await db.insert(pronoBets).values({
      matchId: fx.matches.valid,
      playerId: fx.players.playerA,
      market: 'result',
      selection: 'teamA',
      stake: 10,
      oddsAtBet: '2.00',
    })

    await membershipService.endMembership(fx.groups.primary, fx.users.playerA)

    // A later final-participant snapshot remains valid history even though the
    // selected crew membership has ended.
    await seedMatch(fx.matches.validTwo)

    const [ended] = await db.select().from(groupMemberships).where(and(
      eq(groupMemberships.groupId, fx.groups.primary),
      eq(groupMemberships.userId, fx.users.playerA),
    ))
    const [secondary] = await db.select().from(groupMemberships).where(and(
      eq(groupMemberships.groupId, fx.groups.secondary),
      eq(groupMemberships.userId, fx.users.playerA),
    ))
    expect(ended?.deletedAt).not.toBeNull()
    expect(secondary?.deletedAt).toBeNull()
    expect(await db.select().from(players).where(eq(players.id, fx.players.playerA))).toHaveLength(1)
    expect(await db.select().from(matchParticipants).where(and(eq(matchParticipants.matchId, fx.matches.valid), eq(matchParticipants.playerId, fx.players.playerA)))).toHaveLength(1)
    expect(await db.select().from(matchParticipants).where(and(eq(matchParticipants.matchId, fx.matches.validTwo), eq(matchParticipants.playerId, fx.players.playerA)))).toHaveLength(1)
    expect(await db.select().from(ratings).where(eq(ratings.id, fx.ratings.valid))).toHaveLength(1)
    expect(await db.select().from(pronos).where(eq(pronos.playerId, fx.players.playerA))).toHaveLength(1)
    expect(await db.select().from(pronoBets).where(eq(pronoBets.playerId, fx.players.playerA))).toHaveLength(1)

    await db.update(groupMemberships).set({ deletedAt: null, role: 'pending_member' }).where(and(
      eq(groupMemberships.groupId, fx.groups.primary),
      eq(groupMemberships.userId, fx.users.playerA),
    ))
    expect(await db.select().from(matchParticipants).where(and(eq(matchParticipants.matchId, fx.matches.valid), eq(matchParticipants.playerId, fx.players.playerA)))).toHaveLength(1)
  })
})

describe('Phase 1 migration conflict preflight fixture', () => {
  it('classifies deterministic duplicate rating IDs before a unique constraint is applied', async () => {
    const conflicts = await db.transaction(async (tx) => {
      await tx.execute(sql`
        CREATE TEMP TABLE phase1_preflight_ratings (
          id uuid PRIMARY KEY,
          match_id uuid,
          rater_player_id uuid,
          rated_player_id uuid
        ) ON COMMIT DROP
      `)
      await tx.execute(sql`
        INSERT INTO phase1_preflight_ratings (id, match_id, rater_player_id, rated_player_id) VALUES
        (${fx.ratings.valid}, ${fx.matches.valid}, ${fx.players.playerA}, ${fx.players.opponentB}),
        (${fx.ratings.duplicate}, ${fx.matches.valid}, ${fx.players.playerA}, ${fx.players.opponentB})
      `)
      return tx.execute(sql`
        SELECT match_id, rater_player_id, rated_player_id, count(*)::int AS duplicate_count,
               array_agg(id ORDER BY id) AS rating_ids
        FROM phase1_preflight_ratings
        GROUP BY match_id, rater_player_id, rated_player_id
        HAVING count(*) > 1
      `)
    })
    expect(conflicts.rows).toEqual([expect.objectContaining({
      duplicate_count: 2,
      rating_ids: [fx.ratings.valid, fx.ratings.duplicate].sort(),
    })])
  })
})
