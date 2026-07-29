import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

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

// The locked roster needs a DB; the pricing it feeds does not. Stub the lookup and let
// the real buildOddsBoard price it, so these tests still assert against engine output.
vi.mock('../../services/pronos/bet.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/pronos/bet.service')>()
  return {
    ...actual,
    betService: {
      ...actual.betService,
      getLockedRoster: vi.fn().mockResolvedValue([
        { playerId: 'player-mvp-1', displayName: 'Kevin B.', ovr: 87 },
        { playerId: 'player-mvp-2', displayName: 'Sofiane M.', ovr: 81 },
      ]),
      buildOddsBoard: actual.buildOddsBoard,
    },
  }
})

vi.mock('../../services/pronos/bankroll.service', () => ({
  bankrollService: { placeBet: vi.fn(), getBalance: vi.fn() },
}))

import router from './index'
import { db } from '../../db'
import { bankrollService } from '../../services/pronos/bankroll.service'

const FUTURE = new Date(Date.now() + 3_600_000)
const PAST = new Date(Date.now() - 3_600_000)

/** db.select().from().where() → rows */
function selectWhere(rows: unknown[]) {
  const chain = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.innerJoin.mockReturnValue(chain)
  // Both `.where()` and `.where().orderBy()` are terminal in these routes.
  chain.where.mockReturnValue(Object.assign(Promise.resolve(rows), {
    orderBy: vi.fn().mockResolvedValue(rows),
    limit: vi.fn().mockResolvedValue(rows),
  }))
  chain.orderBy.mockResolvedValue(rows)
  chain.limit.mockResolvedValue(rows)
  return chain as unknown as ReturnType<typeof db.select>
}

/** The caller's player row, then the match row — the order both routes query in. */
function mockPlayerThenMatch(match: unknown[] | null) {
  vi.mocked(db.select).mockReturnValueOnce(selectWhere([{ id: 'player-caller' }]))
  vi.mocked(db.select).mockReturnValueOnce(selectWhere(match ?? []))
}

const LOCKED_MATCH = {
  id: 'match-1',
  scheduledAt: FUTURE,
  teamAOvrAtLock: '78.00',
  teamBOvrAtLock: '70.00',
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

describe('GET /odds', () => {
  it('returns the three markets and the window for a locked match', async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectWhere([LOCKED_MATCH]))

    const res = await request(makeApp()).get('/odds')

    expect(res.status).toBe(200)
    expect(res.body.data.result).toEqual({ teamA: 2.13, draw: 4.26, teamB: 3.38 })
    expect(res.body.data.scores[0]).toHaveProperty('selection')
    expect(res.body.data.mvp[0].displayName).toBe('Kevin B.')
    expect(res.body.data.window.open).toBe(true)
    expect(res.body.data.window.closesAt).toBe(FUTURE.toISOString())
  })

  it('exposes the locked OVR pair the board was priced from', async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectWhere([LOCKED_MATCH]))

    const res = await request(makeApp()).get('/odds')

    // Numbers, not the numeric(5,2) strings — the screen must not parse them (Story 11.5).
    expect(res.body.data.teams).toEqual({ teamAOvr: 78, teamBOvr: 70 })
  })

  it('422 ODDS_NOT_AVAILABLE before teams are generated', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      selectWhere([{ ...LOCKED_MATCH, teamAOvrAtLock: null, teamBOvrAtLock: null }]),
    )

    const res = await request(makeApp()).get('/odds')

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('ODDS_NOT_AVAILABLE')
  })

  it('404 when the match is not in this group', async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectWhere([]))

    const res = await request(makeApp()).get('/odds')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('MATCH_NOT_FOUND')
  })
})

