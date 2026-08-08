import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import router from './index'

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../../middleware/require-group-member', () => ({
  requireGroupMember: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction,
  ) => {
    req.user.internalId = '10000000-0000-4000-8000-000000000002'
    req.user.groupRole = 'member'
    next()
  },
}))

vi.mock('../../services/players/ovr.service', () => ({
  ovrService: { computeAttributeAverages: vi.fn() },
}))

import { db } from '../../db'

function app() {
  const instance = express()
  instance.use(express.json())
  instance.use((req, _res, next) => {
    req.user = { userId: 'fixture-clerk' } as express.Request['user']
    next()
  })
  instance.use('/groups/:groupId/ratings', router)
  return instance
}

describe('disabled initial crew ratings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects creation without reading or writing rating data', async () => {
    const response = await request(app())
      .post('/groups/30000000-0000-4000-8000-000000000001/ratings/initial')
      .send({
        ratedPlayerId: '20000000-0000-4000-8000-000000000004',
        pace: 5,
        technique: 5,
        passing: 5,
        defending: 5,
        physicality: 5,
        effort: 5,
        mentality: 5,
      })

    expect(response.status).toBe(410)
    expect(response.body.error.code).toBe('INITIAL_RATINGS_DISABLED')
    expect(db.select).not.toHaveBeenCalled()
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('returns a non-blocking empty pending response', async () => {
    const response = await request(app())
      .get('/groups/30000000-0000-4000-8000-000000000001/ratings/initial/pending')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ data: { items: [], total: 0, rated: 0, disabled: true } })
    expect(db.select).not.toHaveBeenCalled()
  })
})
