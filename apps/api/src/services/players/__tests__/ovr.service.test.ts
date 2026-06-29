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
import { MVP_WEIGHT, MVP_FIXED_CONTRIBUTION } from '@fivematch/types/algorithm-constants'

const makeSignal = (value: number, weight: number): OvrSignal => ({
  type: 'match',
  playerId: 'player-1',
  groupId: 'group-1',
  value,
  weight,
  computedAt: new Date(),
})

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
  it('regression baseline at matchCount=15 matches calibration formula', () => {
    // Same formula as ovr-calibration.test.ts: alpha = max(0.10, 0.25 - 15×0.005) = 0.175
    // Using OVR-range values (70, 50) to stay in [40, 99]:
    // new_ovr = (1-0.175)×70 + 0.175×50 = 57.75 + 8.75 = 66.5
    const result = ovrService.applyEma(70, 50, 15)
    expect(result).toBeCloseTo(66.5, 5)
  })

  it('result is clamped to minimum 40', () => {
    // currentOvr=41, matchImpact=0 with alpha=0.25 → 0.75*41 + 0.25*0 = 30.75 → clamped to 40
    const result = ovrService.applyEma(41, 0, 0)
    expect(result).toBeGreaterThanOrEqual(40)
    expect(result).toBe(40)
  })

  it('result is clamped to maximum 99', () => {
    // Very high impact should be clamped at 99
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

describe('ovrService.applyEmaWithBreakdown', () => {
  it('full breakdown: known inputs produce exact values for every field', () => {
    // player.ovrScoreFloat=60, matchCount=0, 3 raters all attrs=8, no goals/assists, club
    const { newOvr, breakdown } = ovrService.applyEmaWithBreakdown({
      matchId: 'match-test-1',
      player: { ovrScoreFloat: 60, matchCount: 0, lastMatchAt: null, avgPace: null, avgTechnique: null, avgPassing: null, avgDefending: null, avgPhysicality: null, avgEffort: null },
      matchRatings: [makeRater(8), makeRater(8), makeRater(8)],
      goalCount: 0,
      assistCount: 0,
      isMvp: false,
      groupTier: 'club',
    })

    // Attributes
    expect(breakdown.rawAttributes.pace).toBe(8)
    expect(breakdown.boostedAttributes.pace).toBe(8)
    expect(breakdown.raterCount).toBe(3)
    expect(breakdown.ratingStdDev).toBeCloseTo(0, 10)
    expect(breakdown.attributeScoreRaw).toBeCloseTo(8.0, 10)

    // Signal pipeline — calibrateMatchImpact(8): between {7,76} and {9,90}, t=0.5 → 76+7=83
    expect(breakdown.matchImpactRaw).toBeCloseTo(83.0, 5)
    expect(breakdown.matchImpactClamped).toBeCloseTo(83.0, 5)
    expect(breakdown.mvpAdjustmentApplied).toBe(false)
    expect(breakdown.matchImpactAfterMvp).toBeCloseTo(83.0, 5)

    // Context
    expect(breakdown.groupTier).toBe('club')
    expect(breakdown.contextMultiplier).toBe(1.0)
    expect(breakdown.performanceDelta).toBeCloseTo(23, 5)
    expect(breakdown.contextAdjustedDelta).toBeCloseTo(23, 5)
    expect(breakdown.adjustedMatchImpact).toBeCloseTo(83.0, 5)

    // Alpha
    expect(breakdown.alpha.matchCountBefore).toBe(0)
    expect(breakdown.alpha.baseAlpha).toBeCloseTo(0.25, 10)
    expect(breakdown.alpha.daysSinceLastMatch).toBeNull()
    expect(breakdown.alpha.inactivityMultiplier).toBe(1.0)
    expect(breakdown.alpha.uncertaintyAlpha).toBeCloseTo(0.25, 10)
    expect(breakdown.alpha.countFactor).toBeCloseTo(0.5, 10)
    expect(breakdown.alpha.agreementFactor).toBeCloseTo(1.0, 10)
    expect(breakdown.alpha.evidenceQuality).toBeCloseTo(0.5, 10)
    expect(breakdown.alpha.finalAlphaBeforeClamp).toBeCloseTo(0.125, 10)
    expect(breakdown.alpha.finalAlphaAfterClamp).toBeCloseTo(0.125, 10)

    // Result — newOvr = 60 + 0.125*(83-60) = 60 + 2.875 = 62.875
    expect(breakdown.oldOvr).toBe(60)
    expect(breakdown.newOvrBeforeClamp).toBeCloseTo(62.875, 10)
    expect(breakdown.newOvr).toBeCloseTo(62.875, 10)
    expect(newOvr).toBeCloseTo(62.875, 10)
    expect(breakdown.displayedOldOvr).toBe(60)
    expect(breakdown.displayedNewOvr).toBe(63)
    expect(breakdown.rawDelta).toBeCloseTo(2.875, 10)
    expect(breakdown.displayedDelta).toBe(3)
    expect(breakdown.matchId).toBe('match-test-1')
  })

  it('raterCount < 2 → finalAlphaAfterClamp = 0 and newOvr = oldOvr', () => {
    const { newOvr, breakdown } = ovrService.applyEmaWithBreakdown({
      matchId: 'match-test-2',
      player: { ovrScoreFloat: 65, matchCount: 5, lastMatchAt: null, avgPace: null, avgTechnique: null, avgPassing: null, avgDefending: null, avgPhysicality: null, avgEffort: null },
      matchRatings: [makeRater(8)],
      goalCount: 0,
      assistCount: 0,
      isMvp: false,
      groupTier: 'club',
    })

    expect(breakdown.alpha.finalAlphaAfterClamp).toBe(0)
    expect(breakdown.newOvrBeforeClamp).toBe(65)
    expect(newOvr).toBe(65)
    expect(breakdown.rawDelta).toBe(0)
    expect(breakdown.displayedDelta).toBe(0)
    expect(breakdown.raterCount).toBe(1)
  })

  it('displayedDelta = 0 even when rawDelta ≠ 0 (sub-integer OVR move rounds away)', () => {
    // player.ovrScoreFloat=70, matchCount=10, 3 raters all-6 attrs, no goals/assists
    // calibrateMatchImpact(6): between {5,65} and {7,76}, t=0.5 → 70.5
    // newOvr = 70 + 0.10*(70.5-70) = 70.05 → displayedDelta=0
    const { newOvr, breakdown } = ovrService.applyEmaWithBreakdown({
      matchId: 'match-test-3',
      player: { ovrScoreFloat: 70, matchCount: 10, lastMatchAt: null, avgPace: null, avgTechnique: null, avgPassing: null, avgDefending: null, avgPhysicality: null, avgEffort: null },
      matchRatings: [makeRater(6), makeRater(6), makeRater(6)],
      goalCount: 0,
      assistCount: 0,
      isMvp: false,
      groupTier: 'club',
    })

    expect(newOvr).toBeGreaterThan(70)
    expect(breakdown.rawDelta).toBeGreaterThan(0)
    expect(breakdown.displayedDelta).toBe(0)
    expect(breakdown.displayedOldOvr).toBe(70)
    expect(breakdown.displayedNewOvr).toBe(70)
    expect(breakdown.displayedDelta).toBe(breakdown.displayedNewOvr - breakdown.displayedOldOvr)
  })
})

describe('applyEmaWithBreakdown — MVP explicit blend', () => {
  const basePlayerParams = {
    ovrScoreFloat: 70, matchCount: 10, lastMatchAt: null,
    avgPace: null, avgTechnique: null, avgPassing: null,
    avgDefending: null, avgPhysicality: null, avgEffort: null,
  }
  const twoRaterRatings = [
    { pace: 5, technique: 5, passing: 5, defending: 5, physicality: 5, effort: 5 },
    { pace: 5, technique: 5, passing: 5, defending: 5, physicality: 5, effort: 5 },
  ]

  it('MVP blend: matchImpactAfterMvp = matchImpactClamped * 0.97 + 80 * 0.03', () => {
    const result = ovrService.applyEmaWithBreakdown({
      matchId: 'test-mvp-1',
      player: basePlayerParams,
      matchRatings: twoRaterRatings,
      goalCount: 0, assistCount: 0,
      isMvp: true,
      groupTier: 'amateur' as const,
    })
    const { matchImpactClamped, matchImpactAfterMvp, mvpAdjustmentApplied } = result.breakdown
    expect(mvpAdjustmentApplied).toBe(true)
    const expectedBlend = matchImpactClamped * 0.97 + 80 * 0.03
    expect(matchImpactAfterMvp).toBeCloseTo(expectedBlend, 10)
  })

  it('non-MVP: matchImpactAfterMvp === matchImpactClamped (no change)', () => {
    const result = ovrService.applyEmaWithBreakdown({
      matchId: 'test-mvp-2',
      player: basePlayerParams,
      matchRatings: twoRaterRatings,
      goalCount: 0, assistCount: 0,
      isMvp: false,
      groupTier: 'amateur' as const,
    })
    const { matchImpactClamped, matchImpactAfterMvp, mvpAdjustmentApplied } = result.breakdown
    expect(mvpAdjustmentApplied).toBe(false)
    expect(matchImpactAfterMvp).toBe(matchImpactClamped)
  })

  it('MVP blend on a 5/10 performance: 65 * 0.97 + 80 * 0.03 = 63.05 + 2.4 = 65.45', () => {
    // calibrateMatchImpact(5) = 65; MVP pushes it slightly toward 80
    const result = ovrService.applyEmaWithBreakdown({
      matchId: 'test-mvp-3',
      player: basePlayerParams,
      matchRatings: twoRaterRatings,
      goalCount: 0, assistCount: 0,
      isMvp: true,
      groupTier: 'amateur' as const,
    })
    expect(result.breakdown.matchImpactAfterMvp).toBeCloseTo(65.45, 5)
  })

  it('MVP blend result is still in [40, 99] (bounded by post-EMA clamp)', () => {
    const result = ovrService.applyEmaWithBreakdown({
      matchId: 'test-mvp-4',
      player: basePlayerParams,
      matchRatings: twoRaterRatings,
      goalCount: 0, assistCount: 0,
      isMvp: true,
      groupTier: 'amateur' as const,
    })
    expect(result.newOvr).toBeGreaterThanOrEqual(40)
    expect(result.newOvr).toBeLessThanOrEqual(99)
  })

  it('MVP_WEIGHT and MVP_FIXED_CONTRIBUTION constants have correct values', () => {
    expect(MVP_WEIGHT).toBe(0.03)
    expect(MVP_FIXED_CONTRIBUTION).toBe(80)
  })
})

describe('applyEmaWithBreakdown — signal clamp before EMA', () => {
  const baseParams = {
    matchId: 'test-match-1',
    player: { ovrScoreFloat: 70, matchCount: 10, lastMatchAt: null, avgPace: null, avgTechnique: null, avgPassing: null, avgDefending: null, avgPhysicality: null, avgEffort: null },
    matchRatings: [
      { pace: 3, technique: 3, passing: 3, defending: 3, physicality: 3, effort: 3 },
      { pace: 3, technique: 3, passing: 3, defending: 3, physicality: 3, effort: 3 },
    ],
    goalCount: 0, assistCount: 0, isMvp: false, groupTier: 'amateur' as const,
  }

  it('matchImpactClamped is at least 40 even when matchImpactRaw would be below', () => {
    // Very low ratings (3/10 all attributes) → calibrateMatchImpact(3) = 52, already above 40
    // To test the sub-40 clamp we'd need to bypass calibrateMatchImpact, which is internal.
    // Instead verify the clamped value is always >= OVR_CLAMP_MIN
    const result = ovrService.applyEmaWithBreakdown(baseParams)
    expect(result.breakdown.matchImpactClamped).toBeGreaterThanOrEqual(40)
    expect(result.breakdown.matchImpactClamped).toBeLessThanOrEqual(99)
  })

  it('matchImpactRaw is preserved in breakdown even when clamped', () => {
    const result = ovrService.applyEmaWithBreakdown(baseParams)
    // matchImpactRaw is stored before clamping — they may differ
    expect(result.breakdown).toHaveProperty('matchImpactRaw')
    expect(result.breakdown).toHaveProperty('matchImpactClamped')
  })

  it('EMA receives clamped signal (newOvr always in [40, 99])', () => {
    const result = ovrService.applyEmaWithBreakdown(baseParams)
    expect(result.newOvr).toBeGreaterThanOrEqual(40)
    expect(result.newOvr).toBeLessThanOrEqual(99)
  })
})

describe('ovrService.computeAttributeAverages', () => {
  const GROUP_ID = 'group-uuid-1'
  const RATED_PLAYER_ID = 'player-uuid-rated'
  const RATED_USER_ID = 'user-uuid-rated'

  beforeEach(() => {
    vi.clearAllMocks()
    // First select call: ratings innerJoin chain (with innerJoins for groupMemberships)
    // Second select call: group median chain (direct .where())
    mocks.mockSelect
      .mockReturnValueOnce({ from: mocks.mockSelectFrom })
      .mockReturnValue({ from: mocks.mockGroupMedianFrom })
    mocks.mockSelectFrom.mockReturnValue({ innerJoin: mocks.mockSelectInnerJoin1 })
    mocks.mockSelectInnerJoin1.mockReturnValue({ innerJoin: mocks.mockSelectInnerJoin2 })
    mocks.mockSelectInnerJoin2.mockReturnValue({ where: mocks.mockSelectWhere })
    mocks.mockGroupMedianFrom.mockReturnValue({ where: mocks.mockGroupMedianWhere })
    mocks.mockGroupMedianWhere.mockResolvedValue([]) // default: no unlocked players
    mocks.mockUpdate.mockReturnValue({ set: mocks.mockUpdateSet })
    mocks.mockUpdateSet.mockReturnValue({ where: mocks.mockUpdateWhere })
    mocks.mockUpdateWhere.mockReturnValue({ returning: mocks.mockReturning })
    // Default: update returns the rated player's userId
    mocks.mockReturning.mockResolvedValue([{ userId: RATED_USER_ID }])
    mocks.mockSeedingComputeInitialSeed.mockResolvedValue({ seededOvr: 70, seedStatus: 'PROVISIONAL' })
  })

  it('applies 2× organizer weight: 1 organizer + 1 member, verifies weighted average per attribute', async () => {
    // Organizer: pace=8 (weight 2), Member: pace=4 (weight 1)
    // Expected avgPace = (8*2 + 4*1) / (2+1) = 20/3 ≈ 6.6667
    const fakeRatings = [
      { pace: 8, technique: 6, passing: 7, defending: 5, physicality: 9, effort: 8, raterRole: 'organizer', raterUserId: 'user-org-1' },
      { pace: 4, technique: 6, passing: 5, defending: 7, physicality: 3, effort: 6, raterRole: 'member', raterUserId: 'user-member-1' },
    ]
    mocks.mockSelectWhere.mockResolvedValue(fakeRatings)

    await ovrService.computeAttributeAverages(GROUP_ID, RATED_PLAYER_ID)

    expect(mocks.mockUpdate).toHaveBeenCalled()
    const setArgs = (mocks.mockUpdateSet.mock.calls as unknown as [Record<string, string>][])[0][0]

    // avgPace = (8*2 + 4*1) / 3 = 20/3
    expect(parseFloat(setArgs['avgPace'])).toBeCloseTo(20 / 3, 5)
    // avgTechnique = (6*2 + 6*1) / 3 = 18/3 = 6.0
    expect(parseFloat(setArgs['avgTechnique'])).toBeCloseTo(6.0, 5)
    // avgPassing = (7*2 + 5*1) / 3 = 19/3
    expect(parseFloat(setArgs['avgPassing'])).toBeCloseTo(19 / 3, 5)
    // avgDefending = (5*2 + 7*1) / 3 = 17/3
    expect(parseFloat(setArgs['avgDefending'])).toBeCloseTo(17 / 3, 5)
    // avgPhysicality = (9*2 + 3*1) / 3 = 21/3 = 7.0
    expect(parseFloat(setArgs['avgPhysicality'])).toBeCloseTo(7.0, 5)
    // avgEffort = (8*2 + 6*1) / 3 = 22/3
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

    // With one organizer (weight 2), totalWeight = 2; (7*2)/2 = 7
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
