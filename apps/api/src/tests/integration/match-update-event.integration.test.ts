import { describe, it, expect, afterEach } from 'vitest'
import { eq, and, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '../../db'
import { users, groups, players, matches, matchParticipants, ratings, ratingEvents } from '../../db/schema'
import { ratingService } from '../../services/ratings/rating.service'
import type { MatchUpdateBreakdown } from '@fivematch/types'

const TEST_PREFIX = 'test-8-4-match-update-'

describe('MATCH_UPDATE RatingEvent written after rating window closes', () => {
  const seededMatchIds: string[] = []
  const seededRatingIds: string[] = []
  const seededRatingEventIds: string[] = []

  afterEach(async () => {
    for (const id of seededRatingEventIds) {
      await db.delete(ratingEvents).where(eq(ratingEvents.id, id))
    }
    seededRatingEventIds.length = 0
    for (const id of seededRatingIds) {
      await db.delete(ratings).where(eq(ratings.id, id))
    }
    seededRatingIds.length = 0
    for (const id of seededMatchIds) {
      await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id))
      await db.delete(matches).where(eq(matches.id, id))
    }
    seededMatchIds.length = 0
    await db.delete(players).where(sql`display_name LIKE ${TEST_PREFIX + '%'}`)
    await db.delete(groups).where(sql`name LIKE ${TEST_PREFIX + '%'}`)
    await db.delete(users).where(sql`clerk_user_id LIKE ${TEST_PREFIX + '%'}`)
  })

  it('inserts exactly one MATCH_UPDATE event with correct matchId and newOvr after window closes', async () => {
    const organizerId = randomUUID()
    await db.insert(users).values({
      id: organizerId,
      clerkUserId: `${TEST_PREFIX}organizer`,
      name: 'Test Organizer',
      email: `${TEST_PREFIX}organizer@example.com`,
    })

    const groupId = randomUUID()
    await db.insert(groups).values({
      id: groupId,
      organizerId,
      name: `${TEST_PREFIX}group`,
      formatPreset: '5v5',
      goalkeeperMode: 'none',
      generatorStyle: 'pure_ovr',
      tier: 'club',
    })

    // Rated player with a pre-set OVR
    const ratedUserId = randomUUID()
    await db.insert(users).values({
      id: ratedUserId,
      clerkUserId: `${TEST_PREFIX}rated-user`,
      name: 'Rated Player',
      email: `${TEST_PREFIX}rated@example.com`,
    })
    const [ratedPlayer] = await db.insert(players).values({
      groupId,
      userId: ratedUserId,
      displayName: `${TEST_PREFIX}rated-player`,
      ovrScoreFloat: '70.000',
      matchCount: 5,
    }).returning()

    // Completed match, rating window still open
    const [match] = await db.insert(matches).values({
      groupId,
      organizerId,
      status: 'completed',
      scheduledAt: new Date('2025-06-01T18:00:00Z'),
      completedAt: new Date('2025-06-01T20:00:00Z'),
      format: '5v5',
      playersPerTeam: 5,
      goalkeeperMode: 'none',
      generatorStyle: 'pure_ovr',
      // runPostMatchUpdate requires a recorded result — it returns early on null scores
      scoreA: 4,
      scoreB: 2,
    }).returning()
    seededMatchIds.push(match!.id)

    // Participant entry for the rated player
    await db.insert(matchParticipants).values({
      matchId: match!.id,
      playerId: ratedPlayer!.id,
      userId: ratedUserId,
      displayName: `${TEST_PREFIX}rated-player`,
      teamSide: 'A',
      goalsScored: 0,
      assists: 0,
    })

    // 3 rater users + players + post-match ratings
    for (let i = 1; i <= 3; i++) {
      const raterUserId = randomUUID()
      await db.insert(users).values({
        id: raterUserId,
        clerkUserId: `${TEST_PREFIX}rater-${i}`,
        name: `Rater ${i}`,
        email: `${TEST_PREFIX}rater${i}@example.com`,
      })
      const [raterPlayer] = await db.insert(players).values({
        groupId,
        userId: raterUserId,
        displayName: `${TEST_PREFIX}rater-${i}`,
      }).returning()

      const [rating] = await db.insert(ratings).values({
        groupId,
        matchId: match!.id,
        raterPlayerId: raterPlayer!.id,
        ratedPlayerId: ratedPlayer!.id,
        pace: 7, technique: 7, passing: 7, defending: 7,
        physicality: 7, effort: 7, mentality: 5,
        isInitial: false,
      }).returning()
      seededRatingIds.push(rating!.id)
    }

    // Close the rating window — triggers runPostMatchUpdate → writes MATCH_UPDATE event
    await ratingService.closeWindow(match!.id)

    // Collect written rating_events for cleanup
    const writtenEvents = await db
      .select({ id: ratingEvents.id })
      .from(ratingEvents)
      .where(and(
        eq(ratingEvents.playerId, ratedPlayer!.id),
        eq(ratingEvents.eventType, 'MATCH_UPDATE'),
      ))
    for (const e of writtenEvents) seededRatingEventIds.push(e.id)

    // Assert: exactly one MATCH_UPDATE event
    expect(writtenEvents).toHaveLength(1)

    // Assert: full event shape
    const [event] = await db
      .select()
      .from(ratingEvents)
      .where(eq(ratingEvents.id, writtenEvents[0]!.id))

    expect(event!.eventType).toBe('MATCH_UPDATE')
    expect(event!.seedStatus).toBeNull()

    const breakdown = event!.breakdown as unknown as MatchUpdateBreakdown
    expect(breakdown.matchId).toBe(match!.id)

    // new_ovr stored as numeric string and matches updated player OVR
    expect(typeof event!.newOvr).toBe('string')
    const parsedNewOvr = parseFloat(event!.newOvr)
    expect(parsedNewOvr).toBeGreaterThanOrEqual(40)
    expect(parsedNewOvr).toBeLessThanOrEqual(99)

    const [updatedPlayer] = await db
      .select({ ovrScoreFloat: players.ovrScoreFloat, lastMatchAt: players.lastMatchAt })
      .from(players)
      .where(eq(players.id, ratedPlayer!.id))
    expect(parseFloat(updatedPlayer!.ovrScoreFloat!)).toBeCloseTo(parsedNewOvr, 5)
    expect(updatedPlayer!.lastMatchAt).not.toBeNull()
  })
})
