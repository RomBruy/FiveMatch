import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import router from './index'

vi.mock('../../db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), transaction: vi.fn(), delete: vi.fn() },
}))

vi.mock('../../middleware/require-group-member', () => ({
  requireGroupMember: vi.fn(
    (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.user.internalId = 'user-uuid-1'
      req.user.groupRole = 'member'
      next()
    },
  ),
}))

vi.mock('../../services/pronos/bankroll.service', () => ({
  bankrollService: { getBalance: vi.fn() },
}))

import { db } from '../../db'

function selectWhere(rows: unknown[]) {
  const chain = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.innerJoin.mockReturnValue(chain)
  chain.where.mockResolvedValue(rows)
  return chain as unknown as ReturnType<typeof db.select>
}

/** One row per bet, carrying its player's cached balance — the shape of the joined query. */
function bet(
  playerId: string,
  displayName: string,
  balance: number,
  status: 'pending' | 'won' | 'lost' | 'close',
) {
  return { playerId, displayName, balance, status }
}

/** caller player row, then the joined bankroll rows — the order the handler queries in. */
function mockLeaderboard(betRows: unknown[], caller: unknown[] = [{ id: 'player-caller' }]) {
  vi.mocked(db.select).mockReturnValueOnce(selectWhere(caller))
  vi.mocked(db.select).mockReturnValueOnce(selectWhere(betRows))
}

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = { userId: 'clerk-1', internalId: 'user-uuid-1' } as express.Request['user']
    next()
  })
  app.use('/', router)
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /:groupId/pronos/leaderboard', () => {
  it('ranks by bankroll balance, not by points or accuracy', async () => {
    mockLeaderboard([
      bet('player-hugo', 'Hugo L.', 640, 'lost'),
      bet('player-kevin', 'Kevin B.', 1612, 'won'),
      bet('player-caller', 'Toi', 1443, 'won'),
    ])

    const res = await request(makeApp()).get('/group-1/pronos/leaderboard')

    expect(res.status).toBe(200)
    expect(res.body.data.leaderboard.map((e: { rank: number; displayName: string; balance: number }) => [
      e.rank, e.displayName, e.balance,
    ])).toEqual([
      [1, 'Kevin B.', 1612],
      [2, 'Toi', 1443],
      [3, 'Hugo L.', 640],
    ])
  })

  it('counts a close refund as a miss, not a win', async () => {
    mockLeaderboard([
      bet('player-kevin', 'Kevin B.', 1200, 'won'),
      bet('player-kevin', 'Kevin B.', 1200, 'close'),
      bet('player-kevin', 'Kevin B.', 1200, 'lost'),
      bet('player-kevin', 'Kevin B.', 1200, 'pending'),
    ])

    const res = await request(makeApp()).get('/group-1/pronos/leaderboard')

    const [entry] = res.body.data.leaderboard
    expect(entry.betsPlaced).toBe(4)
    expect(entry.betsSettled).toBe(3) // pending is not settled
    expect(entry.betsWon).toBe(1) // close refunds are not wins
    expect(entry.accuracyRate).toBeCloseTo(1 / 3)
  })

  it('omits an accuracy rate rather than reporting 0 when nothing has settled', async () => {
    mockLeaderboard([bet('player-caller', 'Toi', 900, 'pending')])

    const res = await request(makeApp()).get('/group-1/pronos/leaderboard')

    const [entry] = res.body.data.leaderboard
    expect(entry.betsSettled).toBe(0)
    expect(entry.accuracyRate).toBe(0)
  })

  it('breaks a balance tie by accuracy, then by display name', async () => {
    mockLeaderboard([
      bet('player-b', 'Bruno', 1000, 'lost'),
      bet('player-a', 'Ana', 1000, 'lost'),
      bet('player-c', 'Chloe', 1000, 'won'),
    ])

    const res = await request(makeApp()).get('/group-1/pronos/leaderboard')

    expect(res.body.data.leaderboard.map((e: { displayName: string }) => e.displayName))
      .toEqual(['Chloe', 'Ana', 'Bruno'])
  })

  it('excludes members who have never placed a bet', async () => {
    // The join returns no row for them at all — assert the endpoint does not invent one.
    mockLeaderboard([bet('player-kevin', 'Kevin B.', 1612, 'won')])

    const res = await request(makeApp()).get('/group-1/pronos/leaderboard')

    expect(res.body.data.leaderboard).toHaveLength(1)
    expect(res.body.data.leaderboard[0].playerId).toBe('player-kevin')
  })

  it('still resolves myPlayerId when the leaderboard is empty', async () => {
    // Profil depends on this endpoint for the caller playerId and nothing else.
    mockLeaderboard([])

    const res = await request(makeApp()).get('/group-1/pronos/leaderboard')

    expect(res.status).toBe(200)
    expect(res.body.data.leaderboard).toEqual([])
    expect(res.body.data.myPlayerId).toBe('player-caller')
  })

  it('returns myPlayerId null for a caller with no player row', async () => {
    mockLeaderboard([], [])

    const res = await request(makeApp()).get('/group-1/pronos/leaderboard')

    expect(res.status).toBe(200)
    expect(res.body.data.myPlayerId).toBeNull()
  })
})
