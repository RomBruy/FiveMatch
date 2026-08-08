import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
  },
}))

vi.mock('../../db/schema', () => ({
  ACTIVE_CREW_ROLES: ['organizer', 'co_host', 'member'],
  users: { id: 'id', clerkUserId: 'clerk_user_id' },
  groups: { id: 'id', name: 'name', tier: 'tier' },
  groupMemberships: { role: 'role', userId: 'user_id', groupId: 'group_id' },
  pushTokens: { userId: 'user_id', token: 'token' },
  notificationPreferences: { userId: 'user_id', type: 'type', enabled: 'enabled' },
  NOTIFICATION_TYPES: [
    'JOIN_REQUEST_RECEIVED', 'JOIN_APPROVED', 'JOIN_REJECTED',
    'ATTENDANCE_REMINDER', 'MATCH_FULL', 'WAITLIST_SPOT_OPEN',
    'TEAMS_LOCKED', 'SCORE_SUBMITTED', 'MVP_VOTING_OPEN',
    'MVP_VOTING_REMINDER', 'CARD_UNLOCKED', 'PRONOS_WINDOW_OPEN',
    'PRONOS_REVEALED', 'PLAYER_TIER_CHANGED', 'RATING_REMINDER',
    'ORGANIZER_TRANSFERRED',
  ],
}))

import { db } from '../../db'
import usersRouter from './index'

function buildApp(userId = 'clerk_user_abc') {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    ;(req as express.Request & { user: { userId: string } }).user = { userId }
    next()
  })
  app.use('/users', usersRouter)
  return app
}

describe('GET /users/me/groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns groups the user belongs to', async () => {
    const mockGroup = {
      id: 'group-uuid-1',
      name: 'Les Potes FC',
      tier: 'amateur',
      matchCount: 0,
      formatPreset: '5v5',
      goalkeeperMode: 'fixed',
      playStyle: null,
      generatorStyle: 'pure_ovr',
      organizerId: 'internal-uuid-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // First select: look up user by clerkUserId
    const userSelectChain = { from: vi.fn(), where: vi.fn() }
    userSelectChain.from.mockReturnValue(userSelectChain)
    userSelectChain.where.mockResolvedValueOnce([{ id: 'internal-uuid-1' }])

    // Second select: fetch memberships
    const membershipSelectChain = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn() }
    membershipSelectChain.from.mockReturnValue(membershipSelectChain)
    membershipSelectChain.innerJoin.mockReturnValue(membershipSelectChain)
    membershipSelectChain.where.mockResolvedValueOnce([{ group: mockGroup, role: 'organizer' }])

    vi.mocked(db.select)
      .mockReturnValueOnce(userSelectChain as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce(membershipSelectChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/users/me/groups')

    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.items[0].name).toBe('Les Potes FC')
    expect(res.body.data.items[0].userRole).toBe('organizer')
  })

  it('returns empty items array when user not found in DB', async () => {
    const selectChain = { from: vi.fn(), where: vi.fn() }
    selectChain.from.mockReturnValue(selectChain)
    selectChain.where.mockResolvedValue([])
    vi.mocked(db.select).mockReturnValue(selectChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/users/me/groups')

    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(0)
  })
})
