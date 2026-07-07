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
  // Two roles, two mechanisms (see ALPHA_BASE / DIVERSITY_SPRING comments in algorithm-constants.ts)
  matchCountBefore: number       // drives settling: alpha decays as matches accumulate
  distinctRatersBefore: number   // feeds diversity guard: keeps alpha springy when evidence is narrow
  diversityTarget: number        // min(activeRosterSize - 1, DIVERSITY_TARGET_CAP)
  // Settling component
  baseAlpha: number              // max(ALPHA_FLOOR, ALPHA_BASE - matchCount × ALPHA_DECAY)
  // Diversity guard component
  diversityGuard: number         // DIVERSITY_SPRING × max(0, 1 - distinct/target)
  adjustedBaseAlpha: number      // min(ALPHA_CEIL, baseAlpha + diversityGuard)
  // Evidence quality
  raterCount: number
  ratingStdDev: number           // stdDev of per-rater weighted-attribute scores (1–10 scale)
  countFactor: number            // min(1, raterCount / RATER_FULL)
  rawAgreementFactor: number     // agreement from stdDev alone (1.00 → 0.60)
  agreementFactor: number        // small-sample adjusted: 1 - countFactor*(1 - rawAgreementFactor)
  evidenceQuality: number        // countFactor × agreementFactor
  // Tier folded inside the clamp (v2 fix #1)
  tierMultiplier: number
  finalAlphaBeforeClamp: number  // adjustedBaseAlpha × evidenceQuality × tierMultiplier
  finalAlphaAfterClamp: number   // clamped to [ALPHA_FLOOR, ALPHA_CEIL]; 0 when raterCount < 2
}

export type MatchUpdateBreakdown = {
  matchId: string
  // Step 1 — averaged peer attributes (pure peer opinion, no boosts)
  rawAttributes: AttributeSet
  goalCount: number
  assistCount: number
  raterCount: number
  ratingStdDev: number
  // Step 3 — weighted attribute score (1–10 scale)
  attributeScoreRaw: number
  // Step 4 — calibrated OVR target
  matchImpactRaw: number
  matchImpactBase: number        // matchImpactRaw clamped to [40, 99]
  // Step 5 — objective signal assembly
  mvpBonus: number               // MVP_BONUS or 0; always additive (v2 fix #2)
  goalContribution: number       // min(OBJECTIVE_GOAL_CAP, goals×GOAL_PT + assists×ASSIST_PT)
  myTeamAvgOvr: number
  oppTeamAvgOvr: number
  expectedWin: number            // 0–1, logistic on OVR gap
  actual: number                 // 1.0 win | 0.5 draw | 0.0 loss
  outcomeAdjustment: number      // OUTCOME_WEIGHT × (actual − expectedWin)
  matchImpact: number            // final clamped impact entering the EMA
  // Steps 7–8 — reliability and EMA
  groupTier: 'amateur' | 'club' | 'semiPro' | 'elite'
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
