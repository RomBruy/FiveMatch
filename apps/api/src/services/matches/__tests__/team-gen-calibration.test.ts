import { describe, it, expect } from 'vitest'
import {
  TEAM_GEN_WEIGHTS,
  TEAM_GEN_EXHAUSTIVE_THRESHOLD,
  TEAM_GEN_SAMPLE_POOL_SIZE,
  ALGORITHM_CONSTANTS_VERSION,
} from '@fivematch/types/algorithm-constants'

// ─── Local types (no service files yet) ──────────────────────────────────────

interface Player { ovr: number }

// ─── Inline helpers (mirror the fairness formula — not the production composite) ─

const FAIRNESS_MIN_THRESHOLD = 0.80

function ratingGap(teamA: Player[], teamB: Player[]): number {
  const avg = (t: Player[]) => t.reduce((s, p) => s + p.ovr, 0) / t.length
  return Math.abs(avg(teamA) - avg(teamB))
}

function fairnessScore(teamA: Player[], teamB: Player[], maxOvrRange = 10): number {
  return 1 - ratingGap(teamA, teamB) / maxOvrRange
}

function penaltyScore(teamA: Player[], teamB: Player[]): number {
  return TEAM_GEN_WEIGHTS.w1_ratingGap * ratingGap(teamA, teamB)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe(`Team Gen Calibration Baseline (${ALGORITHM_CONSTANTS_VERSION})`, () => {

  describe('constants', () => {
    it('TEAM_GEN_EXHAUSTIVE_THRESHOLD = 16', () => {
      expect(TEAM_GEN_EXHAUSTIVE_THRESHOLD).toBe(16)
    })

    it('TEAM_GEN_SAMPLE_POOL_SIZE >= 50', () => {
      expect(TEAM_GEN_SAMPLE_POOL_SIZE).toBeGreaterThanOrEqual(50)
    })

    it('all w1–w7 weights are positive numbers', () => {
      for (const [key, val] of Object.entries(TEAM_GEN_WEIGHTS)) {
        expect(val, `${key} must be positive`).toBeGreaterThan(0)
      }
    })

    it('w3_goalkeeperPenalty is the largest weight', () => {
      const max = Math.max(...Object.values(TEAM_GEN_WEIGHTS))
      expect(TEAM_GEN_WEIGHTS.w3_goalkeeperPenalty).toBe(max)
    })
  })

  describe('fairness score — split quality', () => {
    it('balanced roster → Fairness Score ≥ 0.80', () => {
      // alternating OVRs: teamA avg=5.5, teamB avg=4.5, gap=1.0 → score=0.90
      const ovrs = [5.5, 4.5, 5.5, 4.5, 5.5, 4.5, 5.5, 4.5, 5.5, 4.5]
      const players = ovrs.map((ovr) => ({ ovr }))
      const teamA = players.filter((_, i) => i % 2 === 0)
      const teamB = players.filter((_, i) => i % 2 !== 0)
      const score = fairnessScore(teamA, teamB)
      expect(score).toBeGreaterThanOrEqual(FAIRNESS_MIN_THRESHOLD)
    })

    it('unbalanced roster → Fairness Score < 0.80', () => {
      // teamA all 9.0, teamB all 5.0 → gap=4.0 → score=0.60
      const teamA: Player[] = Array(5).fill({ ovr: 9.0 })
      const teamB: Player[] = Array(5).fill({ ovr: 5.0 })
      const score = fairnessScore(teamA, teamB)
      expect(score).toBeLessThan(FAIRNESS_MIN_THRESHOLD)
    })
  })

  describe('penalty score', () => {
    it('penalty score is a finite non-negative number', () => {
      const teamA: Player[] = [{ ovr: 7.0 }, { ovr: 6.5 }, { ovr: 6.0 }, { ovr: 5.5 }, { ovr: 5.0 }]
      const teamB: Player[] = [{ ovr: 6.8 }, { ovr: 6.3 }, { ovr: 5.8 }, { ovr: 5.3 }, { ovr: 4.8 }]
      const score = penaltyScore(teamA, teamB)
      expect(Number.isFinite(score)).toBe(true)
      expect(score).toBeGreaterThanOrEqual(0)
    })
  })
})
