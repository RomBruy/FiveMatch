import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── hoisted mocks — defined before any module is imported ────────────────────
const mocks = vi.hoisted(() => {
  const mockReturning = vi.fn()
  const mockUpdateWhere = vi.fn(() => ({ returning: mockReturning }))
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }))
  const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }))

  const mockSelectWhere = vi.fn()
  const mockSelectInnerJoin2 = vi.fn(() => ({ where: mockSelectWhere }))
  const mockSelectInnerJoin1 = vi.fn(() => ({ innerJoin: mockSelectInnerJoin2 }))
  const mockSelectFrom = vi.fn(() => ({ innerJoin: mockSelectInnerJoin1 }))

  // Second db.select() chain: group median (no innerJoins — direct .where())
  const mockGroupMedianWhere = vi.fn().mockResolvedValue([])
  const mockGroupMedianFrom = vi.fn(() => ({ where: mockGroupMedianWhere }))

  const mockSelect = vi.fn()

  const mockNotifSend = vi.fn()

  const mockSeedingComputeInitialSeed = vi.fn().mockResolvedValue({
    seededOvr: 70,
    seedStatus: 'PROVISIONAL',
  })

  return {
    mockReturning,
    mockUpdateWhere,
    mockUpdateSet,
    mockUpdate,
    mockSelectWhere,
    mockSelectInnerJoin2,
    mockSelectInnerJoin1,
    mockSelectFrom,
    mockGroupMedianWhere,
    mockGroupMedianFrom,
    mockSelect,
    mockNotifSend,
    mockSeedingComputeInitialSeed,
  }
})

vi.mock('../../../db', () => ({
  db: {
    select: mocks.mockSelect,
    update: mocks.mockUpdate,
  },
}))

vi.mock('../../../services/notifications/notification.service', () => ({
  notificationService: { send: mocks.mockNotifSend },
}))

vi.mock('../seeding.service', () => ({
  seedingService: { computeInitialSeed: mocks.mockSeedingComputeInitialSeed },
}))

import { ovrService } from '../ovr.service'
import type { OvrSignal } from '../ovr-signal'
import { MVP_BONUS, ALPHA_BASE, DIVERSITY_SPRING } from '@fivematch/types/algorithm-constants'

const makeSignal = (value: number, weight: number): OvrSignal => ({
  type: 'match',
  playerId: 'player-1',
  groupId: 'group-1',
  value,
  weight,
  computedAt: new Date(),
})

// Default outcome/diversity params for applyEmaWithBreakdown — balanced teams, draw, full diversity
const DEFAULT_OUTCOME = {
  distinctRatersCount: 8,    // at or beyond DIVERSITY_TARGET_CAP → diversityGuard = 0
  diversityTarget: 8,
  myTeamAvgOvr: 65,
  oppTeamAvgOvr: 65,
  matchOutcome: 'draw' as const,
}

describe('ovrService.computeOvr', () => {
  it('all attributes = 5.0 → result = 5.0 (weights sum to 1)', () => {
    const result = ovrService.computeOvr({
      pace: 5.0, technique: 5.0, passing: 5.0,
      defending: 5.0, physicality: 5.0, effort: 5.0,
    })
    expect(result).toBeCloseTo(5.0, 10)
  })

  it('higher attributes produce higher OVR (monotonicity)', () => {
    const low = ovrService.computeOvr({ pace: 3, technique: 3, passing: 3, defending: 3, physicality: 3, effort: 3 })
    const high = ovrService.computeOvr({ pace: 8, technique: 8, passing: 8, defending: 8, physicality: 8, effort: 8 })
    expect(high).toBeGreaterThan(low)
  })
})

describe('ovrService.applyEma', () => {
  it('regression baseline at distinctRatersCount=15 matches calibration formula', () => {
    // alpha = clamp(max(0.10, 0.22 - 15×0.006) × 1.0, 0.10, 0.30) = clamp(0.13, …) = 0.13
    // new_ovr = (1-0.13)×70 + 0.13×50 = 60.9 + 6.5 = 67.4
    const result = ovrService.applyEma(70, 50, 15)
    expect(result).toBeCloseTo(67.4, 5)
  })

  it('result is clamped to minimum 40', () => {
    // currentOvr=41, matchImpact=0, distinctRatersCount=0 → alpha=0.22 → 0.78*41 = 31.98 → clamped to 40
    const result = ovrService.applyEma(41, 0, 0)
    expect(result).toBeGreaterThanOrEqual(40)
    expect(result).toBe(40)
  })

  it('result is clamped to maximum 99', () => {
    const result = ovrService.applyEma(99, 200, 0)
    expect(result).toBeLessThanOrEqual(99)
    expect(result).toBe(99)
  })

  it('a very low impact still clamps at 40 minimum', () => {
    const result = ovrService.applyEma(40, 0, 0)
    expect(result).toBe(40)
  })
})

