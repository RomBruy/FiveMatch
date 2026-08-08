import { describe, expect, it } from 'vitest'
import {
  cardStateForEligibleCount,
  hasPhase1EligibilityEvidence,
} from '../eligibility.service'

describe('Phase 1 canonical match eligibility', () => {
  it('accepts only completed matches with a valid result', () => {
    expect(hasPhase1EligibilityEvidence({ status: 'completed', scoreA: 2, scoreB: 1 })).toBe(true)
    expect(hasPhase1EligibilityEvidence({ status: 'completed', scoreA: null, scoreB: 1 })).toBe(false)
    expect(hasPhase1EligibilityEvidence({ status: 'completed', scoreA: 2, scoreB: null })).toBe(false)
    expect(hasPhase1EligibilityEvidence({ status: 'cancelled', scoreA: 2, scoreB: 1 })).toBe(false)
    expect(hasPhase1EligibilityEvidence({ status: 'in_progress', scoreA: 2, scoreB: 1 })).toBe(false)
  })

  it('derives card progress from unique eligibility count without an initial rating gate', () => {
    expect(cardStateForEligibleCount(0)).toBe('not_started')
    expect(cardStateForEligibleCount(1)).toBe('in_progress_1')
    expect(cardStateForEligibleCount(2)).toBe('in_progress_2')
    expect(cardStateForEligibleCount(3)).toBe('in_progress_3')
    expect(cardStateForEligibleCount(4)).toBe('unlocked')
    expect(cardStateForEligibleCount(8)).toBe('unlocked')
  })
})
