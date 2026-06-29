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
  matches: { id: 'id', groupId: 'group_id' },
  matchParticipants: { id: 'id', matchId: 'match_id', userId: 'user_id', playerId: 'player_id', displayName: 'display_name' },
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

function makeSelectWhere(resolved: unknown[]) {
  const chain = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.innerJoin.mockReturnValue(chain)
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

function makeUpdateReturning(resolved: unknown[]) {
  const returning = vi.fn().mockResolvedValue(resolved)
  const where = vi.fn().mockReturnValue({ returning })
  const set = vi.fn().mockReturnValue({ where })
  return { set }
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

describe('DELETE /:groupId/members/:userId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('organizer removes a member — returns 200 { removed: true }', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectLimit([{ userId: 'member-uuid-1', role: 'member' }]) as unknown as ReturnType<typeof db.select>,
    )
    vi.mocked(db.transaction).mockImplementationOnce(async (cb) => {
      const mockTx = {
        update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      }
      return cb(mockTx as unknown as Parameters<typeof cb>[0])
    })

    const app = makeApp()
    const res = await request(app).delete('/group-123/members/member-uuid-1')

    expect(res.status).toBe(200)
    expect(res.body.data.removed).toBe(true)
  })

  it('organizer cannot remove themselves — returns 403', async () => {
    const app = makeApp()
    const res = await request(app).delete('/group-123/members/organizer-uuid-1')

    expect(res.status).toBe(403)
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
    const res = await request(app).delete('/group-123/members/member-uuid-1')

    expect(res.status).toBe(403)
  })

  it('returns 404 for non-member target', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      makeSelectLimit([]) as unknown as ReturnType<typeof db.select>,
    )

    const app = makeApp()
    const res = await request(app).delete('/group-123/members/unknown-uuid')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('MEMBER_NOT_FOUND')
  })

  it('join without soft-delete returns 409 (active member cannot re-join)', async () => {
    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectWhere([{ id: 'user-uuid-1' }]) as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce(makeSelectLimit([{ role: 'member', deletedAt: null }]) as unknown as ReturnType<typeof db.select>)

    const app = makeApp()
    const res = await request(app).post('/group-123/join')

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('ALREADY_A_MEMBER')
  })

  it('re-join after soft-delete creates pending_member — returns 201', async () => {
    const softDeletedMembership = { role: 'member', deletedAt: new Date().toISOString() }
    const revivedMembership = { groupId: 'group-123', userId: 'user-uuid-1', role: 'pending_member', deletedAt: null }

    vi.mocked(db.select)
      .mockReturnValueOnce(makeSelectWhere([{ id: 'user-uuid-1' }]) as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce(makeSelectLimit([softDeletedMembership]) as unknown as ReturnType<typeof db.select>)
      // organizer lookup for JOIN_REQUEST_RECEIVED notification
      .mockReturnValueOnce(makeSelectLimit([{ organizerId: 'organizer-uuid-1' }]) as unknown as ReturnType<typeof db.select>)

    vi.mocked(db.update).mockReturnValueOnce(makeUpdateReturning([revivedMembership]) as unknown as ReturnType<typeof db.update>)

    const app = makeApp()
    const res = await request(app).post('/group-123/join')

    expect(res.status).toBe(201)
    expect(res.body.data.role).toBe('pending_member')
  })
})