describe('ovrService.getCardState', () => {
  it('returns not_started when hasInitialRating is false', () => {
    expect(ovrService.getCardState(0, false)).toBe('not_started')
    expect(ovrService.getCardState(5, false)).toBe('not_started')
  })

  it('returns in_progress_1 when hasInitialRating=true and matchCount=0', () => {
    expect(ovrService.getCardState(0, true)).toBe('in_progress_1')
  })

  it('returns in_progress_2 when matchCount=1', () => {
    expect(ovrService.getCardState(1, true)).toBe('in_progress_2')
  })

  it('returns in_progress_3 when matchCount=2', () => {
    expect(ovrService.getCardState(2, true)).toBe('in_progress_3')
  })

  it('returns in_progress_3 when matchCount=3', () => {
    expect(ovrService.getCardState(3, true)).toBe('in_progress_3')
  })

  it('returns unlocked when matchCount=4', () => {
    expect(ovrService.getCardState(4, true)).toBe('unlocked')
  })

  it('returns unlocked when matchCount > 4', () => {
    expect(ovrService.getCardState(10, true)).toBe('unlocked')
  })
})

describe('ovrService.applySignals', () => {
  it('zero-weight guard: returns currentOvr unchanged without calling applyEma', () => {
    const result = ovrService.applySignals(70, [makeSignal(99, 0)], 10)
    expect(result).toBe(70)
  })

  it('zero-weight guard: empty signals also returns currentOvr unchanged', () => {
    const result = ovrService.applySignals(70, [], 10)
    expect(result).toBe(70)
  })

  it('with a real signal: result differs from currentOvr and is clamped', () => {
    const result = ovrService.applySignals(70, [makeSignal(80, 1)], 10)
    expect(result).not.toBe(70)
    expect(result).toBeGreaterThanOrEqual(40)
    expect(result).toBeLessThanOrEqual(99)
  })

  it('with a real signal: OVR moves in the direction of the signal value', () => {
    const higherImpact = ovrService.applySignals(70, [makeSignal(80, 1)], 10)
    const lowerImpact = ovrService.applySignals(70, [makeSignal(60, 1)], 10)
    expect(higherImpact).toBeGreaterThan(lowerImpact)
  })
})

describe('ovrService.getOvrForDisplay', () => {
  it('returns null when matchCount < 4', () => {
    expect(ovrService.getOvrForDisplay(75, 0)).toBeNull()
    expect(ovrService.getOvrForDisplay(75, 1)).toBeNull()
    expect(ovrService.getOvrForDisplay(75, 2)).toBeNull()
    expect(ovrService.getOvrForDisplay(75, 3)).toBeNull()
  })

  it('rounds float to integer when matchCount >= 4', () => {
    expect(ovrService.getOvrForDisplay(75, 4)).toBe(75)
    expect(ovrService.getOvrForDisplay(82, 10)).toBe(82)
    expect(ovrService.getOvrForDisplay(72.847, 4)).toBe(73)
    expect(ovrService.getOvrForDisplay(72.4, 4)).toBe(72)
  })

  it('returns null when ovrScoreFloat is null and matchCount >= 4', () => {
    expect(ovrService.getOvrForDisplay(null, 4)).toBeNull()
  })
})

describe('ovrService.computeTrend', () => {
  it('returns Stable when previousOvrFloat is null', () => {
    expect(ovrService.computeTrend(null, 72.5)).toBe('Stable')
  })

  it('returns Stable when delta < 0.15', () => {
    expect(ovrService.computeTrend(72.0, 72.1)).toBe('Stable')
  })

  it('returns Trending up when delta >= 0.15', () => {
    expect(ovrService.computeTrend(72.0, 72.2)).toBe('Trending up')
  })

  it('returns Trending down when negative delta >= 0.15', () => {
    expect(ovrService.computeTrend(72.2, 72.0)).toBe('Trending down')
  })
})

describe('ovrService.evaluatePlayerTier', () => {
  it('returns rookie for OVR below joueur threshold (< 55)', () => {
    expect(ovrService.evaluatePlayerTier(40)).toBe('rookie')
    expect(ovrService.evaluatePlayerTier(54)).toBe('rookie')
  })

  it('returns joueur for OVR in [55, 67]', () => {
    expect(ovrService.evaluatePlayerTier(55)).toBe('joueur')
    expect(ovrService.evaluatePlayerTier(67)).toBe('joueur')
  })

  it('returns performeur for OVR in [68, 78]', () => {
    expect(ovrService.evaluatePlayerTier(68)).toBe('performeur')
    expect(ovrService.evaluatePlayerTier(78)).toBe('performeur')
  })

  it('returns crack for OVR >= 79', () => {
    expect(ovrService.evaluatePlayerTier(79)).toBe('crack')
    expect(ovrService.evaluatePlayerTier(99)).toBe('crack')
  })
})

