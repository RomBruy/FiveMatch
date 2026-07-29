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
import { bankrollService } from '../../services/pronos/bankroll.service'

function selectWhere(rows: unknown[]) {
  const chain = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.innerJoin.mockReturnValue(chain)
  chain.where.mockResolvedValue(rows)
  return chain as unknown as ReturnType<typeof db.select>
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

describe('GET /:groupId/pronos/bankroll', () => {
  it('returns the caller balance and the starting bankroll', async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectWhere([{ id: 'player-caller' }]))
    vi.mocked(bankrollService.getBalance).mockResolvedValue(1240)

    const res = await request(makeApp()).get('/group-1/pronos/bankroll')

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual({ balance: 1240, startingBankroll: 1000 })
    expect(vi.mocked(bankrollService.getBalance).mock.calls[0]![0]).toBe('player-caller')
  })

  it('403 NOT_A_MEMBER when the caller has no player row in the group', async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectWhere([]))

    const res = await request(makeApp()).get('/group-1/pronos/bankroll')

    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('NOT_A_MEMBER')
    expect(bankrollService.getBalance).not.toHaveBeenCalled()
  })
})