describe('POST /bets', () => {
  it('freezes the engine price and returns the new balance', async () => {
    mockPlayerThenMatch([LOCKED_MATCH])
    vi.mocked(bankrollService.placeBet).mockResolvedValue({
      bet: { id: 'bet-1', oddsAtBet: '2.13', stake: 100 } as never,
      balance: 900,
    })

    const res = await request(makeApp())
      .post('/bets').send({ market: 'result', selection: 'teamA', stake: 100 })

    expect(res.status).toBe(201)
    expect(res.body.data.balance).toBe(900)
    expect(res.body.data.bet.oddsAtBet).toBe(2.13) // serialized as a number, not "2.13"
    expect(vi.mocked(bankrollService.placeBet).mock.calls[0]![0].oddsAtBet).toBe(2.13)
  })

  it('ignores any odds the client tries to supply', async () => {
    mockPlayerThenMatch([LOCKED_MATCH])
    vi.mocked(bankrollService.placeBet).mockResolvedValue({
      bet: { id: 'bet-1', oddsAtBet: '2.13' } as never, balance: 900,
    })

    await request(makeApp())
      .post('/bets')
      .send({ market: 'result', selection: 'teamA', stake: 100, oddsAtBet: 999 })

    // The engine's price wins — 999 never reaches the ledger.
    expect(vi.mocked(bankrollService.placeBet).mock.calls[0]![0].oddsAtBet).toBe(2.13)
  })

  it('422 PRONOS_WINDOW_CLOSED once kick-off has passed', async () => {
    mockPlayerThenMatch([{ ...LOCKED_MATCH, scheduledAt: PAST }])

    const res = await request(makeApp())
      .post('/bets').send({ market: 'result', selection: 'teamA', stake: 100 })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('PRONOS_WINDOW_CLOSED')
    expect(bankrollService.placeBet).not.toHaveBeenCalled()
  })

  it('422 INVALID_SELECTION for a scoreline that is not on the board', async () => {
    mockPlayerThenMatch([LOCKED_MATCH])

    const res = await request(makeApp())
      .post('/bets').send({ market: 'score', selection: '9-9', stake: 100 })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('INVALID_SELECTION')
    expect(bankrollService.placeBet).not.toHaveBeenCalled()
  })

  it('422 INVALID_SELECTION for an MVP player who is not on the locked roster', async () => {
    mockPlayerThenMatch([LOCKED_MATCH])

    const res = await request(makeApp())
      .post('/bets').send({ market: 'mvp', selection: 'player-not-playing', stake: 100 })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('INVALID_SELECTION')
  })

  it('maps a bankroll INSUFFICIENT_BALANCE throw to 422', async () => {
    mockPlayerThenMatch([LOCKED_MATCH])
    vi.mocked(bankrollService.placeBet).mockRejectedValue(
      Object.assign(new Error('INSUFFICIENT_BALANCE'), { code: 'INSUFFICIENT_BALANCE', statusCode: 422 }),
    )

    const res = await request(makeApp())
      .post('/bets').send({ market: 'result', selection: 'teamA', stake: 100 })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('INSUFFICIENT_BALANCE')
  })

  it('403 when the caller has no player row in this group', async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectWhere([]))

    const res = await request(makeApp())
      .post('/bets').send({ market: 'result', selection: 'teamA', stake: 100 })

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('NOT_A_MEMBER')
  })
})

describe('GET /bets/my', () => {
  it('returns the caller bets, balance and net payout', async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectWhere([{ id: 'player-caller' }]))
    vi.mocked(db.select).mockReturnValueOnce(selectWhere([
      { id: 'b1', market: 'result', selection: 'teamA', stake: 250, oddsAtBet: '2.13',
        status: 'won', payout: 533, placedAt: PAST, settledAt: FUTURE },
      { id: 'b2', market: 'mvp', selection: 'player-mvp-1', stake: 50, oddsAtBet: '6.66',
        status: 'lost', payout: 0, placedAt: PAST, settledAt: FUTURE },
    ]))
    vi.mocked(bankrollService.getBalance).mockResolvedValue(1443)

    const res = await request(makeApp()).get('/bets/my')

    expect(res.status).toBe(200)
    expect(res.body.data.balance).toBe(1443)
    expect(res.body.data.bets).toHaveLength(2)
    expect(res.body.data.bets[0].oddsAtBet).toBe(2.13)
    expect(res.body.data.netPayout).toBe(233) // (533-250) + (0-50)
  })

  it('returns an empty ledger rather than a 404 when the caller has not bet', async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectWhere([{ id: 'player-caller' }]))
    vi.mocked(db.select).mockReturnValueOnce(selectWhere([]))
    vi.mocked(bankrollService.getBalance).mockResolvedValue(1000)

    const res = await request(makeApp()).get('/bets/my')

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ bets: [], balance: 1000, netPayout: 0 })
  })
})