const makeRater = (v: number) => ({ pace: v, technique: v, passing: v, defending: v, physicality: v, effort: v })

const makePlayer = (ovrScoreFloat: number, matchCount = 0) => ({
  ovrScoreFloat,
  matchCount,
  lastMatchAt: null as Date | null,
  avgPace: null as string | null, avgTechnique: null as string | null, avgPassing: null as string | null,
  avgDefending: null as string | null, avgPhysicality: null as string | null, avgEffort: null as string | null,
})

describe('ovrService.applyEmaWithBreakdown', () => {
  it('full breakdown: known inputs produce exact values for every field', () => {
    // player.ovrScoreFloat=60, matchCount=0, distinctRatersCount=8 (=target, guard=0), 3 raters all attrs=8
    // no goals/assists, balanced teams (draw), club tier
    //
    // Step 3: attributeScoreRaw = 8.0 (all attrs 8, weights sum to 1)
    // Step 4: calibrate(8.0) — between anchors {7,76} and {9,91}
    //         t = (8-7)/(9-7) = 0.5 → 76 + 0.5×15 = 83.5
    //         matchImpactBase = 83.5
    // Step 5: mvpBonus=0, goalContribution=0
    //         expectedWin = 1/(1+10^0) = 0.5, actual=0.5, outcomeAdj = 2×0 = 0
    //         matchImpact = 83.5
    // Step 7: matchCount=0 → baseAlpha = max(0.10, 0.22-0×0.006) = 0.22
    //         distinct=8, target=8 → diversityRatio=1 → diversityGuard = 0.05×max(0,0) = 0
    //         adjustedBaseAlpha = min(0.30, 0.22+0) = 0.22
    //         raterCount=3, perRaterScores all 8.0, stdDev=0 → rawAgreement=1.00
    //         countFactor = min(1, 3/5) = 0.6
    //         agreementFactor = 1 - 0.6×(1-1.00) = 1.0
    //         evidenceQuality = 0.6×1.0 = 0.6
    //         tierMultiplier (club) = 1.0
    //         finalAlphaBeforeClamp = 0.22×0.6×1.0 = 0.132
    //         finalAlphaAfterClamp = clamp(0.132, 0.10, 0.30) = 0.132
    // Step 8: newOvr = 60 + 0.132×(83.5-60) = 60 + 0.132×23.5 = 60 + 3.102 = 63.102
    const { newOvr, breakdown } = ovrService.applyEmaWithBreakdown({
      matchId: 'match-test-1',
      player: makePlayer(60, 0),
      matchRatings: [makeRater(8), makeRater(8), makeRater(8)],
      goalCount: 0, assistCount: 0,
      isMvp: false,
      groupTier: 'club',
      ...DEFAULT_OUTCOME,
    })

    expect(breakdown.rawAttributes.pace).toBe(8)
    expect(breakdown.raterCount).toBe(3)
    expect(breakdown.ratingStdDev).toBeCloseTo(0, 10)
    expect(breakdown.attributeScoreRaw).toBeCloseTo(8.0, 10)

    // Step 4
    expect(breakdown.matchImpactRaw).toBeCloseTo(83.5, 5)
    expect(breakdown.matchImpactBase).toBeCloseTo(83.5, 5)

    // Step 5 — no goals, no MVP, balanced draw
    expect(breakdown.mvpBonus).toBe(0)
    expect(breakdown.goalContribution).toBe(0)
    expect(breakdown.expectedWin).toBeCloseTo(0.5, 5)
    expect(breakdown.actual).toBe(0.5)
    expect(breakdown.outcomeAdjustment).toBeCloseTo(0, 10)
    expect(breakdown.matchImpact).toBeCloseTo(83.5, 5)

    // Step 7 — split alpha, no diversity guard (at full diversity)
    expect(breakdown.alpha.matchCountBefore).toBe(0)
    expect(breakdown.alpha.distinctRatersBefore).toBe(8)
    expect(breakdown.alpha.diversityTarget).toBe(8)
    expect(breakdown.alpha.baseAlpha).toBeCloseTo(0.22, 10)
    expect(breakdown.alpha.diversityGuard).toBeCloseTo(0, 10)
    expect(breakdown.alpha.adjustedBaseAlpha).toBeCloseTo(0.22, 10)
    expect(breakdown.alpha.countFactor).toBeCloseTo(0.6, 10)
    expect(breakdown.alpha.rawAgreementFactor).toBeCloseTo(1.0, 10)
    expect(breakdown.alpha.agreementFactor).toBeCloseTo(1.0, 10)
    expect(breakdown.alpha.evidenceQuality).toBeCloseTo(0.6, 10)
    expect(breakdown.alpha.tierMultiplier).toBe(1.0)
    expect(breakdown.alpha.finalAlphaBeforeClamp).toBeCloseTo(0.132, 10)
    expect(breakdown.alpha.finalAlphaAfterClamp).toBeCloseTo(0.132, 10)

    // Step 8
    expect(breakdown.oldOvr).toBe(60)
    expect(breakdown.newOvrBeforeClamp).toBeCloseTo(63.102, 5)
    expect(breakdown.newOvr).toBeCloseTo(63.102, 5)
    expect(newOvr).toBeCloseTo(63.102, 5)
    expect(breakdown.displayedOldOvr).toBe(60)
    expect(breakdown.displayedNewOvr).toBe(63)
    expect(breakdown.rawDelta).toBeCloseTo(3.102, 5)
    expect(breakdown.displayedDelta).toBe(3)
    expect(breakdown.matchId).toBe('match-test-1')
  })

  it('raterCount < 2 → finalAlphaAfterClamp = 0 and newOvr = oldOvr', () => {
    const { newOvr, breakdown } = ovrService.applyEmaWithBreakdown({
      matchId: 'match-test-2',
      player: makePlayer(65, 5),
      matchRatings: [makeRater(8)],
      goalCount: 0, assistCount: 0,
      isMvp: false,
      groupTier: 'club',
      ...DEFAULT_OUTCOME,
    })

    expect(breakdown.alpha.finalAlphaAfterClamp).toBe(0)
    expect(breakdown.newOvrBeforeClamp).toBe(65)
    expect(newOvr).toBe(65)
    expect(breakdown.rawDelta).toBe(0)
    expect(breakdown.displayedDelta).toBe(0)
    expect(breakdown.raterCount).toBe(1)
  })

  it('displayedDelta = 0 when raw sub-integer OVR move rounds away', () => {
    // 3 raters all attrs=6, no goals, balanced draw, matchCount=30 → baseAlpha=ALPHA_FLOOR=0.10
    // calibrate(6): between {5,63} and {7,76}, t=0.5 → 63 + 0.5×13 = 69.5
    // matchImpact = 69.5 (no MVP/goals/outcome adj on balanced draw)
    // alpha = clamp(max(0.10, 0.22-30×0.006)×evidenceQuality×1.0, …)
    //       = clamp(max(0.10, 0.04) × 0.6 × 1.0, …) = clamp(0.10 × 0.6, 0.10, …) = 0.10
    // newOvr = 70 + 0.10×(69.5-70) = 70 - 0.05 = 69.95 → displayed 70; delta = 0
    const { newOvr, breakdown } = ovrService.applyEmaWithBreakdown({
      matchId: 'match-test-3',
      player: makePlayer(70, 30),
      matchRatings: [makeRater(6), makeRater(6), makeRater(6)],
      goalCount: 0, assistCount: 0,
      isMvp: false,
      groupTier: 'club',
      distinctRatersCount: 30,
      diversityTarget: 8,
      myTeamAvgOvr: 65,
      oppTeamAvgOvr: 65,
      matchOutcome: 'draw',
    })

    expect(newOvr).toBeLessThan(70)
    expect(breakdown.rawDelta).toBeLessThan(0)
    expect(breakdown.displayedDelta).toBe(0)
    expect(breakdown.displayedOldOvr).toBe(70)
    expect(breakdown.displayedNewOvr).toBe(70)
    expect(breakdown.displayedDelta).toBe(breakdown.displayedNewOvr - breakdown.displayedOldOvr)
  })
})

