import { describe, it, expect } from 'vitest'
import {
  PRONOS_CLOSE_GOAL_TOLERANCE,
  PRONOS_CLOSE_REFUND,
  PRONOS_SCORE_BOARD_SIZE,
} from '@fivematch/types/algorithm-constants'
import { resolveOutcome, buildOddsBoard, type RosterEntry } from './bet.service'

// Final score 4-2 → team A wins by 2.
const ACTUAL = {
  scoreA: 4,
  scoreB: 2,
  result: 'teamA' as const,
  score: '4-2',
  mvpPlayerId: 'player-mvp',
}

const bet = (market: string, selection: string, stake = 100, oddsAtBet = '2.13') =>
  ({ market, selection, stake, oddsAtBet })

describe('resolveOutcome — result market', () => {
  it('pays the frozen cote when the result is right', () => {
    expect(resolveOutcome(bet('result', 'teamA'), ACTUAL)).toEqual({ status: 'won', payout: 213 })
  })

  it('forfeits the stake on the wrong result', () => {
    expect(resolveOutcome(bet('result', 'draw'), ACTUAL)).toEqual({ status: 'lost', payout: 0 })
    expect(resolveOutcome(bet('result', 'teamB'), ACTUAL)).toEqual({ status: 'lost', payout: 0 })
  })
})

describe('resolveOutcome — correct-score market', () => {
  it('pays in full on the exact scoreline', () => {
    expect(resolveOutcome(bet('score', '4-2', 100, '11.87'), ACTUAL))
      .toEqual({ status: 'won', payout: 1187 })
  })

  it('refunds the close fraction when the result is right and the margin is within tolerance', () => {
    // predicted 3-1 (diff 2) vs actual 4-2 (diff 2) → delta 0
    expect(resolveOutcome(bet('score', '3-1'), ACTUAL))
      .toEqual({ status: 'close', payout: Math.round(PRONOS_CLOSE_REFUND * 100) })
  })

  it('treats a margin exactly at the tolerance as close', () => {
    // predicted 1-0 (diff 1) vs actual (diff 2) → delta 1
    const outcome = resolveOutcome(bet('score', '1-0'), ACTUAL)
    expect(outcome?.status).toBe(PRONOS_CLOSE_GOAL_TOLERANCE >= 1 ? 'close' : 'lost')
  })

  it('loses when the margin is beyond tolerance, even with the right result', () => {
    // predicted 5-0 (diff 5) vs actual (diff 2) → delta 3
    expect(resolveOutcome(bet('score', '5-0'), ACTUAL)).toEqual({ status: 'lost', payout: 0 })
  })

  it('loses when the result itself is wrong', () => {
    expect(resolveOutcome(bet('score', '2-3'), ACTUAL)).toEqual({ status: 'lost', payout: 0 })
    expect(resolveOutcome(bet('score', '2-2'), ACTUAL)).toEqual({ status: 'lost', payout: 0 })
  })

  it('leaves an unparseable scoreline unsettled rather than guessing', () => {
    expect(resolveOutcome(bet('score', 'not-a-score'), ACTUAL)).toBeNull()
  })
})

describe('resolveOutcome — MVP market', () => {
  it('pays when the named player took the MVP', () => {
    expect(resolveOutcome(bet('mvp', 'player-mvp', 100, '6.66'), ACTUAL))
      .toEqual({ status: 'won', payout: 666 })
  })

  it('forfeits when another player took it', () => {
    expect(resolveOutcome(bet('mvp', 'player-other'), ACTUAL)).toEqual({ status: 'lost', payout: 0 })
  })

  it('stays pending while the MVP vote is unresolved', () => {
    expect(resolveOutcome(bet('mvp', 'player-mvp'), { ...ACTUAL, mvpPlayerId: null })).toBeNull()
  })
})

describe('resolveOutcome — unknown market', () => {
  it('never settles a market it does not recognise', () => {
    expect(resolveOutcome(bet('roulette', 'rouge'), ACTUAL)).toBeNull()
  })
})

describe('buildOddsBoard', () => {
  const roster: RosterEntry[] = [
    { playerId: 'p1', displayName: 'Kevin B.', ovr: 87 },
    { playerId: 'p2', displayName: 'Sofiane M.', ovr: 81 },
    { playerId: 'p3', displayName: 'Tom R.', ovr: 78 },
  ]

  it('prices the three markets from the locked OVRs', () => {
    const board = buildOddsBoard(78, 70, roster)
    expect(board.result).toEqual({ teamA: 2.13, draw: 4.26, teamB: 3.38 })
  })

  it('exposes exactly PRONOS_SCORE_BOARD_SIZE scorelines, shortest price first', () => {
    const board = buildOddsBoard(78, 70, roster)
    expect(board.scores).toHaveLength(PRONOS_SCORE_BOARD_SIZE)
    for (let i = 1; i < board.scores.length; i++) {
      expect(board.scores[i - 1]!.odds).toBeLessThanOrEqual(board.scores[i]!.odds)
    }
  })

  it('gives every scoreline the selection string a bet must carry', () => {
    const top = buildOddsBoard(78, 70, roster).scores[0]!
    expect(top.selection).toBe(`${top.scoreA}-${top.scoreB}`)
  })

  it('attaches display names to the MVP market and keeps the favorite first', () => {
    const board = buildOddsBoard(78, 70, roster)
    expect(board.mvp).toHaveLength(3)
    expect(board.mvp[0]!.displayName).toBe('Kevin B.')
    expect(board.mvp[0]!.odds).toBeLessThan(board.mvp[2]!.odds)
  })

  it('survives an empty roster (teams generated but every player purged)', () => {
    const board = buildOddsBoard(78, 70, [])
    expect(board.mvp).toEqual([])
    expect(board.result.teamA).toBeGreaterThan(0)
  })
})
