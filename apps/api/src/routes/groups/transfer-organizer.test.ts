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
  ACTIVE_CREW_ROLES: ['organizer', 'co_host', 'member'],
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
import { notificationService } from '../../services/notifications/notification.service'
import { errorHandler } from '../../middleware/error-handler'

function makeSelectLimit(resolved: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.limit.mockResolvedValue(resolved)
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
  app.use(errorHandler)
  return app
}

const VALID_MEMBER_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

describe('POST /:groupId/transfer-organizer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('organizer transfers role — returns 200 { transferred: true } and sends notification', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectLimit([{ userId: VALID_MEMBER_UUID }]) as unknown as ReturnType<typeof db.select>,
    )
    vi.mocked(db.transaction).mockImplementationOnce(async (cb) => {
      const mockTx = {
        update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
      }
      return cb(mockTx as unknown as Parameters<typeof cb>[0])
    })

    const app = makeApp()
    const res = await request(app)
      .post('/group-123/transfer-organizer')
      .send({ newOrganizerId: VALID_MEMBER_UUID })

    expect(res.status).toBe(200)
    expect(res.body.data.transferred).toBe(true)
    expect(vi.mocked(notificationService.send)).toHaveBeenCalledWith({
      type: 'ORGANIZER_TRANSFERRED',
      groupId: 'group-123',
      recipientUserId: VALID_MEMBER_UUID,
    })
  })

  it('non-organizer (member) is blocked — returns 403', async () => {
    const { requireGroupMember } = await import('../../middleware/require-group-member')
    vi.mocked(requireGroupMember).mockImplementationOnce(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user.internalId = 'member-uuid-2'
        req.user.groupRole = 'member'
        next()
      },
    )

    const app = makeApp()
    const res = await request(app)
      .post('/group-123/transfer-organizer')
      .send({ newOrganizerId: VALID_MEMBER_UUID })

    expect(res.status).toBe(403)
  })

  it('returns 404 if target is not an active member', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectLimit([]) as unknown as ReturnType<typeof db.select>,
    )

    const app = makeApp()
    const res = await request(app)
      .post('/group-123/transfer-organizer')
      .send({ newOrganizerId: VALID_MEMBER_UUID })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('MEMBER_NOT_FOUND')
  })

  it('returns 400 (ZodError) if target is already the organizer (non-UUID body)', async () => {
    const app = makeApp()
    const res = await request(app)
      .post('/group-123/transfer-organizer')
      .send({ newOrganizerId: 'not-a-uuid' })

    expect(res.status).toBe(400)
  })
})