describe('applyEmaWithBreakdown — MVP additive bonus (fix #2)', () => {
  const twoRaterRatings = [makeRater(5), makeRater(5)]

  // calibrate(5): between {5,63} and {7,76} → t=0 → 63.0
  // With balanced draw, no goals: matchImpact = 63.0 + mvpBonus + 0 + 0

  it('MVP bonus: matchImpact = matchImpactBase + MVP_BONUS', () => {
    const result = ovrService.applyEmaWithBreakdown({
      matchId: 'test-mvp-1',
      player: makePlayer(70, 10),
      matchRatings: twoRaterRatings,
      goalCount: 0, assistCount: 0,
      isMvp: true,
      groupTier: 'amateur',
      ...DEFAULT_OUTCOME,
    })
    const { matchImpactBase, mvpBonus, matchImpact } = result.breakdown
    expect(mvpBonus).toBe(MVP_BONUS)
    expect(matchImpact).toBeCloseTo(matchImpactBase + MVP_BONUS, 5)
  })

  it('non-MVP: mvpBonus = 0, matchImpact = matchImpactBase (balanced draw)', () => {
    const result = ovrService.applyEmaWithBreakdown({
      matchId: 'test-mvp-2',
      player: makePlayer(70, 10),
      matchRatings: twoRaterRatings,
      goalCount: 0, assistCount: 0,
      isMvp: false,
      groupTier: 'amateur',
      ...DEFAULT_OUTCOME,
    })
    expect(result.breakdown.mvpBonus).toBe(0)
    expect(result.breakdown.matchImpact).toBeCloseTo(result.breakdown.matchImpactBase, 5)
  })

  it('MVP bonus is always additive — never penalises high performers (fix #2)', () => {
    // Player performing above 80 (all 10s → calibrate(10) = 99)
    // Old v1 blend would have dragged them DOWN toward 80; v2 bonus adds +1.5
    const withMvp = ovrService.applyEmaWithBreakdown({
      matchId: 'test-mvp-elite-mvp',
      player: makePlayer(90, 10),
      matchRatings: [makeRater(10), makeRater(10)],
      goalCount: 0, assistCount: 0, isMvp: true,
      groupTier: 'club', ...DEFAULT_OUTCOME,
    })
    const withoutMvp = ovrService.applyEmaWithBreakdown({
      matchId: 'test-mvp-elite-no-mvp',
      player: makePlayer(90, 10),
      matchRatings: [makeRater(10), makeRater(10)],
      goalCount: 0, assistCount: 0, isMvp: false,
      groupTier: 'club', ...DEFAULT_OUTCOME,
    })
    expect(withMvp.newOvr).toBeGreaterThanOrEqual(withoutMvp.newOvr)
  })

  it('MVP_BONUS constant has correct value', () => {
    expect(MVP_BONUS).toBe(1.5)
  })
})

