import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../db', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), transaction: vi.fn(), delete: vi.fn() },
}))

// Betting hangs off /v1/matches/:matchId/pronos now, so the guards are the
// match-scoped ones. loadMatch has already proved the caller may see the match.
vi.mock('../../middleware/match-context', () => ({
  loadMatch: vi.fn((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.match = { id: 'match-1', groupId: 'group-1' } as express.Request['match']
    req.matchRelation = 'participant'
    next()
  }),
  requireMatchCapability: vi.fn(() =>
    (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  ),
  requirePlayer: vi.fn(
    (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  ),
}))

vi.mock('../../services/pronos/bet.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/pronos/bet.service')>()
  return {
    ...actual,
    betService: { ...actual.betService, getLockedRoster: vi.fn().mockResolvedValue([]) },
  }
})

vi.mock('../../services/pronos/bankroll.service', () => ({
  bankrollService: { placeBet: vi.fn(), getBalance: vi.fn() },
}))

import router from './index'
import { db } from '../../db'

const PLACED = new Date('2026-07-20T18:00:00.000Z')
const SETTLED = new Date('2026-07-20T20:00:00.000Z')

/** db.select().from()[.innerJoin()].where()[.orderBy()] → rows */
function selectWhere(rows: unknown[]) {
  const chain = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.innerJoin.mockReturnValue(chain)
  chain.where.mockReturnValue(Object.assign(Promise.resolve(rows), {
    orderBy: vi.fn().mockResolvedValue(rows),
    limit: vi.fn().mockResolvedValue(rows),
  }))
  chain.orderBy.mockResolvedValue(rows)
  chain.limit.mockResolvedValue(rows)
  return chain as unknown as ReturnType<typeof db.select>
}

const COMPLETED_MATCH = {
  id: 'match-1',
  status: 'completed',
  scoreA: 4,
  scoreB: 2,
  mvpPlayerId: 'player-mvp-1',
}

/** The caller's own bets: a won result, a close scoreline, a still-pending MVP pick. */
const CALLER_BETS = [
  {
    id: 'b1', playerId: 'player-caller', displayName: 'Toi',
    market: 'result', selection: 'teamA', stake: 250, oddsAtBet: '2.13',
    status: 'won', payout: 533, placedAt: PLACED, settledAt: SETTLED,
  },
  {
    id: 'b2', playerId: 'player-caller', displayName: 'Toi',
    market: 'score', selection: '3-1', stake: 50, oddsAtBet: '19.99',
    status: 'close', payout: 20, placedAt: PLACED, settledAt: SETTLED,
  },
  {
    id: 'b3', playerId: 'player-caller', displayName: 'Toi',
    market: 'mvp', selection: 'player-mvp-2', stake: 50, oddsAtBet: '7.42',
    status: 'pending', payout: null, placedAt: PLACED, settledAt: null,
  },
]

const OTHER_BETS = [
  {
    id: 'b4', playerId: 'player-sofiane', displayName: 'Sofiane M.',
    market: 'result', selection: 'teamA', stake: 100, oddsAtBet: '2.13',
    status: 'won', payout: 213, placedAt: PLACED, settledAt: SETTLED,
  },
  {
    id: 'b5', playerId: 'player-hugo', displayName: 'Hugo L.',
    market: 'result', selection: 'teamB', stake: 150, oddsAtBet: '3.38',
    status: 'lost', payout: 0, placedAt: PLACED, settledAt: SETTLED,
  },
]

const MVP_NAMES = [
  { id: 'player-mvp-1', displayName: 'Kevin B.' },
  { id: 'player-mvp-2', displayName: 'Tom R.' },
]

