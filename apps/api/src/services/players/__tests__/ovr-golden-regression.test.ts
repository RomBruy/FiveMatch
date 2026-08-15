import { describe, expect, it, vi } from 'vitest'
import {
  ALGORITHM_CONSTANTS_VERSION,
  ALPHA_BASE,
  ALPHA_CEIL,
  ALPHA_DECAY,
  ALPHA_FLOOR,
  ASSIST_PT,
  DIVERSITY_SPRING,
  DIVERSITY_TARGET_CAP,
  EXPECTED_SCALE_D,
  GOAL_PT,
  GROUP_TIER_MULTIPLIERS,
  MVP_BONUS,
  OBJECTIVE_GOAL_CAP,
  ORGANIZER_SEED_WEIGHT,
  OUTCOME_WEIGHT,
  OVR_ATTRIBUTE_WEIGHTS,
  OVR_CALIBRATION_ANCHORS,
  OVR_CLAMP_MAX,
  OVR_CLAMP_MIN,
  RATER_FULL,
  SEED_PRIOR_OVR_FALLBACK,
  SEED_SINGLE_RATER_AGREEMENT_FACTOR,
  TARGET_SEED_WEIGHT,
} from '@fivematch/types/algorithm-constants'

vi.mock('../../../db', () => ({ db: {} }))
vi.mock('../../../services/notifications/notification.service', () => ({
  notificationService: { send: vi.fn() },
}))

import { ovrService } from '../ovr.service'
import { buildSeedContext } from '../seeding.service'

function normalize(value: unknown): unknown {
  if (typeof value === 'number') return Number(value.toFixed(12))
  if (Array.isArray(value)) return value.map(normalize)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalize(child)]))
  }
  return value
}

const rating = (
  pace: number,
  technique: number,
  passing: number,
  defending: number,
  physicality: number,
  effort: number,
) => ({ pace, technique, passing, defending, physicality, effort })