describe('applyEmaWithBreakdown — goal/assist contributions (Step 5)', () => {
  const twoRaterRatings = [makeRater(6), makeRater(6)]

  it('single goal adds GOAL_PT to matchImpact', () => {
    const noGoal = ovrService.applyEmaWithBreakdown({
      matchId: 'g-0', player: makePlayer(70, 5),
      matchRatings: twoRaterRatings, goalCount: 0, assistCount: 0,
      isMvp: false, groupTier: 'club', ...DEFAULT_OUTCOME,
    })
    const oneGoal = ovrService.applyEmaWithBreakdown({
      matchId: 'g-1', player: makePlayer(70, 5),
      matchRatings: twoRaterRatings, goalCount: 1, assistCount: 0,
      isMvp: false, groupTier: 'club', ...DEFAULT_OUTCOME,
    })
    expect(oneGoal.breakdown.goalContribution).toBeCloseTo(0.6, 10)
    expect(oneGoal.breakdown.matchImpact).toBeCloseTo(noGoal.breakdown.matchImpact + 0.6, 5)
  })

  it('goal cap: 4 goals produce same contribution as OBJECTIVE_GOAL_CAP (2.0)', () => {
    const fourGoals = ovrService.applyEmaWithBreakdown({
      matchId: 'g-cap', player: makePlayer(70, 5),
      matchRatings: twoRaterRatings, goalCount: 4, assistCount: 0,
      isMvp: false, groupTier: 'club', ...DEFAULT_OUTCOME,
    })
    // 4×0.6 = 2.4 → capped at 2.0
    expect(fourGoals.breakdown.goalContribution).toBeCloseTo(2.0, 10)
  })

  it('assist adds ASSIST_PT to goalContribution', () => {
    const noContrib = ovrService.applyEmaWithBreakdown({
      matchId: 'a-0', player: makePlayer(70, 5),
      matchRatings: twoRaterRatings, goalCount: 0, assistCount: 0,
      isMvp: false, groupTier: 'club', ...DEFAULT_OUTCOME,
    })
    const oneAssist = ovrService.applyEmaWithBreakdown({
      matchId: 'a-1', player: makePlayer(70, 5),
      matchRatings: twoRaterRatings, goalCount: 0, assistCount: 1,
      isMvp: false, groupTier: 'club', ...DEFAULT_OUTCOME,
    })
    expect(oneAssist.breakdown.goalContribution).toBeCloseTo(0.4, 10)
    expect(oneAssist.breakdown.matchImpact).toBeCloseTo(noContrib.breakdown.matchImpact + 0.4, 5)
  })
})