/** player → match → bets → mvp names: the order the handler queries in. */
function mockRevealChain(match: unknown | null, bets: unknown[], names: unknown[] = MVP_NAMES) {
  vi.mocked(db.select).mockReturnValueOnce(selectWhere(match ? [match] : []))
  vi.mocked(db.select).mockReturnValueOnce(selectWhere(bets))
  vi.mocked(db.select).mockReturnValueOnce(selectWhere(names))
}

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    req.user = {
      userId: 'clerk-1',
      internalId: 'user-uuid-1',
      playerId: 'player-caller',
    } as express.Request['user']
    next()
  })
  app.use('/', router)
  return app
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /bets/reveal', () => {
  it('returns the settled match, the caller bets and their totals', async () => {
    mockRevealChain(COMPLETED_MATCH, [...CALLER_BETS, ...OTHER_BETS])

    const res = await request(makeApp()).get('/bets/reveal')

    expect(res.status).toBe(200)
    expect(res.body.data.settled).toBe(true)
    expect(res.body.data.match).toMatchObject({
      scoreA: 4,
      scoreB: 2,
      actualResult: 'teamA',
      actualScore: '4-2',
      mvpDisplayName: 'Kevin B.',
    })

    expect(res.body.data.myBets).toHaveLength(3)
    // (533 + 20 + 0) - (250 + 50 + 50): a pending payout counts as 0, never as a loss.
    expect(res.body.data.myTotals).toEqual({ staked: 350, returned: 553, net: 203 })
  })

  it('serializes oddsAtBet as a number and keeps a pending payout null', async () => {
    mockRevealChain(COMPLETED_MATCH, CALLER_BETS)

    const res = await request(makeApp()).get('/bets/reveal')

    expect(res.body.data.myBets[0].oddsAtBet).toBe(2.13) // not the numeric(6,2) string
    const pending = res.body.data.myBets.find((b: { id: string }) => b.id === 'b3')
    expect(pending.status).toBe('pending')
    expect(pending.payout).toBeNull()
  })

  it('resolves an MVP selection to a display name and leaves other markets raw', async () => {
    mockRevealChain(COMPLETED_MATCH, CALLER_BETS)

    const res = await request(makeApp()).get('/bets/reveal')

    const byId = Object.fromEntries(
      res.body.data.myBets.map((b: { id: string; selectionLabel: string }) => [b.id, b.selectionLabel]),
    )
    expect(byId['b3']).toBe('Tom R.') // mvp → display name
    expect(byId['b2']).toBe('3-1') // score → the selection verbatim
    expect(byId['b1']).toBe('teamA') // result → the raw token, localized client-side
  })

  it('falls back to the raw selection when an MVP player cannot be resolved', async () => {
    mockRevealChain(COMPLETED_MATCH, CALLER_BETS, [])

    const res = await request(makeApp()).get('/bets/reveal')

    const pending = res.body.data.myBets.find((b: { id: string }) => b.id === 'b3')
    expect(pending.selectionLabel).toBe('player-mvp-2')
    expect(res.body.data.match.mvpDisplayName).toBeNull()
  })

  it('aggregates every better into table rows sorted by net descending', async () => {
    mockRevealChain(COMPLETED_MATCH, [...CALLER_BETS, ...OTHER_BETS])

    const res = await request(makeApp()).get('/bets/reveal')

    expect(res.body.data.table).toEqual([
      { playerId: 'player-caller', displayName: 'Toi', staked: 350, returned: 553, net: 203, isMe: true },
      { playerId: 'player-sofiane', displayName: 'Sofiane M.', staked: 100, returned: 213, net: 113, isMe: false },
      { playerId: 'player-hugo', displayName: 'Hugo L.', staked: 150, returned: 0, net: -150, isMe: false },
    ])
  })

  it('answers 200 with settled:false before the match completes — never 403', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      selectWhere([{ ...COMPLETED_MATCH, status: 'teams_generated', scoreA: null, scoreB: null }]),
    )

    const res = await request(makeApp()).get('/bets/reveal')

    expect(res.status).toBe(200)
    expect(res.body.data.settled).toBe(false)
    expect(res.body.data.match.actualResult).toBeNull()
    expect(res.body.data.myBets).toEqual([])
    expect(res.body.data.myTotals).toEqual({ staked: 0, returned: 0, net: 0 })
    expect(res.body.data.table).toEqual([])
  })

  it('returns an empty reveal rather than a 404 when nobody bet', async () => {
    mockRevealChain(COMPLETED_MATCH, [])

    const res = await request(makeApp()).get('/bets/reveal')

    expect(res.status).toBe(200)
    expect(res.body.data.settled).toBe(true)
    expect(res.body.data.myTotals).toEqual({ staked: 0, returned: 0, net: 0 })
    expect(res.body.data.table).toEqual([])
  })

  it('404 when the match cannot be priced', async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectWhere([]))

    const res = await request(makeApp()).get('/bets/reveal')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('MATCH_NOT_FOUND')
  })

})
