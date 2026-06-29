import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock('../../db/schema', () => ({
  users: { id: 'id', clerkUserId: 'clerk_user_id', name: 'name' },
  groups: { id: 'id', name: 'name', organizerId: 'organizer_id', inviteCode: 'invite_code', searchable: 'searchable', tier: 'tier' },
  groupMemberships: { groupId: 'group_id', userId: 'user_id', role: 'role', createdAt: 'created_at' },
  players: { id: 'id', groupId: 'group_id', userId: 'user_id', displayName: 'display_name', matchCount: 'match_count' },
}))

vi.mock('../../middleware/require-group-member', () => ({
  requireGroupMember: vi.fn(
    (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.user.internalId = 'internal-uuid-1'
      req.user.groupRole = 'organizer'
      next()
    },
  ),
}))

vi.mock('../../services/notifications/notification.service', () => ({
  notificationService: { send: vi.fn() },
}))

import { db } from '../../db'
import { requireGroupMember } from '../../middleware/require-group-member'
import groupsRouter from './index'

function buildApp(userId = 'clerk_user_abc', groupRole: 'organizer' | 'member' = 'organizer') {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    ;(req as express.Request & { user: { userId: string; internalId?: string; groupRole?: string } }).user = {
      userId,
      internalId: 'internal-uuid-1',
      groupRole,
    }
    next()
  })
  app.use('/groups', groupsRouter)
  return app
}

describe('POST /groups/:groupId/invite/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireGroupMember).mockImplementation(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user.internalId = 'internal-uuid-1'
        req.user.groupRole = 'organizer'
        next()
      },
    )
  })

  it('organizer generates invite code (200, returns code and link)', async () => {
    const updateChain = { set: vi.fn(), where: vi.fn(), returning: vi.fn() }
    updateChain.set.mockReturnValue(updateChain)
    updateChain.where.mockReturnValue(updateChain)
    updateChain.returning.mockResolvedValue([{ inviteCode: 'A3B7X2C9' }])
    vi.mocked(db.update).mockReturnValue(updateChain as unknown as ReturnType<typeof db.update>)

    const res = await request(buildApp()).post('/groups/group-uuid-1/invite/generate')

    expect(res.status).toBe(200)
    expect(res.body.data.inviteCode).toMatch(/^[A-Z2-9]{8}$/)
    expect(res.body.data.inviteLink).toMatch(/^fivematch:\/\/join\//)
  })

  it('member is blocked (403 FORBIDDEN)', async () => {
    vi.mocked(requireGroupMember).mockImplementation(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user.internalId = 'internal-uuid-1'
        req.user.groupRole = 'member'
        next()
      },
    )

    const res = await request(buildApp('clerk_member', 'member')).post('/groups/group-uuid-1/invite/generate')

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('regenerating creates a new invite code', async () => {
    const firstCode = 'FIRSTCD1'
    const secondCode = 'SECOND22'

    const updateChain = { set: vi.fn(), where: vi.fn(), returning: vi.fn() }
    updateChain.set.mockReturnValue(updateChain)
    updateChain.where.mockReturnValue(updateChain)
    updateChain.returning
      .mockResolvedValueOnce([{ inviteCode: firstCode }])
      .mockResolvedValueOnce([{ inviteCode: secondCode }])
    vi.mocked(db.update).mockReturnValue(updateChain as unknown as ReturnType<typeof db.update>)

    const res1 = await request(buildApp()).post('/groups/group-uuid-1/invite/generate')
    const res2 = await request(buildApp()).post('/groups/group-uuid-1/invite/generate')

    expect(res1.body.data.inviteCode).toBe(firstCode)
    expect(res2.body.data.inviteCode).toBe(secondCode)
    expect(res1.body.data.inviteCode).not.toBe(res2.body.data.inviteCode)
  })
})

describe('GET /groups/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array when query is too short', async () => {
    const res = await request(buildApp()).get('/groups/search?q=a')

    expect(res.status).toBe(200)
    expect(res.body.data.items).toEqual([])
  })

  it('returns matching searchable groups', async () => {
    const selectChain = { from: vi.fn(), where: vi.fn(), limit: vi.fn() }
    selectChain.from.mockReturnValue(selectChain)
    selectChain.where.mockReturnValue(selectChain)
    selectChain.limit.mockResolvedValue([{ id: 'group-1', name: 'Les Potes FC', tier: 'amateur' }])
    vi.mocked(db.select).mockReturnValue(selectChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/groups/search?q=potes')

    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.items[0].name).toBe('Les Potes FC')
  })

  it('returns empty array when no query provided', async () => {
    const res = await request(buildApp()).get('/groups/search')

    expect(res.status).toBe(200)
    expect(res.body.data.items).toEqual([])
  })
})
