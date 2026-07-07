// post-match-rating-signal.ts
// This legacy signal builder is no longer used in the main post-match pipeline.
// In v2, goal/assist contributions are applied explicitly in Step 5 of applyEmaWithBreakdown
// rather than as ephemeral attribute boosts, eliminating the double-counting issue.
// Kept for reference; do not call from runPostMatchUpdate.

import { ovrService } from '../ovr.service'
import type { OvrSignal } from '../ovr-signal'

interface MatchRatingAgg {
  avgPace: number
  avgTechnique: number
  avgPassing: number
  avgDefending: number
  avgPhysicality: number
  avgEffort: number
  goalsScored: number
  assists: number
}

export function createPostMatchRatingSignal(
  playerId: string,
  groupId: string,
  agg: MatchRatingAgg,
): OvrSignal {
  const rawOvr = ovrService.computeOvr({
    pace: agg.avgPace,
    technique: agg.avgTechnique,
    passing: agg.avgPassing,
    defending: agg.avgDefending,
    physicality: agg.avgPhysicality,
    effort: agg.avgEffort,
  })

  return {
    type: 'post_match_rating',
    playerId,
    groupId,
    value: rawOvr * 10,
    weight: 1,
    computedAt: new Date(),
  }
}
