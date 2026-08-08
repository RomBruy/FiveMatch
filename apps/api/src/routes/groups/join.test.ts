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
import groupsRouter from './index'

function buildApp(userId = 'clerk_user_abc') {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    ;(req as express.Request & { user: { userId: string; internalId?: string; groupRole?: string } }).user = {
      userId,
      internalId: 'internal-uuid-1',
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

describe('POST /groups/:groupId/join', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates pending_member row (201)', async () => {
    // select 1: user lookup — terminal on .where()
    const userChain = makeSelectWhere([{ id: 'user-uuid-1' }])
    // select 2: existing membership check — terminal on .limit()
    const existingChain = makeSelectLimit([])
    // select 3: organizer lookup for JOIN_REQUEST_RECEIVED notification
    const organizerChain = makeSelectLimit([{ organizerId: 'organizer-uuid-1' }])

    vi.mocked(db.select)
      .mockReturnValueOnce(userChain as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce(existingChain as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce(organizerChain as unknown as ReturnType<typeof db.select>)

    const insertChain = { values: vi.fn(), returning: vi.fn() }
    insertChain.values.mockReturnValue(insertChain)
    insertChain.returning.mockResolvedValue([{
      id: 'membership-uuid-1',
      groupId: 'group-uuid-1',
      userId: 'user-uuid-1',
      role: 'pending_member',
    }])
    vi.mocked(db.insert).mockReturnValue(insertChain as unknown as ReturnType<typeof db.insert>)

    const res = await request(buildApp()).post('/groups/group-uuid-1/join')

    expect(res.status).toBe(201)
    expect(res.body.data.membershipStatus).toBe('pending_member')
  })

  it('returns 409 ALREADY_A_MEMBER if user already has a membership row', async () => {
    const userChain = makeSelectWhere([{ id: 'user-uuid-1' }])
    const existingChain = makeSelectLimit([{ role: 'pending_member' }])

    vi.mocked(db.select)
      .mockReturnValueOnce(userChain as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce(existingChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).post('/groups/group-uuid-1/join')

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('ALREADY_A_MEMBER')
  })

  it('returns 404 USER_NOT_FOUND if user does not exist', async () => {
    const userChain = makeSelectWhere([])

    vi.mocked(db.select).mockReturnValueOnce(userChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).post('/groups/group-uuid-1/join')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('USER_NOT_FOUND')
  })
})

function makeSelectInnerJoinLimit(resolved: unknown[]) {
  const chain = { from: vi.fn(), where: vi.fn(), innerJoin: vi.fn(), limit: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.innerJoin.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.limit.mockResolvedValue(resolved)
  return chain
}

describe('GET /groups/:groupId/pending-info', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns pending info for pending_member (200)', async () => {
    // select 1: membership innerJoin check — terminal on .limit()
    const membershipChain = makeSelectInnerJoinLimit([{ role: 'pending_member' }])
    // select 2: group lookup — terminal on .where()
    const groupChain = makeSelectWhere([{ name: 'Les Potes FC', organizerId: 'org-uuid-1' }])
    // select 3: organizer lookup — terminal on .where()
    const organizerChain = makeSelectWhere([{ name: 'Thomas' }])
    // select 4: count — terminal on .where()
    const countChain = makeSelectWhere([{ value: '7' }])

    vi.mocked(db.select)
      .mockReturnValueOnce(membershipChain as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce(groupChain as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce(organizerChain as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce(countChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/groups/group-uuid-1/pending-info')

    expect(res.status).toBe(200)
    expect(res.body.data.groupName).toBe('Les Potes FC')
    expect(res.body.data.organizerDisplayName).toBe('Thomas')
    expect(res.body.data.memberCount).toBe(7)
  })

  it('returns 403 NOT_A_MEMBER for a non-pending user', async () => {
    const membershipChain = makeSelectInnerJoinLimit([])

    vi.mocked(db.select).mockReturnValueOnce(membershipChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/groups/group-uuid-1/pending-info')

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('NOT_A_MEMBER')
  })
})

describe('GET /groups/:groupId/my-status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns role for an existing member', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectInnerJoinLimit([{ role: 'organizer' }]) as unknown as ReturnType<typeof db.select>,
    )

    const res = await request(buildApp()).get('/groups/group-uuid-1/my-status')

    expect(res.status).toBe(200)
    expect(res.body.data.role).toBe('organizer')
  })

  it('returns null role for non-member', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectInnerJoinLimit([]) as unknown as ReturnType<typeof db.select>,
    )

    const res = await request(buildApp()).get('/groups/group-uuid-1/my-status')

    expect(res.status).toBe(200)
    expect(res.body.data.role).toBeNull()
  })

  it('returns pending_member role for pending users', async () => {
    vi.mocked(db.select).mockReturnValue(
      makeSelectInnerJoinLimit([{ role: 'pending_member' }]) as unknown as ReturnType<typeof db.select>,
    )

    const res = await request(buildApp()).get('/groups/group-uuid-1/my-status')

    expect(res.status).toBe(200)
    expect(res.body.data.role).toBe('pending_member')
  })
})
