// rating-events.ts — Audit trail types for OVR changes.
// Every OVR mutation writes one RatingEvent. The breakdown is safe to expose via API;
// rater identities live only in raw_initial_seed_ratings.raterUserId (internal, GDPR target).

export type RatingEventType = 'INITIAL_SEED' | 'MATCH_UPDATE'

export type InitialSeedBreakdown = {
  method: 'WEIGHTED_AVERAGE_WITH_PRIOR'
  priorOvr: number
  priorWeight: number
  observedWeight: number
  totalWeight: number
  organizerRatingIncluded: boolean
  organizerWeight: 2
  seedRatings: {
    ratingRef: string          // raw_initial_seed_ratings.id — NOT raterUserId
    sourceType: 'ORGANIZER' | 'PEER'
    rating: number
    weight: number
  }[]
  rawWeightedMean: number
  seededOvr: number            // float
  seedRatingStdDev: number | null   // null if single rater
  seedConfidence: number       // countFactor × agreementFactor
  seedStatus: 'PROVISIONAL' | 'CONFIDENT'
}

export type AttributeSet = {
  pace: number
  technique: number
  passing: number
  defending: number
  physicality: number
  effort: number
}

export type AlphaBreakdown = {
  matchCountBefore: number
  baseAlpha: number
  daysSinceLastMatch: number | null
  inactivityMultiplier: number
  uncertaintyAlpha: number
  raterCount: number
  ratingStdDev: number
  countFactor: number
  agreementFactor: number
  evidenceQuality: number
  finalAlphaBeforeClamp: number
  finalAlphaAfterClamp: number
}

export type MatchUpdateBreakdown = {
  matchId: string
  rawAttributes: AttributeSet
  boostedAttributes: AttributeSet
  goalCount: number
  assistCount: number
  raterCount: number
  ratingStdDev: number
  attributeScoreRaw: number
  matchImpactRaw: number
  matchImpactClamped: number
  mvpAdjustmentApplied: boolean
  matchImpactAfterMvp: number
  groupTier: 'amateur' | 'club' | 'semiPro' | 'elite'
  contextMultiplier: number
  performanceDelta: number
  contextAdjustedDelta: number
  adjustedMatchImpact: number
  alpha: AlphaBreakdown
  oldOvr: number
  newOvrBeforeClamp: number
  newOvr: number
  displayedOldOvr: number
  displayedNewOvr: number
  rawDelta: number
  displayedDelta: number
}

export type RatingEvent = {
  id: string
  playerId: string
  eventType: RatingEventType
  oldOvr: number | null        // null for INITIAL_SEED
  newOvr: number               // float
  seedStatus: 'PROVISIONAL' | 'CONFIDENT' | null  // top-level column for queryability; null for MATCH_UPDATE
  createdAt: Date
  breakdown: InitialSeedBreakdown | MatchUpdateBreakdown
}
