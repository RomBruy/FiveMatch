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
  ACTIVE_CREW_ROLES: ['organizer', 'co_host', 'member'],
  users: { id: 'id', clerkUserId: 'clerk_user_id', name: 'name' },
  groups: { id: 'id', name: 'name', organizerId: 'organizer_id', inviteCode: 'invite_code', searchable: 'searchable', tier: 'tier' },
  groupMemberships: { groupId: 'group_id', userId: 'user_id', role: 'role', createdAt: 'created_at', deletedAt: 'deleted_at', joinedAt: 'joined_at' },
  players: { id: 'id', userId: 'user_id', displayName: 'display_name', matchCount: 'match_count', deletedAt: 'deleted_at' },
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
import { requireGroupMember } from '../../middleware/require-group-member'
import { notificationService } from '../../services/notifications/notification.service'
import groupsRouter from './index'

function buildApp(groupRole: 'organizer' | 'member' = 'organizer') {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    ;(req as express.Request & { user: { userId: string; internalId?: string; groupRole?: string } }).user = {
      userId: 'clerk_organizer',
      internalId: 'organizer-uuid-1',
      groupRole,
    }
    next()
  })
  app.use('/groups', groupsRouter)
  return app
}

function makeSelectWhere(resolved: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.where.mockResolvedValue(resolved)
  return chain
}

function makeSelectLimit(resolved: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.limit.mockResolvedValue(resolved)
  return chain
}

describe('POST /groups/:groupId/members/:userId/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireGroupMember).mockImplementation(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user.internalId = 'organizer-uuid-1'
        req.user.groupRole = 'organizer'
        next()
      },
    )
  })

  it('organizer approves pending member (200), creates player record', async () => {
    // select 1: pending row check
    const pendingChain = makeSelectLimit([{ userId: 'target-uuid-1' }])
    // select 2: group lookup for notification
    const groupChain = makeSelectWhere([{ name: 'Les Potes FC' }])

    vi.mocked(db.select)
      .mockReturnValueOnce(pendingChain as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce(groupChain as unknown as ReturnType<typeof db.select>)

    let playerInsertCalled = false
    let membershipUpdated = false

    vi.mocked(db.transaction).mockImplementation(async (cb) => {
      const mockTx = {
        update: vi.fn(() => {
          const chain = { set: vi.fn(), where: vi.fn() }
          chain.set.mockReturnValue(chain)
          chain.where.mockImplementation(() => {
            membershipUpdated = true
            return Promise.resolve()
          })
          return chain
        }),
        select: vi.fn(() => {
          // Only the targetUser lookup survives — approving no longer probes for
          // an existing player row, it upserts the global identity.
          const chain = { from: vi.fn(), where: vi.fn() }
          chain.from.mockReturnValue(chain)
          chain.where.mockResolvedValue([{ name: 'Marcus' }])
          return chain
        }),
        insert: vi.fn(() => {
          const chain = { values: vi.fn() }
          chain.values.mockReturnValue({
            onConflictDoNothing: vi.fn().mockImplementation(() => {
              playerInsertCalled = true
              return Promise.resolve()
            }),
          })
          return chain
        }),
      }
      return cb(mockTx as unknown as Parameters<typeof cb>[0])
    })

    const res = await request(buildApp()).post('/groups/group-uuid-1/members/target-uuid-1/approve')

    expect(res.status).toBe(200)
    expect(res.body.data.approved).toBe(true)
    expect(playerInsertCalled).toBe(true)
    expect(membershipUpdated).toBe(true)
    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'JOIN_APPROVED' }),
    )
  })

  it('member is blocked (403 FORBIDDEN)', async () => {
    vi.mocked(requireGroupMember).mockImplementation(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user.internalId = 'member-uuid-1'
        req.user.groupRole = 'member'
        next()
      },
    )

    const res = await request(buildApp('member')).post('/groups/group-uuid-1/members/target-uuid-1/approve')

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('returns 404 when no pending request found', async () => {
    const pendingChain = makeSelectLimit([]) // no pending row

    vi.mocked(db.select).mockReturnValueOnce(pendingChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).post('/groups/group-uuid-1/members/nonexistent-uuid/approve')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('USER_NOT_FOUND')
  })
})

describe('POST /groups/:groupId/members/:userId/reject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireGroupMember).mockImplementation(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user.internalId = 'organizer-uuid-1'
        req.user.groupRole = 'organizer'
        next()
      },
    )
  })

  it('organizer rejects pending member (200), deletes membership row', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectLimit([{ userId: 'target-user-uuid-1' }]) as unknown as ReturnType<typeof db.select>,
    )
    const deleteChain = { where: vi.fn() }
    deleteChain.where.mockResolvedValue(undefined)
    vi.mocked(db.delete).mockReturnValue(deleteChain as unknown as ReturnType<typeof db.delete>)

    const res = await request(buildApp()).post('/groups/group-uuid-1/members/target-uuid-1/reject')

    expect(res.status).toBe(200)
    expect(res.body.data.rejected).toBe(true)
    expect(db.delete).toHaveBeenCalled()
    expect(notificationService.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'JOIN_REJECTED' }),
    )
  })

  it('member is blocked from rejecting (403 FORBIDDEN)', async () => {
    vi.mocked(requireGroupMember).mockImplementation(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user.internalId = 'member-uuid-1'
        req.user.groupRole = 'member'
        next()
      },
    )

    const res = await request(buildApp('member')).post('/groups/group-uuid-1/members/target-uuid-1/reject')

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })
})

describe('GET /groups/:groupId/join-requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireGroupMember).mockImplementation(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user.internalId = 'organizer-uuid-1'
        req.user.groupRole = 'organizer'
        next()
      },
    )
  })

  it('organizer gets list of pending join requests', async () => {
    const chain = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn() }
    chain.from.mockReturnValue(chain)
    chain.innerJoin.mockReturnValue(chain)
    chain.where.mockResolvedValue([
      { userId: 'user-uuid-1', displayName: 'Marcus', requestedAt: new Date().toISOString() },
    ])

    vi.mocked(db.select).mockReturnValue(chain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/groups/group-uuid-1/join-requests')

    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.items[0].displayName).toBe('Marcus')
  })

  it('member is blocked from viewing join requests (403)', async () => {
    vi.mocked(requireGroupMember).mockImplementation(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user.internalId = 'member-uuid-1'
        req.user.groupRole = 'member'
        next()
      },
    )

    const res = await request(buildApp('member')).get('/groups/group-uuid-1/join-requests')

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })
})
