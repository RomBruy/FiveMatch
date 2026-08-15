import { describe, it, expect } from 'vitest'
import {
  PRONOS_ODDS_MIN,
  PRONOS_ODDS_MAX,
  PRONOS_ODDS_MAX_SCORE,
  PRONOS_ODDS_MAX_MVP,
  PRONOS_MARGIN,
  PRONOS_DRAW_BASE,
  PRONOS_SCORE_GRID_MAX,
} from '@fivematch/types/algorithm-constants'
import {
  decimalOdds,
  resultProbabilities,
  computeResultOdds,
  goalRates,
  scorelineProbabilities,
  computeScoreOdds,
  computeMvpOdds,
  computeMatchOdds,
} from './odds-engine'

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)

describe('decimalOdds', () => {
  it('is the fair inverse of probability under a 1.0 margin', () => {
    expect(PRONOS_MARGIN).toBe(1.0)
    expect(decimalOdds(0.5)).toBe(2.0)
    expect(decimalOdds(0.25)).toBe(4.0)
    expect(decimalOdds(0.8)).toBe(1.25)
  })

  it('rounds to two decimals', () => {
    expect(decimalOdds(0.61)).toBe(1.64) // 1/0.61 = 1.6393…
  })

  it('clamps to [MIN, MAX] at the extremes', () => {
    expect(decimalOdds(0.999)).toBe(PRONOS_ODDS_MIN) // near-certainty floored
    expect(decimalOdds(0.001)).toBe(PRONOS_ODDS_MAX) // long shot capped
    expect(decimalOdds(0)).toBe(PRONOS_ODDS_MAX)
  })
})

describe('resultProbabilities', () => {
  it('always sums to 1', () => {
    for (const [a, b] of [[74, 74], [78, 70], [84, 66], [50, 99], [99, 40]]) {
      const p = resultProbabilities(a, b)
      expect(p.teamA + p.draw + p.teamB).toBeCloseTo(1, 10)
    }
  })

  it('is symmetric at parity: A and B equally likely, draw = PRONOS_DRAW_BASE', () => {
    const p = resultProbabilities(74, 74)
    expect(p.teamA).toBeCloseTo(p.teamB, 10)
    expect(p.draw).toBeCloseTo(PRONOS_DRAW_BASE, 10)
  })

  it('mirrors when the OVRs are swapped', () => {
    const p = resultProbabilities(78, 70)
    const q = resultProbabilities(70, 78)
    expect(p.teamA).toBeCloseTo(q.teamB, 10)
    expect(p.teamB).toBeCloseTo(q.teamA, 10)
    expect(p.draw).toBeCloseTo(q.draw, 10)
  })

  it('makes the stronger team more likely, and the draw fades with the mismatch', () => {
    const even = resultProbabilities(74, 74)
    const edge = resultProbabilities(78, 70)
    const blowout = resultProbabilities(90, 60)
    expect(edge.teamA).toBeGreaterThan(edge.teamB)
    expect(blowout.teamA).toBeGreaterThan(edge.teamA)
    expect(edge.draw).toBeLessThan(even.draw)
    expect(blowout.draw).toBeLessThan(edge.draw)
  })
})

describe('computeResultOdds', () => {
  it('gives equal A/B cotes at parity and shorter odds to the favorite', () => {
    const even = computeResultOdds(74, 74)
    expect(even.teamA).toBe(even.teamB)

    const odds = computeResultOdds(84, 66)
    expect(odds.teamA).toBeLessThan(odds.teamB) // favorite pays less
    expect(odds.teamB).toBeGreaterThan(odds.teamA) // underdog pays more
    for (const o of [odds.teamA, odds.draw, odds.teamB]) {
      expect(o).toBeGreaterThanOrEqual(PRONOS_ODDS_MIN)
      expect(o).toBeLessThanOrEqual(PRONOS_ODDS_MAX)
    }
  })

  it('backing the underdog pays materially more than the favorite in a mismatch', () => {
    const odds = computeResultOdds(84, 66)
    expect(odds.teamB / odds.teamA).toBeGreaterThan(2) // the whole point of the rework
  })
})

describe('goalRates', () => {
  it('is even at parity and tilts toward the stronger team', () => {
    const even = goalRates(74, 74)
    expect(even.lambdaA).toBeCloseTo(even.lambdaB, 10)

    const tilted = goalRates(84, 64)
    expect(tilted.lambdaA).toBeGreaterThan(tilted.lambdaB)
  })

  it('keeps both rates strictly positive even at an extreme gap', () => {
    const extreme = goalRates(99, 40)
    expect(extreme.lambdaB).toBeGreaterThan(0)
    expect(extreme.lambdaA).toBeGreaterThan(0)
  })
})

