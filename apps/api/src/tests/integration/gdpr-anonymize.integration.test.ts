import { describe, it, expect, afterEach } from 'vitest'
import { sql, eq, inArray, and } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '../../db'
import { users, groups, players, matches, matchParticipants, ratings, cardPhotoJobs, teamGenerationJobs, teamGenerationPlayers, mvpVotes, groupMemberships, pronos } from '../../db/schema'
import { gdprService } from '../../services/gdpr/gdpr.service'
import { GdprPurgeJob } from '../../jobs/gdpr-purge.job'

// TestClock interface — exported so Epic 5 purge job can inject it
// DO NOT modify this interface when implementing Epic 5
export interface TestClock {
  now(): Date
  advance(ms: number): void
}

describe('GDPR cascade anonymization', () => {
  // ─────────────────────────────────────────────────────────────────
  // Epic 1 scope — assertions pass once schema migrations have run
  // ─────────────────────────────────────────────────────────────────
  describe('Epic 1 scope', () => {
    it('users table has nullable deleted_at column', async () => {
      const result = await db.execute(sql`
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'users'
          AND column_name = 'deleted_at'
      `)
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]!['is_nullable']).toBe('YES')
    })

    it('match_participants table has nullable user_id column', async () => {
      const result = await db.execute(sql`
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'match_participants'
          AND column_name = 'user_id'
      `)
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]!['is_nullable']).toBe('YES')
    })

    it('ratings table has nullable rater_player_id column', async () => {
      const result = await db.execute(sql`
        SELECT column_name, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'ratings'
          AND column_name = 'rater_player_id'
      `)
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]!['is_nullable']).toBe('YES')
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // Epic 3 scope — match_participants anonymization on user deletion
  // Turns green in Story 3.1
  // ─────────────────────────────────────────────────────────────────
  describe('Epic 3 scope', () => {
    const TEST_PREFIX = 'test-3-1-gdpr-'
    const seededMatchIds: string[] = []

    afterEach(async () => {
      for (const matchId of seededMatchIds) {
        await db.delete(matchParticipants).where(eq(matchParticipants.matchId, matchId))
        await db.delete(matches).where(eq(matches.id, matchId))
      }
      seededMatchIds.length = 0
      await db.delete(players).where(eq(players.displayName, `${TEST_PREFIX}player`))
      await db.delete(groups).where(sql`name LIKE ${TEST_PREFIX + '%'}`)
      await db.delete(users).where(sql`clerk_user_id LIKE ${TEST_PREFIX + '%'}`)
    })

    it('anonymizes match_participants when user is deleted', async () => {
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

      // Seed the user to be anonymized and their linked player
      const userId = randomUUID()
      await db.insert(users).values({
        id: userId,
        clerkUserId: `${TEST_PREFIX}user`,
        name: 'GDPR User',
        email: `${TEST_PREFIX}user@example.com`,
      })
      const [player] = await db.insert(players).values({
        userId,
        displayName: `${TEST_PREFIX}player`,
        ovrScoreFloat: '70.000',
      }).returning()

      // Seed a match and a participant row for that user
      const [match] = await db.insert(matches).values({
        groupId,
        hostId: organizerId,
        status: 'completed',
        scheduledAt: new Date('2025-01-01T18:00:00Z'),
        format: '5v5',
        playersPerTeam: 5,
        goalkeeperMode: 'none',
        generatorStyle: 'pure_ovr',
      }).returning()
      seededMatchIds.push(match.id)

      await db.insert(matchParticipants).values({
        matchId: match.id,
        playerId: player!.id,
        userId,
        displayName: 'GDPR User',
        teamSide: 'A',
      })

      // Act — anonymize this user's match_participants
      await gdprService.anonymizeMatchParticipants(userId)

      // Assert — userId and playerId nulled, displayName randomized
      const [row] = await db
        .select()
        .from(matchParticipants)
        .where(eq(matchParticipants.matchId, match.id))

      expect(row!.userId).toBeNull()
      expect(row!.playerId).toBeNull()
      expect(row!.displayName).not.toBe('GDPR User')
      expect(row!.displayName).toMatch(/^Joueur_[0-9A-F]{8}$/)
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // Epic 4 scope — ratings hard-deleted on user deletion
  // Turns green in Epic 4
  // ─────────────────────────────────────────────────────────────────
  describe('Epic 4 scope', () => {
    const TEST_PREFIX = 'test-4-4-gdpr-'
    let seededRatingIds: string[] = []

    afterEach(async () => {
      // Clean up in FK dependency order: ratings → players → groups → users
      for (const ratingId of seededRatingIds) {
        await db.delete(ratings).where(eq(ratings.id, ratingId))
      }
      seededRatingIds = []
      await db.delete(players).where(sql`display_name LIKE ${'%' + TEST_PREFIX + '%'}`)
      await db.delete(groups).where(sql`name LIKE ${TEST_PREFIX + '%'}`)
      await db.delete(users).where(sql`clerk_user_id LIKE ${TEST_PREFIX + '%'}`)
    })

    it('hard-deletes all ratings received by deleted user\'s player records', async () => {
      // Seed organizer
      const organizerId = randomUUID()
      await db.insert(users).values({
        id: organizerId,
        clerkUserId: `${TEST_PREFIX}organizer`,
        name: 'Test Organizer 4',
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

      // Seed user to be deleted
      const userId = randomUUID()
      await db.insert(users).values({
        id: userId,
        clerkUserId: `${TEST_PREFIX}user`,
        name: 'GDPR User 4',
        email: `${TEST_PREFIX}user@example.com`,
      })
      const [player] = await db.insert(players).values({
        userId,
        displayName: `${TEST_PREFIX}player`,
      }).returning()

      // Seed a peer who rates the deleted user
      const peerId = randomUUID()
      await db.insert(users).values({
        id: peerId,
        clerkUserId: `${TEST_PREFIX}peer`,
        name: 'Peer User 4',
        email: `${TEST_PREFIX}peer@example.com`,
      })
      const [peerPlayer] = await db.insert(players).values({
        userId: peerId,
        displayName: `${TEST_PREFIX}peer-player`,
      }).returning()

      // Seed rating: peer rated the deleted user (ratedPlayerId = player.id)
      const [rating] = await db.insert(ratings).values({
        groupId,
        ratedPlayerId: player!.id,
        raterPlayerId: peerPlayer!.id,
        pace: 7, technique: 7, passing: 7, defending: 7, physicality: 7, effort: 7, mentality: 7,
        isInitial: true,
      }).returning()
      seededRatingIds.push(rating!.id)

      // Act — delete user's ratings
      await gdprService.deleteUserRatings(userId)

      // Assert — rating hard-deleted
      const remaining = await db
        .select()
        .from(ratings)
        .where(eq(ratings.ratedPlayerId, player!.id))
      expect(remaining).toHaveLength(0)
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // Epic 5 scope — purge job, TestClock injection, team_generation_players
  // Turns green in Epic 5
  // ─────────────────────────────────────────────────────────────────
  describe('Epic 5 scope', () => {
    const TEST_PREFIX = 'test-5-5-gdpr-'
    const seededMatchIds: string[] = []
    const seededJobIds: string[] = []

    afterEach(async () => {
      // Resolve test player IDs first (needed to clean up FK-dependent tables)
      const testUsers = await db.select({ id: users.id }).from(users)
        .where(sql`clerk_user_id LIKE ${TEST_PREFIX + '%'}`)
      const testPlayerRows = testUsers.length > 0
        ? await db.select({ id: players.id }).from(players)
          .where(inArray(players.userId, testUsers.map(u => u.id)))
        : []
      const testPlayerIds = testPlayerRows.map(p => p.id)

      // Deep FK tables first
      if (testPlayerIds.length > 0) {
        await db.delete(cardPhotoJobs).where(inArray(cardPhotoJobs.playerId, testPlayerIds))
        await db.delete(ratings).where(inArray(ratings.ratedPlayerId, testPlayerIds))
      }
      for (const jobId of seededJobIds) {
        await db.delete(teamGenerationPlayers).where(eq(teamGenerationPlayers.jobId, jobId))
        await db.delete(teamGenerationJobs).where(eq(teamGenerationJobs.id, jobId))
      }
      seededJobIds.length = 0
      for (const matchId of seededMatchIds) {
        await db.delete(matchParticipants).where(eq(matchParticipants.matchId, matchId))
        await db.delete(matches).where(eq(matches.id, matchId))
      }
      seededMatchIds.length = 0
      await db.delete(players).where(sql`display_name LIKE ${'%' + TEST_PREFIX + '%'}`)
      await db.delete(groups).where(sql`name LIKE ${TEST_PREFIX + '%'}`)
      await db.delete(users).where(sql`clerk_user_id LIKE ${TEST_PREFIX + '%'}`)
    })

    it('does NOT purge user still within 30-day window', async () => {
      // MockClock: now() returns a fixed timestamp 29 days after deletedAt
      const fixedNow = new Date('2025-03-01T00:00:00Z')
      const deletedAt = new Date(fixedNow.getTime() - 29 * 24 * 60 * 60 * 1000)

      const clock = {
        now: () => fixedNow,
        advance: (_ms: number) => {},
      }

      const organizerId = randomUUID()
      await db.insert(users).values({
        id: organizerId,
        clerkUserId: `${TEST_PREFIX}organizer-5a`,
        name: 'Organizer 5a',
        email: `${TEST_PREFIX}organizer5a@example.com`,
      })
      const groupId = randomUUID()
      await db.insert(groups).values({
        id: groupId,
        organizerId,
        name: `${TEST_PREFIX}group-5a`,
        formatPreset: '5v5',
        goalkeeperMode: 'none',
        generatorStyle: 'pure_ovr',
      })

      const userId = randomUUID()
      await db.insert(users).values({
        id: userId,
        clerkUserId: `${TEST_PREFIX}user-5a`,
        name: 'Purge User 5a',
        email: `${TEST_PREFIX}5a@example.com`,
        deletedAt,
      })

      const purgeJob = new GdprPurgeJob(clock)
      await purgeJob.run()

      const [row] = await db.select({ purgedAt: users.purgedAt }).from(users).where(eq(users.id, userId))
      expect(row!.purgedAt).toBeNull()
    })

    it('purges user past 30-day window and removes associated data', async () => {
      const fixedNow = new Date('2025-03-01T00:00:00Z')
      const deletedAt = new Date(fixedNow.getTime() - 31 * 24 * 60 * 60 * 1000)

      const clock = {
        now: () => fixedNow,
        advance: (_ms: number) => {},
      }

      // Seed organizer + group
      const organizerId = randomUUID()
      await db.insert(users).values({
        id: organizerId,
        clerkUserId: `${TEST_PREFIX}organizer-5b`,
        name: 'Organizer 5b',
        email: `${TEST_PREFIX}organizer5b@example.com`,
      })
      const groupId = randomUUID()
      await db.insert(groups).values({
        id: groupId,
        organizerId,
        name: `${TEST_PREFIX}group-5b`,
        formatPreset: '5v5',
        goalkeeperMode: 'none',
        generatorStyle: 'pure_ovr',
      })

      // Seed the user to be purged + their player record
      const userId = randomUUID()
      await db.insert(users).values({
        id: userId,
        clerkUserId: `${TEST_PREFIX}user-5b`,
        name: 'Purge User 5b',
        email: `${TEST_PREFIX}5b@example.com`,
        deletedAt,
      })
      const [player] = await db.insert(players).values({
        userId,
        displayName: `${TEST_PREFIX}player-5b`,
        ovrScoreFloat: '70.000',
      }).returning()

      // Seed a peer to be the rater
      const peerId = randomUUID()
      await db.insert(users).values({
        id: peerId,
        clerkUserId: `${TEST_PREFIX}peer-5b`,
        name: 'Peer 5b',
        email: `${TEST_PREFIX}peer5b@example.com`,
      })
      const [peerPlayer] = await db.insert(players).values({
        userId: peerId,
        displayName: `${TEST_PREFIX}peer-player-5b`,
      }).returning()

      // Seed a rating (ratedPlayerId = player.id)
      const [rating] = await db.insert(ratings).values({
        groupId,
        ratedPlayerId: player!.id,
        raterPlayerId: peerPlayer!.id,
        pace: 7, technique: 7, passing: 7, defending: 7,
        physicality: 7, effort: 7, mentality: 7,
        isInitial: true,
      }).returning()

      // Seed a match + team_generation_job + team_generation_player
      const [match] = await db.insert(matches).values({
        groupId,
        hostId: organizerId,
        status: 'completed',
        scheduledAt: new Date('2025-01-01T18:00:00Z'),
        format: '5v5',
        playersPerTeam: 5,
        goalkeeperMode: 'none',
        generatorStyle: 'pure_ovr',
      }).returning()
      seededMatchIds.push(match.id)

      const genJobId = randomUUID()
      const [genJob] = await db.insert(teamGenerationJobs).values({
        id: genJobId,
        jobId: `job_${TEST_PREFIX}5b`,
        matchId: match.id,
        groupId,
        status: 'complete',
        generationNumber: 1,
      }).returning()
      seededJobIds.push(genJob.id)

      await db.insert(teamGenerationPlayers).values({
        jobId: genJob.id,
        playerId: player!.id,
        teamSide: 'A',
        ovrAtGeneration: '70',
      })

      // Seed a legacy flat-Pronos prediction. The table is retired but retained
      // (Story 11.7), so an erasure request must still reach its rows.
      await db.insert(pronos).values({
        matchId: match.id,
        playerId: player!.id,
        predictionResult: 'teamA',
        predictionMvpPlayerId: null,
        predictionScore: '2-1',
        pointsEarned: 30,
        submittedAt: new Date('2025-01-01T00:00:00Z'),
      })

      // Seed a card_photo_job
      await db.insert(cardPhotoJobs).values({
        playerId: player!.id,
        groupId,
        state: 'complete',
        idempotencyKey: `${TEST_PREFIX}idem-5b`,
        photoUrl: 'https://example.com/photo.png',
        generationMonth: '2025-01',
      })

      // Act — run the purge job
      const purgeJob = new GdprPurgeJob(clock)
      await purgeJob.run()

      // Assert: ratings deleted
      const remainingRatings = await db
        .select()
        .from(ratings)
        .where(eq(ratings.id, rating!.id))
      expect(remainingRatings).toHaveLength(0)

      // Assert: team_generation_players deleted
      const remainingTgp = await db
        .select()
        .from(teamGenerationPlayers)
        .where(eq(teamGenerationPlayers.jobId, genJob.id))
      expect(remainingTgp).toHaveLength(0)

      // Assert: card_photo_jobs deleted
      const remainingCpj = await db
        .select()
        .from(cardPhotoJobs)
        .where(eq(cardPhotoJobs.playerId, player!.id))
      expect(remainingCpj).toHaveLength(0)

      // Assert: archived legacy pronos rows deleted
      const remainingPronos = await db
        .select()
        .from(pronos)
        .where(eq(pronos.playerId, player!.id))
      expect(remainingPronos).toHaveLength(0)

      // Assert: users.purgedAt is set
      const [userRow] = await db
        .select({ purgedAt: users.purgedAt })
        .from(users)
        .where(eq(users.id, userId))
      expect(userRow!.purgedAt).toStrictEqual(fixedNow)
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // Epic 6 scope — Clerk webhook handler soft-deletes user
  // Turns green in Story 6.4
  // ─────────────────────────────────────────────────────────────────
  describe('Epic 6 scope', () => {
    const TEST_PREFIX = 'test-6-4-gdpr-'

    afterEach(async () => {
      await db.delete(users).where(sql`clerk_user_id LIKE ${TEST_PREFIX + '%'}`)
    })

    it('Clerk webhook handler sets deletedAt on user.deleted event', async () => {
      const clerkUserId = `${TEST_PREFIX}${randomUUID()}`
      const userId = randomUUID()
      await db.insert(users).values({
        id: userId,
        clerkUserId,
        name: 'GDPR Webhook User',
        email: `${TEST_PREFIX}@example.com`,
      })

      // Simulate the webhook handler calling gdprService.softDeleteUser
      await gdprService.softDeleteUser(clerkUserId)

      const [row] = await db
        .select({ deletedAt: users.deletedAt })
        .from(users)
        .where(eq(users.id, userId))

      expect(row!.deletedAt).not.toBeNull()
    })

    it('softDeleteUser is idempotent for non-existent clerkUserId', async () => {
      // Should not throw when clerkUserId does not exist in the database
      await expect(gdprService.softDeleteUser('clerk_nonexistent_user')).resolves.toBeUndefined()
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // Epic 7 scope — full end-to-end GDPR scenario
  // Turns green in Story 7.1 — required before production launch
  // ─────────────────────────────────────────────────────────────────
  describe('Epic 7 scope', () => {
    const TEST_PREFIX = 'test-7-1-gdpr-'
    const seededMatchIds: string[] = []
    const seededJobIds: string[] = []

    afterEach(async () => {
      // Resolve test user IDs first (needed to find FK-dependent rows)
      const testUsers = await db.select({ id: users.id }).from(users)
        .where(sql`clerk_user_id LIKE ${TEST_PREFIX + '%'}`)
      const testUserIds = testUsers.map(u => u.id)

      const testPlayerRows = testUserIds.length > 0
        ? await db.select({ id: players.id }).from(players)
          .where(inArray(players.userId, testUserIds))
        : []
      const testPlayerIds = testPlayerRows.map(p => p.id)

      // Deep FK tables first
      if (testPlayerIds.length > 0) {
        await db.delete(mvpVotes).where(inArray(mvpVotes.voterPlayerId, testPlayerIds))
        await db.delete(mvpVotes).where(inArray(mvpVotes.nominatedPlayerId, testPlayerIds))
        await db.delete(cardPhotoJobs).where(inArray(cardPhotoJobs.playerId, testPlayerIds))
        await db.delete(ratings).where(inArray(ratings.ratedPlayerId, testPlayerIds))
      }
      for (const jobId of seededJobIds) {
        await db.delete(teamGenerationPlayers).where(eq(teamGenerationPlayers.jobId, jobId))
        await db.delete(teamGenerationJobs).where(eq(teamGenerationJobs.id, jobId))
      }
      seededJobIds.length = 0
      for (const matchId of seededMatchIds) {
        await db.delete(matchParticipants).where(eq(matchParticipants.matchId, matchId))
        await db.delete(matches).where(eq(matches.id, matchId))
      }
      seededMatchIds.length = 0
      if (testUserIds.length > 0) {
        await db.delete(groupMemberships).where(inArray(groupMemberships.userId, testUserIds))
      }
      await db.delete(players).where(sql`display_name LIKE ${'%' + TEST_PREFIX + '%'}`)
      await db.delete(groups).where(sql`name LIKE ${TEST_PREFIX + '%'}`)
      await db.delete(users).where(sql`clerk_user_id LIKE ${TEST_PREFIX + '%'}`)
    })

    it('full end-to-end cascade: deletion → anonymization → 30-day purge → tombstone verification', async () => {
      // ── STEP 1: Seed ──────────────────────────────────────────────
      // Organizer
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

      // Organizer membership
      await db.insert(groupMemberships).values({
        groupId,
        userId: organizerId,
        role: 'organizer',
        joinedAt: new Date(),
      })

      // User to be deleted
      const userClerkId = `${TEST_PREFIX}member`
      const userId = randomUUID()
      const deletedAt = new Date('2025-01-01T00:00:00Z')
      await db.insert(users).values({
        id: userId,
        clerkUserId: userClerkId,
        name: 'GDPR Full Test User',
        email: `${TEST_PREFIX}member@example.com`,
      })
      const [player] = await db.insert(players).values({
        userId,
        displayName: `${TEST_PREFIX}player`,
        ovrScoreFloat: '72.000',
        matchCount: 4,
        cardState: 'unlocked',
      }).returning()

      // Member's group_membership
      await db.insert(groupMemberships).values({
        groupId,
        userId,
        role: 'member',
        joinedAt: new Date(),
      })

      // Peer user (rater)
      const peerId = randomUUID()
      await db.insert(users).values({
        id: peerId,
        clerkUserId: `${TEST_PREFIX}peer`,
        name: 'Peer User',
        email: `${TEST_PREFIX}peer@example.com`,
      })
      const [peerPlayer] = await db.insert(players).values({
        userId: peerId,
        displayName: `${TEST_PREFIX}peer-player`,
      }).returning()

      // 1 match with match_participants (player scored 2 goals, 1 assist)
      const [match] = await db.insert(matches).values({
        groupId,
        hostId: organizerId,
        status: 'completed',
        scheduledAt: new Date('2024-12-01T18:00:00Z'),
        format: '5v5',
        playersPerTeam: 5,
        goalkeeperMode: 'none',
        generatorStyle: 'pure_ovr',
      }).returning()
      seededMatchIds.push(match.id)

      await db.insert(matchParticipants).values({
        matchId: match.id,
        playerId: player!.id,
        userId,
        displayName: 'GDPR Full Test User',
        teamSide: 'A',
        goalsScored: 2,
        assists: 1,
      })

      // Rating from peer to deleted user
      const [rating] = await db.insert(ratings).values({
        groupId,
        ratedPlayerId: player!.id,
        raterPlayerId: peerPlayer!.id,
        pace: 8, technique: 7, passing: 6, defending: 5,
        physicality: 7, effort: 8, mentality: 7,
        isInitial: false,
      }).returning()

      // MVP vote (peerPlayer voted for player)
      await db.insert(mvpVotes).values({
        matchId: match.id,
        voterPlayerId: peerPlayer!.id,
        nominatedPlayerId: player!.id,
      })

      // Team generation job + player row
      const genJobId = randomUUID()
      const [genJob] = await db.insert(teamGenerationJobs).values({
        id: genJobId,
        jobId: `job_${TEST_PREFIX}7a`,
        matchId: match.id,
        groupId,
        status: 'complete',
        generationNumber: 1,
      }).returning()
      seededJobIds.push(genJob.id)

      await db.insert(teamGenerationPlayers).values({
        jobId: genJob.id,
        playerId: player!.id,
        teamSide: 'A',
        ovrAtGeneration: '72',
      })

      // ── STEP 2: Immediate cascade (soft-delete) ────────────────────
      await gdprService.softDeleteUser(userClerkId)
      await gdprService.anonymizeMatchParticipants(userId)
      await gdprService.softDeleteGroupMemberships(userId)

      // ── STEP 3: Assert immediate cascade ──────────────────────────
      const [participantRow] = await db
        .select()
        .from(matchParticipants)
        .where(eq(matchParticipants.matchId, match.id))

      expect(participantRow!.userId).toBeNull()
      expect(participantRow!.playerId).toBeNull()
      expect(participantRow!.displayName).toMatch(/^Joueur_[0-9A-F]{8}$/)
      // Historical stats preserved
      expect(participantRow!.goalsScored).toBe(2)
      expect(participantRow!.assists).toBe(1)

      const [membership] = await db
        .select({ deletedAt: groupMemberships.deletedAt })
        .from(groupMemberships)
        .where(
          and(
            eq(groupMemberships.groupId, groupId),
            eq(groupMemberships.userId, userId),
          ),
        )
      expect(membership!.deletedAt).not.toBeNull()

      // ── STEP 4: Assert ratings NOT yet deleted ─────────────────────
      const earlyRatings = await db
        .select()
        .from(ratings)
        .where(eq(ratings.id, rating!.id))
      expect(earlyRatings).toHaveLength(1)

      // ── STEP 5: Advance clock 31 days, run purge job ───────────────
      const purgeNow = new Date(deletedAt.getTime() + 31 * 24 * 60 * 60 * 1000)
      // Set deletedAt directly so the purge window triggers
      await db.update(users).set({ deletedAt }).where(eq(users.id, userId))

      const clock = { now: () => purgeNow, advance: (_ms: number) => {} }
      await new GdprPurgeJob(clock).run()

      // ── STEP 6: Assert post-purge hard-deletes ─────────────────────
      const remainingRatings = await db
        .select()
        .from(ratings)
        .where(eq(ratings.id, rating!.id))
      expect(remainingRatings).toHaveLength(0)

      const remainingTgp = await db
        .select()
        .from(teamGenerationPlayers)
        .where(eq(teamGenerationPlayers.jobId, genJob.id))
      expect(remainingTgp).toHaveLength(0)

      const [userRow] = await db
        .select({ purgedAt: users.purgedAt })
        .from(users)
        .where(eq(users.id, userId))
      expect(userRow!.purgedAt).not.toBeNull()

      // ── STEP 7: Assert tombstone — match_participants still exist ──
      const [tombstone] = await db
        .select()
        .from(matchParticipants)
        .where(eq(matchParticipants.matchId, match.id))
      expect(tombstone).toBeDefined()
      expect(tombstone!.userId).toBeNull()
      expect(tombstone!.goalsScored).toBe(2)
      expect(tombstone!.assists).toBe(1)
    })
  })
})
