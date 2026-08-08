import { describe, it, expect, afterEach, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { eq, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '../../db'
import { users, groups, players, matches, matchParticipants, teamGenerationJobs } from '../../db/schema'

vi.mock('../../services/notifications/notification.service', () => ({
  notificationService: { send: vi.fn() },
}))

import matchesRouter from '../../routes/matches'

const TEST_PREFIX = 'test-9-8-fairness-'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = {
      userId: `${TEST_PREFIX}clerk`,
      internalId: (globalThis as Record<string, unknown>)['__testInternalId'] as string,
    } as express.Request['user']
    next()
  })
  app.use('/matches', matchesRouter)
  return app
}

describe('GET /:matchId/participants — fairnessScore of the locked split', () => {
  const seededMatchIds: string[] = []

  afterEach(async () => {
    for (const id of seededMatchIds) {
      await db.delete(teamGenerationJobs).where(eq(teamGenerationJobs.matchId, id))
      await db.delete(matchParticipants).where(eq(matchParticipants.matchId, id))
      await db.delete(matches).where(eq(matches.id, id))
    }
    seededMatchIds.length = 0
    await db.delete(players).where(sql`display_name LIKE ${TEST_PREFIX + '%'}`)
    await db.delete(groups).where(sql`name LIKE ${TEST_PREFIX + '%'}`)
    await db.delete(users).where(sql`clerk_user_id LIKE ${TEST_PREFIX + '%'}`)
  })

  async function seedLockedMatch(jobs: Array<{ generationNumber: number; fairnessScore: string | null }>) {
    const organizerId = randomUUID()
    await db.insert(users).values({
      id: organizerId,
      clerkUserId: `${TEST_PREFIX}organizer-${organizerId}`,
      name: 'Test Organizer',
      email: `${TEST_PREFIX}${organizerId}@example.com`,
    })
    ;(globalThis as Record<string, unknown>)['__testInternalId'] = organizerId

    const groupId = randomUUID()
    await db.insert(groups).values({
      id: groupId,
      organizerId,
      name: `${TEST_PREFIX}group-${groupId}`,
      formatPreset: '5v5',
      goalkeeperMode: 'none',
      generatorStyle: 'pure_ovr',
    })

    const [playerA] = await db.insert(players).values({
      userId: organizerId,
      displayName: `${TEST_PREFIX}player-a`,
    }).returning()

    const [match] = await db.insert(matches).values({
      groupId,
      hostId: organizerId,
      status: 'in_progress',
      scheduledAt: new Date('2026-07-01T18:00:00Z'),
      format: '5v5',
      playersPerTeam: 5,
      goalkeeperMode: 'none',
    }).returning()
    seededMatchIds.push(match!.id)

    await db.insert(matchParticipants).values([
      { matchId: match!.id, playerId: playerA!.id, userId: organizerId, displayName: `${TEST_PREFIX}player-a`, teamSide: 'A' },
      { matchId: match!.id, playerId: null, userId: null, displayName: `${TEST_PREFIX}player-b`, teamSide: 'B' },
    ])

    for (const job of jobs) {
      await db.insert(teamGenerationJobs).values({
        jobId: `${TEST_PREFIX}job-${randomUUID()}`,
        matchId: match!.id,
        groupId,
        status: 'complete',
        generationNumber: job.generationNumber,
        fairnessScore: job.fairnessScore,
      })
    }

    return { matchId: match!.id }
  }

  it('returns the fairnessScore of the latest completed generation job as a number', async () => {
    const { matchId } = await seedLockedMatch([
      { generationNumber: 1, fairnessScore: '12.5' },
      { generationNumber: 2, fairnessScore: '3.25' },
    ])

    const res = await request(makeApp()).get(`/matches/${matchId}/participants`)

    expect(res.status).toBe(200)
    expect(res.body.data.fairnessScore).toBe(3.25)
    expect(res.body.data.teamA).toHaveLength(1)
    expect(res.body.data.teamB).toHaveLength(1)
  })

  it('returns fairnessScore null when no completed generation job exists', async () => {
    const { matchId } = await seedLockedMatch([])

    const res = await request(makeApp()).get(`/matches/${matchId}/participants`)

    expect(res.status).toBe(200)
    expect(res.body.data.fairnessScore).toBeNull()
  })
})
