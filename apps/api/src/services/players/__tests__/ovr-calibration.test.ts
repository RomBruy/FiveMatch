import { describe, it, expect } from 'vitest'
import {
  OVR_ATTRIBUTE_WEIGHTS,
  ALPHA_FLOOR,
  ALPHA_DECAY,
  ALPHA_BASE,
  ALPHA_CEIL,
  GROUP_TIER_MULTIPLIERS,
  ALGORITHM_CONSTANTS_VERSION,
} from '@fivematch/types/algorithm-constants'

// ─── Inline helpers (mirror the formula — no service files yet) ───────────────

function computeAlpha(distinctRatersCount: number, tierMultiplier: number = GROUP_TIER_MULTIPLIERS.club): number {
  const raw = ALPHA_BASE - distinctRatersCount * ALPHA_DECAY
  const base = Math.max(ALPHA_FLOOR, raw)
  return Math.min(ALPHA_CEIL, Math.max(ALPHA_FLOOR, base * tierMultiplier))
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

function applyEma(oldOvr: number, matchImpact: number, distinctRatersCount: number, tierMultiplier: number = GROUP_TIER_MULTIPLIERS.club): number {
  const alpha = computeAlpha(distinctRatersCount, tierMultiplier)
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

  describe('computeAlpha — adaptive decay on rater diversity', () => {
    it('alpha at distinctRatersCount=0 equals ALPHA_BASE (0.22) for club tier', () => {
      // raw = 0.22 - 0×0.006 = 0.22; base = max(0.10, 0.22) = 0.22; club ×1.0 = 0.22
      expect(computeAlpha(0)).toBeCloseTo(0.22, 10)
    })

    it('alpha at distinctRatersCount=20 hits the floor (0.10) for club tier', () => {
      // raw = 0.22 - 20×0.006 = 0.22 - 0.12 = 0.10 → exactly at floor
      expect(computeAlpha(20)).toBeCloseTo(0.10, 10)
    })

    it('alpha at distinctRatersCount=50 stays pinned at floor (0.10) for club tier', () => {
      // raw = 0.22 - 50×0.006 = 0.22 - 0.30 = -0.08 → clamped to ALPHA_FLOOR
      expect(computeAlpha(50)).toBeCloseTo(ALPHA_FLOOR, 10)
    })

    it('alpha never falls below ALPHA_FLOOR for any distinctRatersCount', () => {
      for (const dc of [0, 10, 20, 30, 40, 50, 100, 500]) {
        expect(computeAlpha(dc)).toBeGreaterThanOrEqual(ALPHA_FLOOR)
      }
    })

    it('alpha never exceeds ALPHA_CEIL for any tier/rater-count combination', () => {
      for (const dc of [0, 5, 10]) {
        for (const tier of Object.values(GROUP_TIER_MULTIPLIERS)) {
          expect(computeAlpha(dc, tier)).toBeLessThanOrEqual(ALPHA_CEIL)
        }
      }
    })
  })

  describe('applyEma — OVR update', () => {
    it('EMA update at distinctRatersCount=15 produces expected value (regression baseline)', () => {
      // raw = 0.22 - 15×0.006 = 0.22 - 0.09 = 0.13; club ×1.0 → alpha = 0.13
      // new_ovr = (1-0.13)×7.0 + 0.13×5.0 = 6.09 + 0.65 = 6.74
      const result = applyEma(7.0, 5.0, 15)
      expect(result).toBeCloseTo(6.74, 5)
    })
  })

  describe('GROUP_TIER_MULTIPLIERS — tier modulation (folded inside clamp)', () => {
    it('amateur tier multiplier reduces effective alpha vs club at distinctRatersCount=0', () => {
      const amateurAlpha = computeAlpha(0, GROUP_TIER_MULTIPLIERS.amateur)
      const clubAlpha    = computeAlpha(0, GROUP_TIER_MULTIPLIERS.club)
      // amateur: clamp(0.22×0.8, 0.10, 0.30) = 0.176
      // club:    clamp(0.22×1.0, 0.10, 0.30) = 0.22
      expect(amateurAlpha).toBeCloseTo(0.176, 10)
      expect(amateurAlpha).toBeLessThan(clubAlpha)
    })

    it('elite tier multiplier increases effective alpha vs club at distinctRatersCount=0', () => {
      const eliteAlpha = computeAlpha(0, GROUP_TIER_MULTIPLIERS.elite)
      const clubAlpha  = computeAlpha(0, GROUP_TIER_MULTIPLIERS.club)
      // elite: clamp(0.22×1.2, 0.10, 0.30) = 0.264
      expect(eliteAlpha).toBeCloseTo(0.264, 10)
      expect(eliteAlpha).toBeGreaterThan(clubAlpha)
    })

    it('elite alpha is capped at ALPHA_CEIL even with low distinctRatersCount', () => {
      // At distinctRatersCount=0: 0.22×1.2 = 0.264 < 0.30 so not capped yet
      // At distinctRatersCount=0 with a hypothetical 2.0 multiplier it would exceed ALPHA_CEIL
      // Verify the cap is enforced
      const result = computeAlpha(0, 2.0) // hypothetical extreme
      expect(result).toBeLessThanOrEqual(ALPHA_CEIL)
    })
  })
})
