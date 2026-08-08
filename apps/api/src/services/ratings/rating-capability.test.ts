import { describe, expect, it } from 'vitest'
import { evaluateRatingCapability } from './rating-capability'

const valid = {
  matchStatus: 'completed' as const,
  windowOpen: true,
  raterPlayerId: 'rater',
  targetPlayerId: 'target',
  raterTeamSide: 'A' as const,
  targetTeamSide: 'B' as const,
}

describe('post-match rating capability', () => {
  it('allows a final opponent while the completed-match window is open', () => {
    expect(evaluateRatingCapability(valid)).toEqual({ allowed: true })
  })

  it.each([
    [{ ...valid, matchStatus: 'in_progress' as const }, 'WRONG_MATCH_STATUS'],
    [{ ...valid, windowOpen: false }, 'RATING_WINDOW_CLOSED'],
    [{ ...valid, raterTeamSide: null }, 'NOT_A_PARTICIPANT'],
    [{ ...valid, targetTeamSide: null }, 'NOT_A_PARTICIPANT'],
    [{ ...valid, targetPlayerId: 'rater' }, 'CANNOT_RATE_SELF'],
    [{ ...valid, targetTeamSide: 'A' as const }, 'CANNOT_RATE_TEAMMATE'],
  ])('rejects invalid rating evidence', (input, code) => {
    expect(evaluateRatingCapability(input)).toEqual({ allowed: false, code })
  })
})
