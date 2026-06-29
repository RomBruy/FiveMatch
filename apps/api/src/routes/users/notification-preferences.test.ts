import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}))

vi.mock('../../db/schema', () => ({
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
import { errorHandler } from '../../middleware/error-handler'
import usersRouter from './index'

function buildApp(userId = 'clerk_user_abc') {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    ;(req as express.Request & { user: { userId: string } }).user = { userId }
    next()
  })
  app.use('/users', usersRouter)
  app.use(errorHandler)
  return app
}

function makeSelectLimit(resolved: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.limit.mockResolvedValue(resolved)
  return chain
}

function makeSelectWhere(resolved: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.where.mockResolvedValue(resolved)
  return chain
}

function makeInsertConflictChain() {
  const chain = { values: vi.fn(), onConflictDoUpdate: vi.fn() }
  chain.values.mockReturnValue(chain)
  chain.onConflictDoUpdate.mockResolvedValue([])
  return chain
}

describe('GET /users/me/notification-preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns all 16 notification types with enabled: true when no stored preferences', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectLimit([{ id: 'internal-uuid-1' }]) as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce(makeSelectWhere([]) as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/users/me/notification-preferences')

    expect(res.status).toBe(200)
    expect(res.body.data.preferences).toHaveLength(16)
    expect(res.body.data.preferences.every((p: { enabled: boolean }) => p.enabled === true)).toBe(true)
  })

  it('returns stored enabled: false for a type', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectLimit([{ id: 'internal-uuid-1' }]) as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce(makeSelectWhere([
        { type: 'JOIN_REQUEST_RECEIVED', enabled: false },
      ]) as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/users/me/notification-preferences')

    expect(res.status).toBe(200)
    const joinRequestPref = res.body.data.preferences.find(
      (p: { type: string }) => p.type === 'JOIN_REQUEST_RECEIVED',
    )
    expect(joinRequestPref?.enabled).toBe(false)
    const otherPref = res.body.data.preferences.find(
      (p: { type: string }) => p.type === 'JOIN_APPROVED',
    )
    expect(otherPref?.enabled).toBe(true)
  })

  it('returns 404 when user not found', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectLimit([]) as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/users/me/notification-preferences')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('USER_NOT_FOUND')
  })
})

describe('PATCH /users/me/notification-preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stores preference and returns 200', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectLimit([{ id: 'internal-uuid-1' }]) as unknown as ReturnType<typeof db.select>)
    vi.mocked(db.insert).mockReturnValueOnce(makeInsertConflictChain() as unknown as ReturnType<typeof db.insert>)

    const res = await request(buildApp())
      .patch('/users/me/notification-preferences')
      .send({ type: 'JOIN_REQUEST_RECEIVED', enabled: false })

    expect(res.status).toBe(200)
    expect(res.body.data.type).toBe('JOIN_REQUEST_RECEIVED')
    expect(res.body.data.enabled).toBe(false)
  })

  it('returns 400 for invalid notification type', async () => {
    const res = await request(buildApp())
      .patch('/users/me/notification-preferences')
      .send({ type: 'INVALID_TYPE', enabled: false })

    expect(res.status).toBe(400)
  })

  it('returns 404 when user not found', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectLimit([]) as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp())
      .patch('/users/me/notification-preferences')
      .send({ type: 'JOIN_APPROVED', enabled: true })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('USER_NOT_FOUND')
  })
})
