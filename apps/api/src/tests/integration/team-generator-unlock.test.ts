import { describe, it, expect, afterEach } from 'vitest'
import { eq, like } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '../../db'
import { users, groups, players } from '../../db/schema'
import { teamGeneratorService } from '../../services/matches/team-generator.service'
import { TEAM_GEN_MINIMUM_RATED_PLAYERS } from '@fivematch/types/algorithm-constants'

const TEST_PREFIX = 'test-2-5-'

async function seedGroup(organizerSuffix: string): Promise<{ groupId: string; organizerUserId: string }> {
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

  return { groupId, organizerUserId }
}

async function seedRatedPlayers(groupId: string, count: number): Promise<string[]> {
  const userIds: string[] = []
  for (let i = 0; i < count; i++) {
    const userId = randomUUID()
    await db.insert(users).values({
      id: userId,
      clerkUserId: `${TEST_PREFIX}player-${groupId}-${i}`,
      name: `Player ${i}`,
      email: `${TEST_PREFIX}player-${groupId}-${i}@example.com`,
    })
    await db.insert(players).values({
      groupId,
      userId,
      displayName: `Player ${i}`,
      ovrScoreFloat: '70.000',
    })
    userIds.push(userId)
  }
  return userIds
}

async function cleanup(groupId: string): Promise<void> {
  await db.delete(players).where(eq(players.groupId, groupId))
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
    const { groupId } = await seedGroup(suffix)
    createdGroupIds.push(groupId)

    await seedRatedPlayers(groupId, TEAM_GEN_MINIMUM_RATED_PLAYERS - 1)

    const status = await teamGeneratorService.getStatus(groupId)

    expect(status.canGenerate).toBe(false)
    expect(status.reason).toBe('INSUFFICIENT_RATED_PLAYERS')
    expect(status.ratedPlayerCount).toBe(TEAM_GEN_MINIMUM_RATED_PLAYERS - 1)
    expect(status.minimumRequired).toBe(TEAM_GEN_MINIMUM_RATED_PLAYERS)
  })

  it('returns canGenerate = true when group has exactly TEAM_GEN_MINIMUM_RATED_PLAYERS rated players', async () => {
    const suffix = randomUUID()
    const { groupId } = await seedGroup(suffix)
    createdGroupIds.push(groupId)

    await seedRatedPlayers(groupId, TEAM_GEN_MINIMUM_RATED_PLAYERS)

    const status = await teamGeneratorService.getStatus(groupId)

    expect(status.canGenerate).toBe(true)
    expect(status.reason).toBeNull()
    expect(status.ratedPlayerCount).toBe(TEAM_GEN_MINIMUM_RATED_PLAYERS)
  })
})
