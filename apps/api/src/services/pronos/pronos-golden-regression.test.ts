import { describe, expect, it, vi } from 'vitest'
import {
  ALGORITHM_CONSTANTS_VERSION,
  PRONOS_BASE_GOALS,
  PRONOS_CLOSE_GOAL_TOLERANCE,
  PRONOS_CLOSE_REFUND,
  PRONOS_DRAW_BASE,
  PRONOS_DRAW_SCALE,
  PRONOS_GOAL_TILT_MAX,
  PRONOS_GOAL_TILT_SCALE,
  PRONOS_MARGIN,
  PRONOS_MAX_STAKE,
  PRONOS_ODDS_MAX,
  PRONOS_ODDS_MIN,
  PRONOS_SCORE_BOARD_SIZE,
  PRONOS_SCORE_GRID_MAX,
  PRONOS_STARTING_BANKROLL,
} from '@fivematch/types/algorithm-constants'

vi.mock('../../db', () => ({ db: {} }))

import { closeRefund, wonPayout } from './bankroll.service'
import {
  computeMvpOdds,
  computeResultOdds,
  computeScoreOdds,
  goalRates,
  resultProbabilities,
} from './odds-engine'

function normalize(value: unknown): unknown {
  if (typeof value === 'number') return Number(value.toFixed(12))
  if (Array.isArray(value)) return value.map(normalize)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalize(child)]))
  }
  return value
}

describe('Pronos v2.3 golden regression', () => {
  it('freezes the 1,000-point economy and pricing constants', () => {
    expect({
      ALGORITHM_CONSTANTS_VERSION,
      PRONOS_STARTING_BANKROLL,
      PRONOS_MAX_STAKE,
      PRONOS_CLOSE_REFUND,
      PRONOS_CLOSE_GOAL_TOLERANCE,
      PRONOS_DRAW_BASE,
      PRONOS_DRAW_SCALE,
      PRONOS_MARGIN,
      PRONOS_ODDS_MIN,
      PRONOS_ODDS_MAX,
      PRONOS_BASE_GOALS,
      PRONOS_GOAL_TILT_SCALE,
      PRONOS_GOAL_TILT_MAX,
      PRONOS_SCORE_GRID_MAX,
      PRONOS_SCORE_BOARD_SIZE,
    }).toEqual({
      ALGORITHM_CONSTANTS_VERSION: 'v2.3',
      PRONOS_STARTING_BANKROLL: 1000,
      PRONOS_MAX_STAKE: 500,
      PRONOS_CLOSE_REFUND: 0.4,
      PRONOS_CLOSE_GOAL_TOLERANCE: 1,
      PRONOS_DRAW_BASE: 0.26,
      PRONOS_DRAW_SCALE: 25,
      PRONOS_MARGIN: 1,
      PRONOS_ODDS_MIN: 1.1,
      PRONOS_ODDS_MAX: 15,
      PRONOS_BASE_GOALS: 2.5,
      PRONOS_GOAL_TILT_SCALE: 100,
      PRONOS_GOAL_TILT_MAX: 0.6,
      PRONOS_SCORE_GRID_MAX: 8,
      PRONOS_SCORE_BOARD_SIZE: 6,
    })
  })

  it('freezes representative 1X2, score and MVP prices', () => {
    const fixture = {
      resultEven: computeResultOdds(74, 74),
      resultGap: computeResultOdds(84, 66),
      probabilities: resultProbabilities(84, 66),
      rates: goalRates(84, 66),
      topSixEven: computeScoreOdds(74, 74).slice(0, 6),
      mvp: computeMvpOdds([
        { playerId: 'a', ovr: 90 },
        { playerId: 'b', ovr: 70 },
        { playerId: 'c', ovr: 50 },
      ]),
    }

    expect(normalize(fixture)).toEqual({
      resultEven: { teamA: 2.7, draw: 3.85, teamB: 2.7 },
      resultGap: { teamA: 1.6, draw: 6.46, teamB: 4.52 },
      probabilities: {
        teamA: 0.623832880406,
        draw: 0.154822860982,
        teamB: 0.221344258612,
      },
      rates: { lambdaA: 2.95, lambdaB: 2.05 },
      topSixEven: [
        { scoreA: 2, scoreB: 2, odds: 10.73 },
        { scoreA: 3, scoreB: 3, odds: 15 },
        { scoreA: 1, scoreB: 1, odds: 15 },
        { scoreA: 2, scoreB: 3, odds: 15 },
        { scoreA: 3, scoreB: 2, odds: 15 },
        { scoreA: 1, scoreB: 2, odds: 15 },
      ],
      mvp: [
        { playerId: 'a', odds: 2.33 },
        { playerId: 'b', odds: 3 },
        { playerId: 'c', odds: 4.2 },
      ],
    })
  })

  it('freezes payout rounding, close refunds and ledger reconstruction', () => {
    const bets = [
      { stake: 75, payout: wonPayout(75, 5.9) },
      { stake: 101, payout: closeRefund(101) },
      { stake: 33, payout: 0 },
    ]
    const auditedBalance = PRONOS_STARTING_BANKROLL
      + bets.reduce((total, bet) => total + bet.payout - bet.stake, 0)

    expect({ bets, auditedBalance }).toEqual({
      bets: [
        { stake: 75, payout: 443 },
        { stake: 101, payout: 40 },
        { stake: 33, payout: 0 },
      ],
      auditedBalance: 1274,
    })
  })
})

