import { describe, expect, it, vi } from 'vitest'
import { RELIABLE_CHECK_MIN_MATCHES, TRUST_MIN_SAMPLE } from '@fivematch/types'

vi.mock('../../../db', () => ({ db: {} }))

import {
  computeFairPlay,
  computeReliability,
  earnsReliableCheck,
  recencyWeight,
  type BehaviourRecord,
  type OutcomeRecord,
} from '../trust-projection.service'

const attended = (arrivedLate = false): OutcomeRecord => ({ outcome: 'attended', arrivedLate })
const excused = (): OutcomeRecord => ({ outcome: 'excused', arrivedLate: false })
const lateCancel = (): OutcomeRecord => ({ outcome: 'late_cancel', arrivedLate: false })
const noShow = (): OutcomeRecord => ({ outcome: 'no_show', arrivedLate: false })

const fill = (count: number, record: () => OutcomeRecord) => Array.from({ length: count }, record)

describe('recencyWeight', () => {
  it('gives the most recent record full weight', () => {
    expect(recencyWeight(0)).toBe(1)
  })

  it('halves weight at the half-life', () => {
    expect(recencyWeight(10)).toBeCloseTo(0.5, 10)
    expect(recencyWeight(20)).toBeCloseTo(0.25, 10)
  })
})

describe('computeReliability', () => {
  it('withholds a score below the minimum sample', () => {
    expect(computeReliability(fill(TRUST_MIN_SAMPLE - 1, () => attended()))).toBeNull()
  })

  it('scores a perfect attendance record at 100', () => {
    expect(computeReliability(fill(10, () => attended()))).toBe(100)
  })

  it('scores a total no-show record at 0', () => {
    expect(computeReliability(fill(10, () => noShow()))).toBe(0)
  })

  it('does not penalise the first two excused absences', () => {
    const perfect = computeReliability(fill(10, () => attended()))
    const withTwoExcuses = computeReliability([excused(), excused(), ...fill(8, () => attended())])

    expect(withTwoExcuses).toBe(perfect)
    expect(withTwoExcuses).toBe(100)
  })

  it('penalises the third excused absence', () => {
    const withThree = computeReliability([
      excused(), excused(), excused(), ...fill(7, () => attended()),
    ])

    expect(withThree).not.toBeNull()
    expect(withThree!).toBeLessThan(100)
  })

  it('treats a late arrival as gentler than a late cancellation', () => {
    const late = computeReliability([attended(true), ...fill(9, () => attended())])
    const cancelled = computeReliability([lateCancel(), ...fill(9, () => attended())])

    expect(late!).toBeGreaterThan(cancelled!)
    expect(late!).toBeLessThan(100)
  })

  it('weights a recent no-show more heavily than an old one', () => {
    const recent = computeReliability([noShow(), ...fill(19, () => attended())])
    const old = computeReliability([...fill(19, () => attended()), noShow()])

    // The whole point of the window: who you are now counts for more.
    expect(old!).toBeGreaterThan(recent!)
  })

  it('lets an old no-show fall out of the window entirely', () => {
    // The caller truncates to the window, so a record beyond it simply is not here.
    const stillInside = computeReliability([...fill(19, () => attended()), noShow()])
    const fallenOut = computeReliability(fill(20, () => attended()))

    expect(fallenOut).toBe(100)
    expect(stillInside!).toBeLessThan(100)
  })

  it('spends the excuse allowance on the most recent absences', () => {
    // Counted newest-first, so the allowance protects what just happened.
    const recentExcuses = computeReliability([
      excused(), excused(), ...fill(18, () => attended()),
    ])
    expect(recentExcuses).toBe(100)
  })
})

describe('computeFairPlay', () => {
  const sample = TRUST_MIN_SAMPLE + 6

  it('withholds a score below the minimum sample', () => {
    expect(computeFairPlay([], TRUST_MIN_SAMPLE - 1)).toBeNull()
  })

  it('starts a clean record at 100', () => {
    expect(computeFairPlay([], sample)).toBe(100)
  })

  it('subtracts more for a severe category than a mild one', () => {
    const severe = computeFairPlay([{ category: 'dangerous_play', matchIndex: 0 }], sample)
    const mild = computeFairPlay([{ category: 'unsporting', matchIndex: 0 }], sample)

    expect(severe!).toBeLessThan(mild!)
    expect(mild!).toBeLessThan(100)
  })

  it('caps the credit praise can contribute', () => {
    const manyPositives: BehaviourRecord[] = Array.from({ length: 40 }, (_, i) => ({
      category: 'good_spirit' as const,
      matchIndex: i % 5,
    }))

    // Already at the ceiling with no penalties, so the cap shows as a clamp to 100.
    expect(computeFairPlay(manyPositives, sample)).toBe(100)

    // With a penalty to offset, the cap becomes visible: +10 and no more.
    const withPenalty = computeFairPlay(
      [...manyPositives, { category: 'dangerous_play', matchIndex: 0 }],
      sample,
    )
    expect(withPenalty).toBe(100 - 15 + 10)
  })

  it('never falls below zero', () => {
    const many: BehaviourRecord[] = Array.from({ length: 20 }, () => ({
      category: 'dangerous_play' as const,
      matchIndex: 0,
    }))
    expect(computeFairPlay(many, sample)).toBe(0)
  })

  it('decays an old report relative to a recent one', () => {
    const recent = computeFairPlay([{ category: 'aggression', matchIndex: 0 }], sample)
    const old = computeFairPlay([{ category: 'aggression', matchIndex: 19 }], sample)

    expect(old!).toBeGreaterThan(recent!)
  })
})

describe('earnsReliableCheck', () => {
  it('withholds the mark below the match minimum', () => {
    expect(earnsReliableCheck(100, RELIABLE_CHECK_MIN_MATCHES - 1)).toBe(false)
  })

  it('grants the mark to a strong record with enough matches', () => {
    expect(earnsReliableCheck(100, RELIABLE_CHECK_MIN_MATCHES)).toBe(true)
  })

  it('withholds the mark from an unrated player', () => {
    expect(earnsReliableCheck(null, 50)).toBe(false)
  })

  it('is one-directional — a weak record simply has no mark', () => {
    // There is no failing counterpart to return. A new player and a player with
    // a poor record are indistinguishable from outside, which is the point.
    expect(earnsReliableCheck(40, 50)).toBe(false)
    expect(earnsReliableCheck(null, 0)).toBe(false)
  })
})
