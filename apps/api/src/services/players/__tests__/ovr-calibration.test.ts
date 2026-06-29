import { describe, it, expect } from 'vitest'
import {
  OVR_ATTRIBUTE_WEIGHTS,
  EMA_ALPHA_MIN,
  EMA_ALPHA_DECAY,
  EMA_ALPHA_START,
  GROUP_TIER_MULTIPLIERS,
  ALGORITHM_CONSTANTS_VERSION,
} from '@fivematch/types/algorithm-constants'

// ─── Inline helpers (mirror the formula — no service files yet) ───────────────

function computeAlpha(matchCount: number, tierMultiplier: number = GROUP_TIER_MULTIPLIERS.club): number {
  const raw = EMA_ALPHA_START - matchCount * EMA_ALPHA_DECAY
  return Math.max(EMA_ALPHA_MIN, raw * tierMultiplier)
}

function computeMatchImpact(attrs: {
  technique: number; defending: number; effort: number
  passing: number; physicality: number; pace: number
}): number {
  return (
    attrs.technique   * OVR_ATTRIBUTE_WEIGHTS.technique +
    attrs.defending   * OVR_ATTRIBUTE_WEIGHTS.defending +
    attrs.effort      * OVR_ATTRIBUTE_WEIGHTS.effort +
    attrs.passing     * OVR_ATTRIBUTE_WEIGHTS.passing +
    attrs.physicality * OVR_ATTRIBUTE_WEIGHTS.physicality +
    attrs.pace        * OVR_ATTRIBUTE_WEIGHTS.pace
  )
}

function applyEma(oldOvr: number, matchImpact: number, matchCount: number, tierMultiplier: number = GROUP_TIER_MULTIPLIERS.club): number {
  const alpha = computeAlpha(matchCount, tierMultiplier)
  return (1 - alpha) * oldOvr + alpha * matchImpact
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe(`OVR Calibration Baseline (${ALGORITHM_CONSTANTS_VERSION})`, () => {

  describe('OVR_ATTRIBUTE_WEIGHTS', () => {
    it('weights sum to exactly 1.0', () => {
      const sum = Object.values(OVR_ATTRIBUTE_WEIGHTS).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(1.0, 10)
    })

    it('all attributes = 5.0 → match_impact = 5.0', () => {
      const impact = computeMatchImpact({
        technique: 5.0, defending: 5.0, effort: 5.0,
        passing: 5.0, physicality: 5.0, pace: 5.0,
      })
      expect(impact).toBeCloseTo(5.0, 10)
    })

    it('higher attributes produce higher match_impact (monotonicity)', () => {
      const low = computeMatchImpact({
        technique: 3.0, defending: 3.0, effort: 3.0,
        passing: 3.0, physicality: 3.0, pace: 3.0,
      })
      const high = computeMatchImpact({
        technique: 8.0, defending: 8.0, effort: 8.0,
        passing: 8.0, physicality: 8.0, pace: 8.0,
      })
      expect(high).toBeGreaterThan(low)
    })
  })

  describe('computeAlpha — adaptive decay', () => {
    it('alpha at matchCount=0 equals EMA_ALPHA_START (0.25)', () => {
      expect(computeAlpha(0)).toBeCloseTo(0.25, 10)
    })

    it('alpha at matchCount=30 hits the floor (0.10)', () => {
      // 0.25 - 30×0.005 = 0.25 - 0.15 = 0.10 → exactly at floor
      expect(computeAlpha(30)).toBeCloseTo(0.10, 10)
    })

    it('alpha at matchCount=50 stays pinned at floor (0.10)', () => {
      // 0.25 - 50×0.005 = 0.25 - 0.25 = 0.00 → clamped to EMA_ALPHA_MIN
      expect(computeAlpha(50)).toBeCloseTo(EMA_ALPHA_MIN, 10)
    })

    it('alpha never falls below EMA_ALPHA_MIN for any matchCount', () => {
      for (const mc of [0, 10, 20, 30, 40, 50, 100, 500]) {
        expect(computeAlpha(mc)).toBeGreaterThanOrEqual(EMA_ALPHA_MIN)
      }
    })
  })

  describe('applyEma — OVR update', () => {
    it('EMA update at matchCount=15 produces 6.65 (regression baseline)', () => {
      // raw_alpha = 0.25 - 15×0.005 = 0.175; club multiplier 1.0 → 0.175
      // new_ovr = (1-0.175)×7.0 + 0.175×5.0 = 5.775 + 0.875 = 6.65
      const result = applyEma(7.0, 5.0, 15)
      expect(result).toBeCloseTo(6.65, 5)
    })
  })

  describe('GROUP_TIER_MULTIPLIERS — tier modulation', () => {
    it('amateur tier multiplier reduces effective alpha vs club at matchCount=0', () => {
      const amateurAlpha = computeAlpha(0, GROUP_TIER_MULTIPLIERS.amateur)
      const clubAlpha    = computeAlpha(0, GROUP_TIER_MULTIPLIERS.club)
      // amateur: max(0.10, 0.25×0.8) = max(0.10, 0.20) = 0.20
      // club:    max(0.10, 0.25×1.0) = 0.25
      expect(amateurAlpha).toBeCloseTo(0.20, 10)
      expect(amateurAlpha).toBeLessThan(clubAlpha)
    })

    it('elite tier multiplier increases effective alpha vs club at matchCount=0', () => {
      const eliteAlpha = computeAlpha(0, GROUP_TIER_MULTIPLIERS.elite)
      const clubAlpha  = computeAlpha(0, GROUP_TIER_MULTIPLIERS.club)
      // elite: max(0.10, 0.25×1.2) = max(0.10, 0.30) = 0.30
      expect(eliteAlpha).toBeCloseTo(0.30, 10)
      expect(eliteAlpha).toBeGreaterThan(clubAlpha)
    })
  })
})