describe('applyEmaWithBreakdown — match outcome adjustment (Step 5)', () => {
  const twoRaterRatings = [makeRater(5), makeRater(5)]
  const basePlayer = makePlayer(65, 10)

  it('win against equal team produces near-zero outcome adjustment', () => {
    // expectedWin = 0.5, actual = 1.0 → adjustment = 2×0.5 = +1.0
    const result = ovrService.applyEmaWithBreakdown({
      matchId: 'oc-equal-win', player: basePlayer,
      matchRatings: twoRaterRatings, goalCount: 0, assistCount: 0,
      isMvp: false, groupTier: 'club',
      distinctRatersCount: 10, diversityTarget: 8, myTeamAvgOvr: 65, oppTeamAvgOvr: 65,
      matchOutcome: 'win',
    })
    expect(result.breakdown.expectedWin).toBeCloseTo(0.5, 5)
    expect(result.breakdown.actual).toBe(1.0)
    expect(result.breakdown.outcomeAdjustment).toBeCloseTo(1.0, 5)
  })

  it('losing to a stronger team produces small negative adjustment', () => {
    // myTeamAvg=60, oppTeamAvg=80 → expectedWin = 1/(1+10^(20/40)) = 1/(1+10^0.5) ≈ 0.240
    // actual=0.0 → adjustment = 2×(0 - 0.240) = -0.480
    const result = ovrService.applyEmaWithBreakdown({
      matchId: 'oc-underdog-loss', player: basePlayer,
      matchRatings: twoRaterRatings, goalCount: 0, assistCount: 0,
      isMvp: false, groupTier: 'club',
      distinctRatersCount: 10, diversityTarget: 8, myTeamAvgOvr: 60, oppTeamAvgOvr: 80,
      matchOutcome: 'loss',
    })
    const expectedWin = 1 / (1 + Math.pow(10, -(60 - 80) / 40))
    expect(result.breakdown.expectedWin).toBeCloseTo(expectedWin, 5)
    expect(result.breakdown.outcomeAdjustment).toBeCloseTo(2 * (0 - expectedWin), 5)
    // Losing as underdog is a small negative — should be less severe than losing as favourite
    expect(result.breakdown.outcomeAdjustment).toBeGreaterThan(-1)
  })

  it('losing to a weaker team gives maximum negative adjustment', () => {
    // myTeamAvg=80, oppTeamAvg=60 → expectedWin ≈ 0.760
    // actual=0.0 → adjustment = 2×(0 - 0.760) ≈ -1.52
    const result = ovrService.applyEmaWithBreakdown({
      matchId: 'oc-favourite-loss', player: basePlayer,
      matchRatings: twoRaterRatings, goalCount: 0, assistCount: 0,
      isMvp: false, groupTier: 'club',
      distinctRatersCount: 10, diversityTarget: 8, myTeamAvgOvr: 80, oppTeamAvgOvr: 60,
      matchOutcome: 'loss',
    })
    expect(result.breakdown.outcomeAdjustment).toBeLessThan(-1)
  })

  it('draw against equal teams → outcome adjustment = 0', () => {
    const result = ovrService.applyEmaWithBreakdown({
      matchId: 'oc-equal-draw', player: basePlayer,
      matchRatings: twoRaterRatings, goalCount: 0, assistCount: 0,
      isMvp: false, groupTier: 'club',
      distinctRatersCount: 10, diversityTarget: 8, myTeamAvgOvr: 65, oppTeamAvgOvr: 65,
      matchOutcome: 'draw',
    })
    expect(result.breakdown.outcomeAdjustment).toBeCloseTo(0, 10)
  })
})

describe('applyEmaWithBreakdown — signal clamp before EMA', () => {
  const baseParams = {
    matchId: 'test-match-1',
    player: makePlayer(70, 10),
    matchRatings: [makeRater(3), makeRater(3)],
    goalCount: 0, assistCount: 0, isMvp: false, groupTier: 'amateur' as const,
    ...DEFAULT_OUTCOME,
  }

  it('matchImpactBase is always >= 40 (OVR_CLAMP_MIN)', () => {
    const result = ovrService.applyEmaWithBreakdown(baseParams)
    expect(result.breakdown.matchImpactBase).toBeGreaterThanOrEqual(40)
    expect(result.breakdown.matchImpactBase).toBeLessThanOrEqual(99)
  })

  it('matchImpactRaw is preserved in breakdown even when clamped', () => {
    const result = ovrService.applyEmaWithBreakdown(baseParams)
    expect(result.breakdown).toHaveProperty('matchImpactRaw')
    expect(result.breakdown).toHaveProperty('matchImpactBase')
  })

  it('EMA receives clamped signal (newOvr always in [40, 99])', () => {
    const result = ovrService.applyEmaWithBreakdown(baseParams)
    expect(result.newOvr).toBeGreaterThanOrEqual(40)
    expect(result.newOvr).toBeLessThanOrEqual(99)
  })
})

