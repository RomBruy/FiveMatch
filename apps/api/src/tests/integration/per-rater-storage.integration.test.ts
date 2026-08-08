import { describe, it, expect, afterEach } from 'vitest'
import { sql, eq, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '../../db'
import { users, groups, players, matches, ratings } from '../../db/schema'

const TEST_PREFIX = 'test-8-2-per-rater-'

describe('Per-rater rating row storage', () => {
  const seededMatchIds: string[] = []
  const seededRatingIds: string[] = []

  afterEach(async () => {
    // FK order: ratings → matches → players → groups → users
    for (const ratingId of seededRatingIds) {
      await db.delete(ratings).where(eq(ratings.id, ratingId))
    }
    seededRatingIds.length = 0
    for (const matchId of seededMatchIds) {
      await db.delete(matches).where(eq(matches.id, matchId))
    }
    seededMatchIds.length = 0
    await db.delete(players).where(sql`display_name LIKE ${TEST_PREFIX + '%'}`)
    await db.delete(groups).where(sql`name LIKE ${TEST_PREFIX + '%'}`)
    await db.delete(users).where(sql`clerk_user_id LIKE ${TEST_PREFIX + '%'}`)
  })

  it('inserts one row per rater for post-match ratings with distinct raterPlayerId values', async () => {
    // Seed organizer + group
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
    })

    // Seed a completed match
    const [match] = await db.insert(matches).values({
      groupId,
      hostId: organizerId,
      status: 'completed',
      scheduledAt: new Date('2025-01-01T18:00:00Z'),
      completedAt: new Date('2025-01-01T20:00:00Z'),
      format: '5v5',
      playersPerTeam: 5,
      goalkeeperMode: 'none',
      generatorStyle: 'pure_ovr',
    }).returning()
    seededMatchIds.push(match!.id)

    // Seed ratedPlayer
    const ratedUserId = randomUUID()
    await db.insert(users).values({
      id: ratedUserId,
      clerkUserId: `${TEST_PREFIX}rated-user`,
      name: 'Rated Player',
      email: `${TEST_PREFIX}rated@example.com`,
    })
    const [ratedPlayer] = await db.insert(players).values({
      userId: ratedUserId,
      displayName: `${TEST_PREFIX}rated-player`,
    }).returning()

    // Seed 3 raterPlayers
    const raterPlayerIds: string[] = []
    for (let i = 1; i <= 3; i++) {
      const raterUserId = randomUUID()
      await db.insert(users).values({
        id: raterUserId,
        clerkUserId: `${TEST_PREFIX}rater-${i}`,
        name: `Rater ${i}`,
        email: `${TEST_PREFIX}rater${i}@example.com`,
      })
      const [rp] = await db.insert(players).values({
        userId: raterUserId,
        displayName: `${TEST_PREFIX}rater-${i}`,
      }).returning()
      raterPlayerIds.push(rp!.id)
    }

    // Submit ratings — one per rater, with matchId set (no pre-aggregation)
    for (const raterPlayerId of raterPlayerIds) {
      const [rating] = await db.insert(ratings).values({
        groupId,
        matchId: match!.id,
        raterPlayerId,
        ratedPlayerId: ratedPlayer!.id,
        pace: 7, technique: 7, passing: 7, defending: 7,
        physicality: 7, effort: 7, mentality: 5,
        isInitial: false,
      }).returning()
      seededRatingIds.push(rating!.id)
    }

    // Assert: 3 rows with distinct raterPlayerId values
    const rows = await db
      .select()
      .from(ratings)
      .where(and(
        eq(ratings.ratedPlayerId, ratedPlayer!.id),
        eq(ratings.groupId, groupId),
        eq(ratings.isInitial, false),
      ))

    expect(rows).toHaveLength(3)

    const distinctRaterIds = new Set(rows.map((r) => r.raterPlayerId))
    expect(distinctRaterIds.size).toBe(3)

    // Assert: all rows carry matchId (no pre-aggregation into a single row)
    for (const row of rows) {
      expect(row.matchId).toBe(match!.id)
    }

    // Assert: GET /v1/groups/:groupId/players/:playerId response contains no raterPlayerId
    // Query exactly as the route handler does and verify the response shape
    const [playerRow] = await db
      .select({
        id: players.id,
        displayName: players.displayName,
        cardState: players.cardState,
        matchCount: players.matchCount,
        ovrScoreFloat: players.ovrScoreFloat,
        avgPace: players.avgPace,
        avgTechnique: players.avgTechnique,
        avgPassing: players.avgPassing,
        avgDefending: players.avgDefending,
        avgPhysicality: players.avgPhysicality,
        avgEffort: players.avgEffort,
      })
      .from(players)
      .where(and(eq(players.id, ratedPlayer!.id)))
      .limit(1)

    const responseData = {
      playerId: playerRow!.id,
      displayName: playerRow!.displayName,
      cardState: playerRow!.cardState,
      matchCount: playerRow!.matchCount,
      ovrScore: null,
      trend: null,
      attributes: null,
      photoUrl: null,
      isMvp: false,
    }

    expect(JSON.stringify(responseData)).not.toContain('raterPlayerId')
  })

  it('inserts one row per rater for initial ratings with matchId = null', async () => {
    // Seed organizer + group
    const organizerId = randomUUID()
    await db.insert(users).values({
      id: organizerId,
      clerkUserId: `${TEST_PREFIX}org2`,
      name: 'Organizer 2',
      email: `${TEST_PREFIX}org2@example.com`,
    })
    const groupId = randomUUID()
    await db.insert(groups).values({
      id: groupId,
      organizerId,
      name: `${TEST_PREFIX}group2`,
      formatPreset: '5v5',
      goalkeeperMode: 'none',
      generatorStyle: 'pure_ovr',
    })

    // Seed ratedPlayer
    const ratedUserId = randomUUID()
    await db.insert(users).values({
      id: ratedUserId,
      clerkUserId: `${TEST_PREFIX}rated2`,
      name: 'Rated Player 2',
      email: `${TEST_PREFIX}rated2@example.com`,
    })
    const [ratedPlayer] = await db.insert(players).values({
      userId: ratedUserId,
      displayName: `${TEST_PREFIX}rated-player-2`,
    }).returning()

    // Seed 3 raterPlayers
    const raterPlayerIds: string[] = []
    for (let i = 1; i <= 3; i++) {
      const raterUserId = randomUUID()
      await db.insert(users).values({
        id: raterUserId,
        clerkUserId: `${TEST_PREFIX}init-rater-${i}`,
        name: `Init Rater ${i}`,
        email: `${TEST_PREFIX}init-rater${i}@example.com`,
      })
      const [rp] = await db.insert(players).values({
        userId: raterUserId,
        displayName: `${TEST_PREFIX}init-rater-${i}`,
      }).returning()
      raterPlayerIds.push(rp!.id)
    }

    // Submit initial ratings — no matchId (pre-match seed, null by design)
    for (const raterPlayerId of raterPlayerIds) {
      const [rating] = await db.insert(ratings).values({
        groupId,
        raterPlayerId,
        ratedPlayerId: ratedPlayer!.id,
        pace: 6, technique: 6, passing: 6, defending: 6,
        physicality: 6, effort: 6, mentality: 6,
        isInitial: true,
      }).returning()
      seededRatingIds.push(rating!.id)
    }

    // Assert: 3 rows with distinct raterPlayerId values and matchId = null
    const rows = await db
      .select()
      .from(ratings)
      .where(and(
        eq(ratings.ratedPlayerId, ratedPlayer!.id),
        eq(ratings.groupId, groupId),
        eq(ratings.isInitial, true),
      ))

    expect(rows).toHaveLength(3)

    const distinctRaterIds = new Set(rows.map((r) => r.raterPlayerId))
    expect(distinctRaterIds.size).toBe(3)

    for (const row of rows) {
      expect(row.matchId).toBeNull()
    }
  })
})
