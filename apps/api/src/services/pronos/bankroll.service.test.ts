import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PRONOS_MAX_STAKE } from '@fivematch/types/algorithm-constants'

// Only the connection is mocked — the real schema module is used so drizzle's eq/and/sql
// operators receive genuine column objects.
vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
    delete: vi.fn(),
  },
}))

import { db } from '../../db'
import { bankrollService, wonPayout, closeRefund, isValidSelection } from './bankroll.service'

/** A tx double whose conditional debit resolves to `debitRows`. */
function makeTx(debitRows: unknown[]) {
  const insertReturning = vi.fn().mockResolvedValue([{ id: 'bet-1' }])
  const insert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({ returning: insertReturning }),
  })
  const update = vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(debitRows) }),
    }),
  })
  return { insert, update }
}

function mockTransactionWith(tx: ReturnType<typeof makeTx>) {
  vi.mocked(db.transaction).mockImplementation(async (cb) =>
    cb(tx as unknown as Parameters<typeof cb>[0]),
  )
}

const VALID_BET = {
  playerId: 'player-1',
  matchId: 'match-1',
  market: 'result' as const,
  selection: 'teamA',
  stake: 100,
  oddsAtBet: 2.13,
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code })
}

describe('bankrollService payout arithmetic', () => {
  it('wonPayout multiplies stake by the frozen cote and rounds', () => {
    expect(wonPayout(100, 2.13)).toBe(213)
    expect(wonPayout(100, 1.1)).toBe(110)
    expect(wonPayout(75, 5.9)).toBe(443) // 442.5 rounds up
  })

  it('closeRefund returns the configured fraction of the stake', () => {
    expect(closeRefund(100)).toBe(40)
    expect(closeRefund(75)).toBe(30)
  })
})

describe('isValidSelection', () => {
  it('accepts the documented encoding for each market', () => {
    expect(isValidSelection('result', 'teamA')).toBe(true)
    expect(isValidSelection('result', 'draw')).toBe(true)
    expect(isValidSelection('score', '3-2')).toBe(true)
    expect(isValidSelection('mvp', '3f1b0b3e-4b2a-4c8d-9e1f-0a1b2c3d4e5f')).toBe(true)
  })

  it('rejects malformed selections', () => {
    expect(isValidSelection('result', 'teamC')).toBe(false)
    expect(isValidSelection('score', '3:2')).toBe(false)
    expect(isValidSelection('mvp', 'not-a-uuid')).toBe(false)
  })
})

describe('bankrollService.placeBet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([0, -5, 10.5])('rejects a stake of %s with INVALID_STAKE', async (stake) => {
    await expectCode(bankrollService.placeBet({ ...VALID_BET, stake }), 'INVALID_STAKE')
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('rejects a stake above PRONOS_MAX_STAKE', async () => {
    await expectCode(
      bankrollService.placeBet({ ...VALID_BET, stake: PRONOS_MAX_STAKE + 1 }),
      'STAKE_LIMIT_EXCEEDED',
    )
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it.each([
    ['result' as const, 'teamC'],
    ['score' as const, '3:2'],
  ])('rejects a %s selection of "%s" with INVALID_SELECTION', async (market, selection) => {
    await expectCode(
      bankrollService.placeBet({ ...VALID_BET, market, selection }),
      'INVALID_SELECTION',
    )
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it('throws INSUFFICIENT_BALANCE and writes no ledger row when the debit matches zero rows', async () => {
    const tx = makeTx([])
    mockTransactionWith(tx)

    await expectCode(bankrollService.placeBet(VALID_BET), 'INSUFFICIENT_BALANCE')
    expect(tx.insert).not.toHaveBeenCalled()
  })

  it('returns the inserted bet and the post-debit balance on success', async () => {
    const tx = makeTx([{ balance: 900 }])
    mockTransactionWith(tx)

    const result = await bankrollService.placeBet(VALID_BET)

    expect(result.balance).toBe(900)
    expect(result.bet).toEqual({ id: 'bet-1' })
    expect(tx.insert).toHaveBeenCalledTimes(1)
  })

  it('freezes the cote as a 2-decimal string on the ledger row', async () => {
    const tx = makeTx([{ balance: 900 }])
    mockTransactionWith(tx)

    await bankrollService.placeBet(VALID_BET)

    const values = tx.insert.mock.results[0].value.values as ReturnType<typeof vi.fn>
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ oddsAtBet: '2.13', status: 'pending', payout: null }),
    )
  })
})

describe('bankrollService.settleBet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /** Update double: first call = the guarded bet transition, second = the balance credit. */
  function makeSettleTx(betRows: unknown[]) {
    const update = vi.fn()
    update.mockReturnValueOnce({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue(betRows) }),
      }),
    })
    update.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
    })
    return { update }
  }

  it('is a no-op returning null when the bet is already settled', async () => {
    const tx = makeSettleTx([])

    const result = await bankrollService.settleBet(
      tx as never,
      { betId: 'bet-1', status: 'won', payout: 213 },
    )

    expect(result).toBeNull()
    expect(tx.update).toHaveBeenCalledTimes(1) // guarded transition only — no credit
  })

  it('credits the payout when a pending bet transitions to won', async () => {
    const tx = makeSettleTx([{ id: 'bet-1', playerId: 'player-1' }])

    const result = await bankrollService.settleBet(
      tx as never,
      { betId: 'bet-1', status: 'won', payout: 213 },
    )

    expect(result).toMatchObject({ id: 'bet-1' })
    expect(tx.update).toHaveBeenCalledTimes(2)
  })

  it('does not touch the balance for a lost bet (payout 0)', async () => {
    const tx = makeSettleTx([{ id: 'bet-1', playerId: 'player-1' }])

    await bankrollService.settleBet(tx as never, { betId: 'bet-1', status: 'lost', payout: 0 })

    expect(tx.update).toHaveBeenCalledTimes(1)
  })
})
