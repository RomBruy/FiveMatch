import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../../db', () => ({
  db: {
    select: vi.fn(),
  },
}))

vi.mock('../../../db/schema', () => ({
  players: {
    id: 'id',
    groupId: 'group_id',
    userId: 'user_id',
    cardState: 'card_state',
    matchCount: 'match_count',
    ovrScore: 'ovr_score',
    avgPace: 'avg_pace',
    avgTechnique: 'avg_technique',
    avgPassing: 'avg_passing',
    avgDefending: 'avg_defending',
    avgPhysicality: 'avg_physicality',
    avgEffort: 'avg_effort',
    deletedAt: 'deleted_at',
  },
  users: { id: 'id', name: 'name' },
}))

vi.mock('../../../middleware/require-group-member', () => ({
  requireGroupMember: vi.fn(
    (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.user.internalId = 'internal-uuid-1'
      req.user.groupRole = 'member'
      next()
    },
  ),
}))

vi.mock('../../../services/players/ovr.service', () => ({
  ovrService: {
    getOvrForDisplay: vi.fn((ovrScore: number | null, matchCount: number) =>
      matchCount >= 4 ? ovrScore : null,
    ),
  },
}))

import { db } from '../../../db'
import playersRouter from '../index'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    ;(req as express.Request & { user: { userId: string; internalId?: string; groupRole?: string } }).user =
      { userId: 'clerk-user-1' }
    next()
  })
  app.use('/groups/:groupId/players', playersRouter)
  return app
}

describe('GET /groups/:groupId/players', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns player list with correct shape and no raterPlayerId', async () => {
    const mockRows = [
      {
        id: 'player-uuid-1',
        displayName: 'Marcus Test',
        cardState: 'in_progress_2',
        matchCount: 1,
        ovrScore: null,
        avgPace: '7.50',
        avgTechnique: '6.00',
        avgPassing: '5.50',
        avgDefending: '4.00',
        avgPhysicality: '6.50',
        avgEffort: '8.00',
      },
    ]

    const selectChain = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn() }
    selectChain.from.mockReturnValue(selectChain)
    selectChain.innerJoin.mockReturnValue(selectChain)
    selectChain.where.mockResolvedValue(mockRows)
    vi.mocked(db.select).mockReturnValue(selectChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/groups/group-uuid-1/players')

    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.hasMore).toBe(false)

    const item = res.body.data.items[0]
    expect(item.playerId).toBe('player-uuid-1')
    expect(item.displayName).toBe('Marcus Test')
    expect(item.cardState).toBe('in_progress_2')
    expect(item.matchCount).toBe(1)
    // raterPlayerId must never appear
    expect(item).not.toHaveProperty('raterPlayerId')
    expect(item.attributes).toBeDefined()
    expect(item.attributes.pace).toBe(7.5)
    expect(item.attributes.technique).toBe(6.0)
  })

  it('returns ovrScore null when matchCount < 4', async () => {
    const mockRows = [
      {
        id: 'player-uuid-2',
        displayName: 'Thomas Test',
        cardState: 'in_progress_3',
        matchCount: 3,
        ovrScore: 72,
        avgPace: '7.00',
        avgTechnique: '7.00',
        avgPassing: '7.00',
        avgDefending: '7.00',
        avgPhysicality: '7.00',
        avgEffort: '7.00',
      },
    ]

    const selectChain = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn() }
    selectChain.from.mockReturnValue(selectChain)
    selectChain.innerJoin.mockReturnValue(selectChain)
    selectChain.where.mockResolvedValue(mockRows)
    vi.mocked(db.select).mockReturnValue(selectChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/groups/group-uuid-1/players')

    expect(res.status).toBe(200)
    // getOvrForDisplay returns null when matchCount < 4
    expect(res.body.data.items[0].ovrScore).toBeNull()
  })

  it('returns null attributes when no initial ratings yet', async () => {
    const mockRows = [
      {
        id: 'player-uuid-3',
        displayName: 'New Player',
        cardState: 'not_started',
        matchCount: 0,
        ovrScore: null,
        avgPace: null,
        avgTechnique: null,
        avgPassing: null,
        avgDefending: null,
        avgPhysicality: null,
        avgEffort: null,
      },
    ]

    const selectChain = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn() }
    selectChain.from.mockReturnValue(selectChain)
    selectChain.innerJoin.mockReturnValue(selectChain)
    selectChain.where.mockResolvedValue(mockRows)
    vi.mocked(db.select).mockReturnValue(selectChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/groups/group-uuid-1/players')

    expect(res.status).toBe(200)
    expect(res.body.data.items[0].attributes).toBeNull()
    expect(res.body.data.items[0].ovrScore).toBeNull()
  })
})