describe('applyEmaWithBreakdown — alpha split roles (fix #5)', () => {
  const ratings2 = [makeRater(7), makeRater(7)]

  it('more matchCount → lower baseAlpha (OVR settles over time)', () => {
    // matchCount drives baseAlpha decay; distinctRatersCount has no effect on baseAlpha
    const fresh = ovrService.applyEmaWithBreakdown({
      matchId: 'div-fresh', player: makePlayer(70, 0),
      matchRatings: ratings2, goalCount: 0, assistCount: 0,
      isMvp: false, groupTier: 'club',
      distinctRatersCount: 8, diversityTarget: 8, myTeamAvgOvr: 65, oppTeamAvgOvr: 65, matchOutcome: 'draw',
    })
    const veteran = ovrService.applyEmaWithBreakdown({
      matchId: 'div-veteran', player: makePlayer(70, 20),
      matchRatings: ratings2, goalCount: 0, assistCount: 0,
      isMvp: false, groupTier: 'club',
      distinctRatersCount: 8, diversityTarget: 8, myTeamAvgOvr: 65, oppTeamAvgOvr: 65, matchOutcome: 'draw',
    })
    // matchCount=0 → baseAlpha=0.22; matchCount=20 → baseAlpha=max(0.10, 0.22-0.12)=0.10
    expect(veteran.breakdown.alpha.baseAlpha).toBeLessThan(fresh.breakdown.alpha.baseAlpha)
    expect(fresh.breakdown.alpha.matchCountBefore).toBe(0)
    expect(veteran.breakdown.alpha.matchCountBefore).toBe(20)
  })

  it('fewer distinct raters → higher diversityGuard (evidence breadth bonus)', () => {
    // distinctRatersCount drives diversityGuard, not baseAlpha
    const narrow = ovrService.applyEmaWithBreakdown({
      matchId: 'div-narrow', player: makePlayer(70, 5),
      matchRatings: ratings2, goalCount: 0, assistCount: 0,
      isMvp: false, groupTier: 'club',
      distinctRatersCount: 0, diversityTarget: 8, myTeamAvgOvr: 65, oppTeamAvgOvr: 65, matchOutcome: 'draw',
    })
    const wide = ovrService.applyEmaWithBreakdown({
      matchId: 'div-wide', player: makePlayer(70, 5),
      matchRatings: ratings2, goalCount: 0, assistCount: 0,
      isMvp: false, groupTier: 'club',
      distinctRatersCount: 8, diversityTarget: 8, myTeamAvgOvr: 65, oppTeamAvgOvr: 65, matchOutcome: 'draw',
    })
    // narrow: diversityGuard = 0.05 × (1 - 0/8) = 0.05
    // wide: diversityGuard = 0.05 × (1 - 1) = 0
    expect(narrow.breakdown.alpha.diversityGuard).toBeCloseTo(DIVERSITY_SPRING, 10)
    expect(wide.breakdown.alpha.diversityGuard).toBeCloseTo(0, 10)
    expect(narrow.breakdown.alpha.adjustedBaseAlpha).toBeGreaterThan(wide.breakdown.alpha.adjustedBaseAlpha)
    // baseAlpha is the SAME for both (same matchCount=5)
    expect(narrow.breakdown.alpha.baseAlpha).toBeCloseTo(wide.breakdown.alpha.baseAlpha, 10)
  })

  it('elite tier raises alpha (same matchCount), but still <= ALPHA_CEIL', () => {
    const club = ovrService.applyEmaWithBreakdown({
      matchId: 'tier-club', player: makePlayer(70, 5),
      matchRatings: ratings2, goalCount: 0, assistCount: 0,
      isMvp: false, groupTier: 'club',
      distinctRatersCount: 0, diversityTarget: 8, myTeamAvgOvr: 65, oppTeamAvgOvr: 65, matchOutcome: 'draw',
    })
    const elite = ovrService.applyEmaWithBreakdown({
      matchId: 'tier-elite', player: makePlayer(70, 5),
      matchRatings: ratings2, goalCount: 0, assistCount: 0,
      isMvp: false, groupTier: 'elite',
      distinctRatersCount: 0, diversityTarget: 8, myTeamAvgOvr: 65, oppTeamAvgOvr: 65, matchOutcome: 'draw',
    })
    expect(elite.breakdown.alpha.finalAlphaAfterClamp)
      .toBeGreaterThan(club.breakdown.alpha.finalAlphaAfterClamp)
    expect(elite.breakdown.alpha.finalAlphaAfterClamp).toBeLessThanOrEqual(0.30)
  })

  it('baseAlpha never exceeds ALPHA_BASE regardless of match count', () => {
    const result = ovrService.applyEmaWithBreakdown({
      matchId: 'alpha-base', player: makePlayer(70, 0),
      matchRatings: ratings2, goalCount: 0, assistCount: 0,
      isMvp: false, groupTier: 'club',
      distinctRatersCount: 0, diversityTarget: 8, myTeamAvgOvr: 65, oppTeamAvgOvr: 65, matchOutcome: 'draw',
    })
    expect(result.breakdown.alpha.baseAlpha).toBeLessThanOrEqual(ALPHA_BASE)
  })
})

