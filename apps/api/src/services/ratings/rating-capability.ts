export type RatingCapabilityInput = {
  matchStatus: string
  windowOpen: boolean
  raterPlayerId: string
  targetPlayerId: string
  raterTeamSide: 'A' | 'B' | null
  targetTeamSide: 'A' | 'B' | null
}

export type RatingCapabilityResult =
  | { allowed: true }
  | {
      allowed: false
      code:
        | 'WRONG_MATCH_STATUS'
        | 'RATING_WINDOW_CLOSED'
        | 'NOT_A_PARTICIPANT'
        | 'CANNOT_RATE_SELF'
        | 'CANNOT_RATE_TEAMMATE'
    }

export function evaluateRatingCapability(input: RatingCapabilityInput): RatingCapabilityResult {
  if (input.matchStatus !== 'completed') return { allowed: false, code: 'WRONG_MATCH_STATUS' }
  if (!input.windowOpen) return { allowed: false, code: 'RATING_WINDOW_CLOSED' }
  if (input.raterTeamSide === null || input.targetTeamSide === null) {
    return { allowed: false, code: 'NOT_A_PARTICIPANT' }
  }
  if (input.raterPlayerId === input.targetPlayerId) return { allowed: false, code: 'CANNOT_RATE_SELF' }
  if (input.raterTeamSide === input.targetTeamSide) return { allowed: false, code: 'CANNOT_RATE_TEAMMATE' }
  return { allowed: true }
}
