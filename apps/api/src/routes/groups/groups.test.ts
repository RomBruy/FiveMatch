import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}))

vi.mock('../../db/schema', () => ({
  users: { id: 'id', clerkUserId: 'clerk_user_id' },
  groups: { id: 'id' },
  groupMemberships: { role: 'role' },
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

import { db } from '../../db'
import { requireGroupMember } from '../../middleware/require-group-member'
import groupsRouter from './index'

const mockGroup = {
  id: 'group-uuid-1',
  organizerId: 'internal-uuid-1',
  name: 'Les Potes FC',
  formatPreset: '5v5',
  goalkeeperMode: 'fixed',
  playStyle: null,
  generatorStyle: 'pure_ovr',
  tier: 'amateur',
  matchCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

function buildApp(userId = 'clerk_user_abc', internalId?: string, groupRole?: 'organizer' | 'member') {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    ;(req as express.Request & { user: { userId: string; internalId?: string; groupRole?: string } }).user = {
      userId,
      ...(internalId ? { internalId } : {}),
      ...(groupRole ? { groupRole } : {}),
    }
    next()
  })
  app.use('/groups', groupsRouter)
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message, statusCode: 400 } })
  })
  return app
}

describe('POST /groups', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates group and organizer membership, returns 201', async () => {
    // Mock user lookup
    const selectChain = { from: vi.fn(), where: vi.fn() }
    selectChain.from.mockReturnValue(selectChain)
    selectChain.where.mockResolvedValue([{ id: 'internal-uuid-1' }])
    vi.mocked(db.select).mockReturnValue(selectChain as unknown as ReturnType<typeof db.select>)

    // Mock transaction that calls callback with mock tx
    vi.mocked(db.transaction).mockImplementation(async (cb) => {
      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockGroup]),
          }),
        }),
      }
      return cb(mockTx as unknown as Parameters<typeof cb>[0])
    })

    const res = await request(buildApp())
      .post('/groups')
      .send({ name: 'Les Potes FC', formatPreset: '5v5', goalkeeperMode: 'fixed' })

    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe('Les Potes FC')
    expect(res.body.data.tier).toBe('amateur')
  })

  it('returns 404 when user not found in DB', async () => {
    const selectChain = { from: vi.fn(), where: vi.fn() }
    selectChain.from.mockReturnValue(selectChain)
    selectChain.where.mockResolvedValue([])
    vi.mocked(db.select).mockReturnValue(selectChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp())
      .post('/groups')
      .send({ name: 'Les Potes FC', formatPreset: '5v5', goalkeeperMode: 'fixed' })

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('USER_NOT_FOUND')
  })

  it('returns 400 for missing required fields', async () => {
    const res = await request(buildApp()).post('/groups').send({ name: 'Les Potes FC' })
    expect(res.status).toBe(400)
  })
})

describe('GET /groups/:groupId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns group data for a member (requireGroupMember passes)', async () => {
    const selectChain = { from: vi.fn(), where: vi.fn() }
    selectChain.from.mockReturnValue(selectChain)
    selectChain.where.mockResolvedValue([mockGroup])
    vi.mocked(db.select).mockReturnValue(selectChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/groups/group-uuid-1')

    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe('group-uuid-1')
    expect(requireGroupMember).toHaveBeenCalled()
  })

  it('returns 404 when group does not exist', async () => {
    const selectChain = { from: vi.fn(), where: vi.fn() }
    selectChain.from.mockReturnValue(selectChain)
    selectChain.where.mockResolvedValue([])
    vi.mocked(db.select).mockReturnValue(selectChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/groups/nonexistent-group')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('GROUP_NOT_FOUND')
  })
})

describe('PATCH /groups/:groupId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates group when called by organizer', async () => {
    const updatedGroup = { ...mockGroup, name: 'New Name' }
    const updateChain = { set: vi.fn(), where: vi.fn() }
    updateChain.set.mockReturnValue(updateChain)
    updateChain.where.mockReturnValue({ returning: vi.fn().mockResolvedValue([updatedGroup]) })
    vi.mocked(db.update).mockReturnValue(updateChain as unknown as ReturnType<typeof db.update>)

    const res = await request(buildApp('clerk_user_abc', 'internal-uuid-1', 'organizer'))
      .patch('/groups/group-uuid-1')
      .send({ name: 'New Name' })

    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('New Name')
  })

  it('returns 403 FORBIDDEN when called by a regular member', async () => {
    vi.mocked(requireGroupMember).mockImplementationOnce(
      (req: express.Request, _res: express.Response, next: express.NextFunction) => {
        req.user.internalId = 'internal-uuid-2'
        req.user.groupRole = 'member'
        next()
      },
    )

    const res = await request(buildApp())
      .patch('/groups/group-uuid-1')
      .send({ name: 'New Name' })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('FORBIDDEN')
  })

  it('returns 400 for empty update body', async () => {
    const res = await request(buildApp()).patch('/groups/group-uuid-1').send({})
    expect(res.status).toBe(400)
  })
})