describe('OVR v2.3 golden regression', () => {
  it('freezes the formula version and every constant used by the representative pipeline', () => {
    expect({
      ALGORITHM_CONSTANTS_VERSION,
      OVR_ATTRIBUTE_WEIGHTS,
      OVR_CALIBRATION_ANCHORS,
      ALPHA_BASE,
      ALPHA_DECAY,
      ALPHA_FLOOR,
      ALPHA_CEIL,
      DIVERSITY_SPRING,
      DIVERSITY_TARGET_CAP,
      RATER_FULL,
      GROUP_TIER_MULTIPLIERS,
      MVP_BONUS,
      GOAL_PT,
      ASSIST_PT,
      OBJECTIVE_GOAL_CAP,
      OUTCOME_WEIGHT,
      EXPECTED_SCALE_D,
      OVR_CLAMP_MIN,
      OVR_CLAMP_MAX,
      TARGET_SEED_WEIGHT,
      ORGANIZER_SEED_WEIGHT,
      SEED_PRIOR_OVR_FALLBACK,
      SEED_SINGLE_RATER_AGREEMENT_FACTOR,
    }).toEqual({
      ALGORITHM_CONSTANTS_VERSION: 'v2.4',
      OVR_ATTRIBUTE_WEIGHTS: {
        technique: 0.25,
        defending: 0.2,
        effort: 0.2,
        passing: 0.15,
        physicality: 0.1,
        pace: 0.1,
      },
      OVR_CALIBRATION_ANCHORS: [
        { rating: 1, ovr: 40 },
        { rating: 3, ovr: 51 },
        { rating: 5, ovr: 63 },
        { rating: 7, ovr: 76 },
        { rating: 9, ovr: 91 },
        { rating: 10, ovr: 99 },
      ],
      ALPHA_BASE: 0.22,
      ALPHA_DECAY: 0.006,
      ALPHA_FLOOR: 0.1,
      ALPHA_CEIL: 0.3,
      DIVERSITY_SPRING: 0.05,
      DIVERSITY_TARGET_CAP: 8,
      RATER_FULL: 5,
      GROUP_TIER_MULTIPLIERS: { amateur: 0.8, club: 1, semiPro: 1.1, elite: 1.2 },
      MVP_BONUS: 1.5,
      GOAL_PT: 0.6,
      ASSIST_PT: 0.4,
      OBJECTIVE_GOAL_CAP: 2,
      OUTCOME_WEIGHT: 2,
      EXPECTED_SCALE_D: 40,
      OVR_CLAMP_MIN: 40,
      OVR_CLAMP_MAX: 99,
      TARGET_SEED_WEIGHT: 6,
      ORGANIZER_SEED_WEIGHT: 2,
      SEED_PRIOR_OVR_FALLBACK: 65,
      SEED_SINGLE_RATER_AGREEMENT_FACTOR: 0.7,
    })
  })

  it('freezes weighted attributes, calibration anchors and legacy EMA outputs', () => {
    expect(normalize({
      weightedAttributes: ovrService.computeOvr(rating(7, 8, 6, 7, 6, 9)),
      calibration: [1, 3, 5, 7, 8, 9, 10].map((score) => ovrService.calibrateMatchImpact(score)),
      ema: [
        ovrService.applyEma(70, 50, 0),
        ovrService.applyEma(70, 50, 15),
        ovrService.applyEma(70, 90, 20),
      ],
    })).toEqual({
      weightedAttributes: 7.4,
      calibration: [40, 51, 63, 76, 83.5, 91, 99],
      ema: [65.6, 67.4, 72],
    })
  })

  it('freezes a complete representative post-match breakdown', () => {
    const result = ovrService.applyEmaWithBreakdown({
      matchId: 'golden-match-v2_3',
      player: {
        ovrScoreFloat: 71.25,
        matchCount: 7,
        lastMatchAt: null,
        avgPace: null,
        avgTechnique: null,
        avgPassing: null,
        avgDefending: null,
        avgPhysicality: null,
        avgEffort: null,
      },
      matchRatings: [
        rating(7, 8, 6, 7, 6, 9),
        rating(6, 7, 7, 8, 7, 8),
        rating(8, 8, 7, 7, 8, 9),
      ],
      goalCount: 2,
      assistCount: 1,
      isMvp: true,
      groupTier: 'semiPro',
      distinctRatersCount: 3,
      diversityTarget: 8,
      myTeamAvgOvr: 68,
      oppTeamAvgOvr: 74,
      matchOutcome: 'win',
    })

    expect(normalize(result)).toEqual({
      newOvr: 73.031001715036,
      breakdown: {
        matchId: 'golden-match-v2_3',
        rawAttributes: {
          pace: 7,
          technique: 7.666666666667,
          passing: 6.666666666667,
          defending: 7.333333333333,
          physicality: 7,
          effort: 8.666666666667,
        },
        goalCount: 2,
        assistCount: 1,
        raterCount: 3,
        ratingStdDev: 0.23921166824,
        attributeScoreRaw: 7.516666666667,
        matchImpactRaw: 79.875,
        matchImpactBase: 79.875,
        mvpBonus: 1.5,
        goalContribution: 1.6,
        myTeamAvgOvr: 68,
        oppTeamAvgOvr: 74,
        expectedWin: 0.414501321328,
        actual: 1,
        outcomeAdjustment: 1.170997357344,
        matchImpact: 84.145997357344,
        groupTier: 'semiPro',
        alpha: {
          matchCountBefore: 7,
          distinctRatersBefore: 3,
          diversityTarget: 8,
          baseAlpha: 0.178,
          diversityGuard: 0.03125,
          adjustedBaseAlpha: 0.20925,
          raterCount: 3,
          ratingStdDev: 0.23921166824,
          countFactor: 0.6,
          rawAgreementFactor: 1,
          agreementFactor: 1,
          evidenceQuality: 0.6,
          tierMultiplier: 1.1,
          finalAlphaBeforeClamp: 0.138105,
          finalAlphaAfterClamp: 0.138105,
        },
        oldOvr: 71.25,
        newOvrBeforeClamp: 73.031001715036,
        newOvr: 73.031001715036,
        displayedOldOvr: 71,
        displayedNewOvr: 73,
        rawDelta: 1.781001715036,
        displayedDelta: 2,
      },
    })
  })

  it('freezes the current initial seed output', () => {
    const seed = buildSeedContext({
      playerId: 'golden-player',
      groupId: 'golden-group',
      organizerRating: 80,
      organizerUserId: 'organizer',
      peerRatings: [
        { raterUserId: 'peer-1', rating: 70 },
        { raterUserId: 'peer-2', rating: 75 },
        { raterUserId: 'peer-3', rating: 68 },
        { raterUserId: 'peer-4', rating: 72 },
      ],
      groupMedianUnlockedOvr: null,
    })

    expect(normalize(seed)).toEqual({
      priorOvr: 65,
      observedWeight: 6,
      priorWeight: 0,
      totalWeight: 6,
      rawWeightedMean: 74.166666666667,
      seededOvr: 74.166666666667,
      seedStatus: 'CONFIDENT',
      seedRatingStdDev: 0.419523539268,
      countFactor: 1,
      agreementFactor: 1,
      seedConfidence: 1,
    })
  })
})

