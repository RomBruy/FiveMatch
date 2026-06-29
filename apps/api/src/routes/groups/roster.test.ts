import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import router from './index'

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
  groupMemberships: { groupId: 'group_id', userId: 'user_id', role: 'role', createdAt: 'created_at', deletedAt: 'deleted_at', joinedAt: 'joined_at' },
  players: { id: 'id', groupId: 'group_id', userId: 'user_id', displayName: 'display_name', matchCount: 'match_count', deletedAt: 'deleted_at' },
}))

vi.mock('../../middleware/require-group-member', () => ({
  requireGroupMember: vi.fn(
    (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.user.internalId = 'organizer-uuid-1'
      req.user.groupRole = 'organizer'
      next()
    },
  ),
}))

vi.mock('../../services/notifications/notification.service', () => ({
  notificationService: { send: vi.fn() },
}))

import { db } from '../../db'

function makeSelectInnerJoinLeftJoinWhere(resolved: unknown[]) {
  const chain = { from: vi.fn(), innerJoin: vi.fn(), leftJoin: vi.fn(), where: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.innerJoin.mockReturnValue(chain)
  chain.leftJoin.mockReturnValue(chain)
  chain.where.mockResolvedValue(resolved)
  return chain
}

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { userId: 'clerk-user-1' } as express.Request['user']
    next()
  })
  app.use('/', router)
  return app
}

describe('GET /:groupId/roster', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 200 with member list for organizer', async () => {
    const mockItems = [
      { userId: 'member-uuid-1', displayName: 'Alice', joinedAt: '2026-01-01T00:00:00Z', matchCount: 3, role: 'member' },
      { userId: 'organizer-uuid-1', displayName: 'Bob', joinedAt: '2025-12-01T00:00:00Z', matchCount: null, role: 'organizer' },
    ]
    vi.mocked(db.select).mockReturnValueOnce(makeSelectInnerJoinLeftJoinWhere(mockItems) as unknown as ReturnType<typeof db.select>)

    const app = makeApp()
    const res = await request(app).get('/group-123/roster')

    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(2)
    expect(res.body.data.items[0].displayName).toBe('Alice')
  })

  it('returns 403 for pending_member (blocked by requireGroupMember)', async () => {
    const { requireGroupMember } = await import('../../middleware/require-group-member')
    vi.mocked(requireGroupMember).mockImplementationOnce(
      (_req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(403).json({ error: { code: 'NOT_A_MEMBER', statusCode: 403 } })
      },
    )

    const app = makeApp()
    const res = await request(app).get('/group-123/roster')

    expect(res.status).toBe(403)
  })
})