describe('scorelineProbabilities', () => {
  it('enumerates the full (GRID_MAX+1)^2 scoreline grid', () => {
    const grid = scorelineProbabilities(78, 70)
    expect(grid).toHaveLength((PRONOS_SCORE_GRID_MAX + 1) ** 2)
  })

  it('sums to 1 across all scorelines', () => {
    expect(sum(scorelineProbabilities(78, 70).map((s) => s.prob))).toBeCloseTo(1, 6)
  })

  it('is internally consistent: scorelines within a result sum to the 1X2 result probability', () => {
    const teamAOvr = 80
    const teamBOvr = 68
    const res = resultProbabilities(teamAOvr, teamBOvr)
    const grid = scorelineProbabilities(teamAOvr, teamBOvr)

    const massFor = (pred: (a: number, b: number) => boolean) =>
      sum(grid.filter((s) => pred(s.scoreA, s.scoreB)).map((s) => s.prob))

    expect(massFor((a, b) => a > b)).toBeCloseTo(res.teamA, 6)
    expect(massFor((a, b) => a === b)).toBeCloseTo(res.draw, 6)
    expect(massFor((a, b) => a < b)).toBeCloseTo(res.teamB, 6)
  })
})

describe('computeScoreOdds', () => {
  it('returns scorelines most-likely first, all within the odds clamp', () => {
    const scores = computeScoreOdds(78, 70)
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].odds).toBeLessThanOrEqual(scores[i].odds)
    }
    for (const s of scores) {
      expect(s.odds).toBeGreaterThanOrEqual(PRONOS_ODDS_MIN)
      // The score market has its own ceiling: an 81-cell grid needs headroom the
      // 1X2 bound never gave it, which is what flattened the board to all-15.00.
      expect(s.odds).toBeLessThanOrEqual(PRONOS_ODDS_MAX_SCORE)
    }
  })

  it('prices a rare high-scoring line longer than the modal line', () => {
    const scores = computeScoreOdds(74, 74)
    const modal = scores[0] // shortest price
    const wild = scores.find((s) => s.scoreA === PRONOS_SCORE_GRID_MAX && s.scoreB === PRONOS_SCORE_GRID_MAX)!
    expect(wild.odds).toBeGreaterThan(modal.odds)
  })
})

describe('computeMvpOdds', () => {
  const squad = [
    { playerId: 'a', ovr: 90 },
    { playerId: 'b', ovr: 70 },
    { playerId: 'c', ovr: 50 },
  ]

  it('makes the strongest player the shortest price, sorted favorite-first', () => {
    const odds = computeMvpOdds(squad)
    expect(odds[0].playerId).toBe('a')
    expect(odds[0].odds).toBeLessThan(odds[odds.length - 1].odds)
  })

  it('prices by share of rating ABOVE the floor, not of the raw rating', () => {
    const odds = computeMvpOdds(squad)
    const a = odds.find((o) => o.playerId === 'a')!
    // above-baseline shares: 51 / (51 + 31 + 11) = 0.5484 → 1.82.
    // Dividing raw ratings gave 90/210 = 0.4286 → 2.33, which treated the 40-99
    // scale as if it started at zero and squashed the whole field together.
    expect(a.odds).toBeCloseTo(1.82, 2)
  })

  it('spreads the field far wider than a raw-share price would', () => {
    const odds = computeMvpOdds(squad)
    const shortest = odds[0].odds
    const longest = odds[odds.length - 1].odds
    // Raw shares priced this squad 2.33 → 4.20, a 1.8x range across a 40-point
    // rating gap. Anything under 3x means the market has gone flat again.
    expect(longest / shortest).toBeGreaterThan(3)
  })

  it('handles an all-zero / empty roster without dividing by zero', () => {
    expect(computeMvpOdds([]).length).toBe(0)
    // Below the baseline every share is zero, so the market's own ceiling stands in.
    const zero = computeMvpOdds([{ playerId: 'x', ovr: 0 }])
    expect(zero[0].odds).toBe(PRONOS_ODDS_MAX_MVP)
  })
})

describe('computeMatchOdds', () => {
  it('bundles the three markets', () => {
    const odds = computeMatchOdds(78, 70, [
      { playerId: 'a', ovr: 80 },
      { playerId: 'b', ovr: 72 },
    ])
    expect(odds.result.teamA).toBeGreaterThan(0)
    expect(odds.scores.length).toBe((PRONOS_SCORE_GRID_MAX + 1) ** 2)
    expect(odds.mvp.length).toBe(2)
  })
})
