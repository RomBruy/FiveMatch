import {
  GOAL_TECHNIQUE_BOOST,
  GOAL_PACE_BOOST,
  ASSIST_PASSING_BOOST,
} from '@fivematch/types/algorithm-constants'
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
  // Apply goal and assist boosts to the per-match attribute aggregate
  // These boosts are ephemeral — they affect the EMA signal only, NOT players.avg* columns
  const boostedTechnique = agg.avgTechnique + (agg.goalsScored > 0 ? GOAL_TECHNIQUE_BOOST : 0)
  const boostedPace = agg.avgPace + (agg.goalsScored > 0 ? GOAL_PACE_BOOST : 0)
  const boostedPassing = agg.avgPassing + (agg.assists > 0 ? ASSIST_PASSING_BOOST : 0)

  // Signal value is on the OVR scale (40–99): multiply computeOvr (1–10 range) by 10
  const rawOvr = ovrService.computeOvr({
    pace: boostedPace,
    technique: boostedTechnique,
    passing: boostedPassing,
    defending: agg.avgDefending,
    physicality: agg.avgPhysicality,
    effort: agg.avgEffort,
  })

  return {
    type: 'post_match_rating',
    playerId,
    groupId,
    value: rawOvr * 10, // scale to OVR range (1–10 attrs → 10–100 OVR)
    weight: 1,           // standard weight — EMA is dominated by rating data
    computedAt: new Date(),
  }
}