describe('ovrService.computeAttributeAverages', () => {
  const GROUP_ID = 'group-uuid-1'
  const RATED_PLAYER_ID = 'player-uuid-rated'
  const RATED_USER_ID = 'user-uuid-rated'

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mockSelect
      .mockReturnValueOnce({ from: mocks.mockSelectFrom })
      .mockReturnValue({ from: mocks.mockGroupMedianFrom })
    mocks.mockSelectFrom.mockReturnValue({ innerJoin: mocks.mockSelectInnerJoin1 })
    mocks.mockSelectInnerJoin1.mockReturnValue({ innerJoin: mocks.mockSelectInnerJoin2 })
    mocks.mockSelectInnerJoin2.mockReturnValue({ where: mocks.mockSelectWhere })
    mocks.mockGroupMedianFrom.mockReturnValue({ where: mocks.mockGroupMedianWhere })
    mocks.mockGroupMedianWhere.mockResolvedValue([])
    mocks.mockUpdate.mockReturnValue({ set: mocks.mockUpdateSet })
    mocks.mockUpdateSet.mockReturnValue({ where: mocks.mockUpdateWhere })
    mocks.mockUpdateWhere.mockReturnValue({ returning: mocks.mockReturning })
    mocks.mockReturning.mockResolvedValue([{ userId: RATED_USER_ID }])
    mocks.mockSeedingComputeInitialSeed.mockResolvedValue({ seededOvr: 70, seedStatus: 'PROVISIONAL' })
  })

  it('applies 2× organizer weight: 1 organizer + 1 member, verifies weighted average per attribute', async () => {
    const fakeRatings = [
      { pace: 8, technique: 6, passing: 7, defending: 5, physicality: 9, effort: 8, raterRole: 'organizer', raterUserId: 'user-org-1' },
      { pace: 4, technique: 6, passing: 5, defending: 7, physicality: 3, effort: 6, raterRole: 'member', raterUserId: 'user-member-1' },
    ]
    mocks.mockSelectWhere.mockResolvedValue(fakeRatings)

    await ovrService.computeAttributeAverages(GROUP_ID, RATED_PLAYER_ID)

    expect(mocks.mockUpdate).toHaveBeenCalled()
    const setArgs = (mocks.mockUpdateSet.mock.calls as unknown as [Record<string, string>][])[0][0]

    expect(parseFloat(setArgs['avgPace'])).toBeCloseTo(20 / 3, 5)
    expect(parseFloat(setArgs['avgTechnique'])).toBeCloseTo(6.0, 5)
    expect(parseFloat(setArgs['avgPassing'])).toBeCloseTo(19 / 3, 5)
    expect(parseFloat(setArgs['avgDefending'])).toBeCloseTo(17 / 3, 5)
    expect(parseFloat(setArgs['avgPhysicality'])).toBeCloseTo(7.0, 5)
    expect(parseFloat(setArgs['avgEffort'])).toBeCloseTo(22 / 3, 5)
    expect(setArgs['cardState']).toBe('in_progress_1')
  })

  it('organizer-only group: single organizer rater — averages equal their own values', async () => {
    const fakeRatings = [
      { pace: 7, technique: 5, passing: 6, defending: 8, physicality: 6, effort: 9, raterRole: 'organizer', raterUserId: 'user-org-1' },
    ]
    mocks.mockSelectWhere.mockResolvedValue(fakeRatings)

    await ovrService.computeAttributeAverages(GROUP_ID, RATED_PLAYER_ID)

    const setArgs = (mocks.mockUpdateSet.mock.calls as unknown as [Record<string, string>][])[0][0]
    expect(parseFloat(setArgs['avgPace'])).toBeCloseTo(7.0, 5)
    expect(parseFloat(setArgs['avgTechnique'])).toBeCloseTo(5.0, 5)
    expect(parseFloat(setArgs['avgDefending'])).toBeCloseTo(8.0, 5)
    expect(setArgs['cardState']).toBe('in_progress_1')
  })

  it('dispatches CARD_INITIAL_UNLOCKED notification with correct recipientUserId', async () => {
    mocks.mockSelectWhere.mockResolvedValue([
      { pace: 7, technique: 7, passing: 7, defending: 7, physicality: 7, effort: 7, raterRole: 'member', raterUserId: 'user-member-1' },
    ])

    await ovrService.computeAttributeAverages(GROUP_ID, RATED_PLAYER_ID)

    expect(mocks.mockNotifSend).toHaveBeenCalledWith({
      type: 'CARD_INITIAL_UNLOCKED',
      groupId: GROUP_ID,
      ratedPlayerId: RATED_PLAYER_ID,
      recipientUserId: RATED_USER_ID,
    })
  })

  it('does nothing when no ratings found (empty result)', async () => {
    mocks.mockSelectWhere.mockResolvedValue([])

    await ovrService.computeAttributeAverages(GROUP_ID, RATED_PLAYER_ID)

    expect(mocks.mockUpdate).not.toHaveBeenCalled()
    expect(mocks.mockNotifSend).not.toHaveBeenCalled()
  })
})
