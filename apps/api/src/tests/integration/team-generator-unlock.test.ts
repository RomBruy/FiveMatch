import { describe, it, expect, afterEach } from 'vitest'
import { eq, like, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '../../db'
import { users, groups, players, matches, matchAttendances } from '../../db/schema'
import { teamGeneratorService } from '../../services/matches/team-generator.service'
import { TEAM_GEN_MINIMUM_RATED_PLAYERS } from '@fivematch/types/algorithm-constants'

const TEST_PREFIX = 'test-2-5-'

async function seedMatch(organizerSuffix: string): Promise<{ groupId: string; matchId: string }> {
  const organizerUserId = randomUUID()
  await db.insert(users).values({
    id: organizerUserId,
    clerkUserId: `${TEST_PREFIX}organizer-${organizerSuffix}`,
    name: 'Test Organizer',
    email: `${TEST_PREFIX}organizer-${organizerSuffix}@example.com`,
  })

  const groupId = randomUUID()
  await db.insert(groups).values({
    id: groupId,
    organizerId: organizerUserId,
    name: `Test Group ${organizerSuffix}`,
    formatPreset: '5v5',
    goalkeeperMode: 'none',
    generatorStyle: 'pure_ovr',
  })

  const [match] = await db.insert(matches).values({
    groupId,
    hostId: organizerUserId,
    status: 'attendance_open',
    scheduledAt: new Date('2026-09-01T18:00:00Z'),
    format: '5v5',
    playersPerTeam: 5,
    goalkeeperMode: 'none',
  }).returning({ id: matches.id })

  return { groupId, matchId: match!.id }
}

async function seedRatedPlayers(matchId: string, count: number): Promise<string[]> {
  const userIds: string[] = []
  for (let i = 0; i < count; i++) {
    const userId = randomUUID()
    await db.insert(users).values({
      id: userId,
      clerkUserId: `${TEST_PREFIX}player-${matchId}-${i}`,
      name: `Player ${i}`,
      email: `${TEST_PREFIX}player-${matchId}-${i}@example.com`,
    })
    const [player] = await db.insert(players).values({
      userId,
      displayName: `Player ${i}`,
      ovrScoreFloat: '70.000',
    }).returning({ id: players.id })
    await db.insert(matchAttendances).values({
      matchId,
      playerId: player!.id,
      status: 'in',
      source: 'crew',
    })
    userIds.push(userId)
  }
  return userIds
}

async function cleanup(groupId: string): Promise<void> {
  // Players are global now, so they are torn down by the test user prefix
  // rather than by group.
  const testUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(like(users.clerkUserId, `${TEST_PREFIX}%`))
  await db.delete(matches).where(eq(matches.groupId, groupId))
  if (testUsers.length > 0) {
    await db.delete(players).where(inArray(players.userId, testUsers.map((u) => u.id)))
  }
  await db.delete(groups).where(eq(groups.id, groupId))
  await db.delete(users).where(like(users.clerkUserId, `${TEST_PREFIX}%`))
}

describe('team-generator unlock gate', () => {
  const createdGroupIds: string[] = []

  afterEach(async () => {
    for (const groupId of createdGroupIds) {
      await cleanup(groupId)
    }
    createdGroupIds.length = 0
  })

  it('returns canGenerate = false when group has fewer than TEAM_GEN_MINIMUM_RATED_PLAYERS rated players', async () => {
    const suffix = randomUUID()
    const { groupId, matchId } = await seedMatch(suffix)
    createdGroupIds.push(groupId)

    await seedRatedPlayers(matchId, TEAM_GEN_MINIMUM_RATED_PLAYERS - 1)

    const status = await teamGeneratorService.getStatus(matchId)

    expect(status.canGenerate).toBe(false)
    expect(status.reason).toBe('INSUFFICIENT_RATED_PLAYERS')
    expect(status.ratedPlayerCount).toBe(TEAM_GEN_MINIMUM_RATED_PLAYERS - 1)
    expect(status.minimumRequired).toBe(TEAM_GEN_MINIMUM_RATED_PLAYERS)
  })

  it('returns canGenerate = true when group has exactly TEAM_GEN_MINIMUM_RATED_PLAYERS rated players', async () => {
    const suffix = randomUUID()
    const { groupId, matchId } = await seedMatch(suffix)
    createdGroupIds.push(groupId)

    await seedRatedPlayers(matchId, TEAM_GEN_MINIMUM_RATED_PLAYERS)

    const status = await teamGeneratorService.getStatus(matchId)

    expect(status.canGenerate).toBe(true)
    expect(status.reason).toBeNull()
    expect(status.ratedPlayerCount).toBe(TEAM_GEN_MINIMUM_RATED_PLAYERS)
  })
})
