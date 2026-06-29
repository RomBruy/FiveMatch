import {
  OVR_ATTRIBUTE_WEIGHTS,
  EMA_ALPHA_MIN,
  EMA_ALPHA_DECAY,
  EMA_ALPHA_START,
  GROUP_TIER_MULTIPLIERS,
  OVR_CLAMP_MIN,
  OVR_CLAMP_MAX,
  ORGANIZER_RATING_WEIGHT,
  PLAYER_TIER_THRESHOLDS,
  OVR_TREND_STABILITY_THRESHOLD,
  SEED_PRIOR_MIN_UNLOCKED_PLAYERS,
  TEAM_GEN_OVR_FALLBACK,
  GOAL_TECHNIQUE_BOOST,
  GOAL_PACE_BOOST,
  ASSIST_PASSING_BOOST,
  OVR_CALIBRATION_ANCHORS,
  MVP_WEIGHT,
  MVP_FIXED_CONTRIBUTION,
} from '@fivematch/types/algorithm-constants'
import type { PlayerTier } from '@fivematch/types/algorithm-constants'
import type { OvrSignal } from './ovr-signal'
import type { CardState, AlphaBreakdown, AttributeSet, MatchUpdateBreakdown } from '@fivematch/types'
import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../../db'
import { ratings, players, groupMemberships, groups, matchParticipants, matches, ratingEvents } from '../../db/schema'
import { notificationService } from '../notifications/notification.service'
import { seedingService } from './seeding.service'

type OvrAttributes = {
  pace: number
  technique: number
  passing: number
  defending: number
  physicality: number
  effort: number
}

type GroupTier = keyof typeof GROUP_TIER_MULTIPLIERS

function computeOvr(attributes: OvrAttributes): number {
  return (
    attributes.pace * OVR_ATTRIBUTE_WEIGHTS.pace +
    attributes.technique * OVR_ATTRIBUTE_WEIGHTS.technique +
    attributes.passing * OVR_ATTRIBUTE_WEIGHTS.passing +
    attributes.defending * OVR_ATTRIBUTE_WEIGHTS.defending +
    attributes.physicality * OVR_ATTRIBUTE_WEIGHTS.physicality +
    attributes.effort * OVR_ATTRIBUTE_WEIGHTS.effort
  )
}

function applyEma(
  currentOvr: number,
  matchImpact: number,
  matchCount: number,
  groupTier: GroupTier = 'club',
): number {
  const tierMultiplier = GROUP_TIER_MULTIPLIERS[groupTier]
  const rawAlpha = EMA_ALPHA_START - matchCount * EMA_ALPHA_DECAY
  const alpha = Math.max(EMA_ALPHA_MIN, rawAlpha * tierMultiplier)
  const newOvr = (1 - alpha) * currentOvr + alpha * matchImpact
  return Math.min(OVR_CLAMP_MAX, Math.max(OVR_CLAMP_MIN, newOvr))
}

function getCardState(matchCount: number, hasInitialRating: boolean): CardState {
  if (!hasInitialRating) return 'not_started'
  if (matchCount === 0) return 'in_progress_1'
  if (matchCount === 1) return 'in_progress_2'
  if (matchCount >= 2 && matchCount < 4) return 'in_progress_3'
  return 'unlocked'
}

function applySignals(
  currentOvr: number,
  signals: OvrSignal[],
  matchCount: number,
  groupTier?: GroupTier,
): number {
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0)
  if (totalWeight === 0) return currentOvr
  const matchImpact = signals.reduce((sum, s) => sum + s.value * s.weight, 0) / totalWeight
  return applyEma(currentOvr, matchImpact, matchCount, groupTier)
}

function computeAlphaBreakdown(params: {
  matchCountBefore: number
  daysSinceLastMatch: number | null
  raterCount: number
  ratingStdDev: number
  groupTier: GroupTier
}): AlphaBreakdown {
  const { matchCountBefore, daysSinceLastMatch, raterCount, ratingStdDev } = params

  const rawAlpha = EMA_ALPHA_START - matchCountBefore * EMA_ALPHA_DECAY
  const baseAlpha = Math.max(EMA_ALPHA_MIN, rawAlpha)

  // Story 8.X will update inactivityMultiplier with full inactivity logic
  const inactivityMultiplier = 1.0

  if (raterCount < 2) {
    return {
      matchCountBefore, baseAlpha, daysSinceLastMatch, inactivityMultiplier,
      uncertaintyAlpha: 0, raterCount, ratingStdDev,
      countFactor: 0, agreementFactor: 0, evidenceQuality: 0,
      finalAlphaBeforeClamp: 0, finalAlphaAfterClamp: 0,
    }
  }

  const uncertaintyAlpha = baseAlpha * inactivityMultiplier

  const countFactor = Math.min(1, raterCount / 6)
  let agreementFactor: number
  if (ratingStdDev <= 0.75) agreementFactor = 1.00
  else if (ratingStdDev >= 2.50) agreementFactor = 0.60
  else agreementFactor = 1.00 - 0.40 * (ratingStdDev - 0.75) / (2.50 - 0.75)
  const evidenceQuality = countFactor * agreementFactor

  const finalAlphaBeforeClamp = uncertaintyAlpha * evidenceQuality
  const finalAlphaAfterClamp = Math.min(0.30, Math.max(EMA_ALPHA_MIN, finalAlphaBeforeClamp))

  return {
    matchCountBefore, baseAlpha, daysSinceLastMatch, inactivityMultiplier,
    uncertaintyAlpha, raterCount, ratingStdDev, countFactor, agreementFactor,
    evidenceQuality, finalAlphaBeforeClamp, finalAlphaAfterClamp,
  }
}

type ApplyEmaWithBreakdownParams = {
  matchId: string
  player: {
    ovrScoreFloat: number
    matchCount: number
    lastMatchAt: Date | null
    avgPace: string | null; avgTechnique: string | null; avgPassing: string | null
    avgDefending: string | null; avgPhysicality: string | null; avgEffort: string | null
  }
  matchRatings: Array<{ pace: number; technique: number; passing: number; defending: number; physicality: number; effort: number }>
  goalCount: number
  assistCount: number
  isMvp: boolean
  groupTier: GroupTier
}

function applyEmaWithBreakdown(params: ApplyEmaWithBreakdownParams): { newOvr: number; breakdown: MatchUpdateBreakdown } {
  const { matchId, player, matchRatings, goalCount, assistCount, isMvp, groupTier } = params
  const raterCount = matchRatings.length

  const rawAttributes: AttributeSet = { pace: 0, technique: 0, passing: 0, defending: 0, physicality: 0, effort: 0 }
  for (const r of matchRatings) {
    rawAttributes.pace += r.pace; rawAttributes.technique += r.technique
    rawAttributes.passing += r.passing; rawAttributes.defending += r.defending
    rawAttributes.physicality += r.physicality; rawAttributes.effort += r.effort
  }
  const n = raterCount || 1
  for (const k of Object.keys(rawAttributes) as (keyof AttributeSet)[]) rawAttributes[k] /= n

  const boostedAttributes: AttributeSet = { ...rawAttributes }
  if (goalCount > 0) {
    boostedAttributes.technique = Math.min(10, rawAttributes.technique + GOAL_TECHNIQUE_BOOST)
    boostedAttributes.pace = Math.min(10, rawAttributes.pace + GOAL_PACE_BOOST)
  }
  if (assistCount > 0) {
    boostedAttributes.passing = Math.min(10, rawAttributes.passing + ASSIST_PASSING_BOOST)
  }

  const attributeScoreRaw = computeOvr(boostedAttributes)

  // Compute variance from the true mean of per-rater OVR scores (not the boosted composite).
  // Using the boosted score as the mean inflates stdDev for goal-scorers even when raters agreed.
  const perRaterScores = matchRatings.map((r) =>
    computeOvr({ pace: r.pace, technique: r.technique, passing: r.passing, defending: r.defending, physicality: r.physicality, effort: r.effort })
  )
  const ratingMean = perRaterScores.reduce((s, v) => s + v, 0) / Math.max(1, raterCount)
  const variance = perRaterScores.reduce((sum, score) => sum + Math.pow(score - ratingMean, 2), 0) / Math.max(1, raterCount)
  const ratingStdDev = Math.sqrt(variance)

  const matchImpactRaw = calibrateMatchImpact(attributeScoreRaw)

  // Story 8.7 makes this an explicit clamp step
  const matchImpactClamped = Math.min(OVR_CLAMP_MAX, Math.max(OVR_CLAMP_MIN, matchImpactRaw))

  const mvpAdjustmentApplied = isMvp
  const matchImpactAfterMvp = isMvp
    ? matchImpactClamped * (1 - MVP_WEIGHT) + MVP_FIXED_CONTRIBUTION * MVP_WEIGHT
    : matchImpactClamped

  const contextMultiplier = GROUP_TIER_MULTIPLIERS[groupTier] ?? 1.0
  const oldOvr = player.ovrScoreFloat
  const performanceDelta = matchImpactAfterMvp - oldOvr
  const contextAdjustedDelta = performanceDelta * contextMultiplier
  const adjustedMatchImpact = oldOvr + contextAdjustedDelta

  const daysSinceLastMatch = player.lastMatchAt
    ? Math.floor((Date.now() - player.lastMatchAt.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const alphaBreakdown = computeAlphaBreakdown({ matchCountBefore: player.matchCount, daysSinceLastMatch, raterCount, ratingStdDev, groupTier })

  const finalAlpha = alphaBreakdown.finalAlphaAfterClamp
  const newOvrBeforeClamp = oldOvr + finalAlpha * (adjustedMatchImpact - oldOvr)
  const newOvr = Math.min(OVR_CLAMP_MAX, Math.max(OVR_CLAMP_MIN, newOvrBeforeClamp))

  const breakdown: MatchUpdateBreakdown = {
    matchId, rawAttributes, boostedAttributes, goalCount, assistCount, raterCount, ratingStdDev,
    attributeScoreRaw, matchImpactRaw, matchImpactClamped, mvpAdjustmentApplied, matchImpactAfterMvp,
    groupTier, contextMultiplier, performanceDelta, contextAdjustedDelta, adjustedMatchImpact,
    alpha: alphaBreakdown, oldOvr, newOvrBeforeClamp, newOvr,
    displayedOldOvr: Math.round(oldOvr), displayedNewOvr: Math.round(newOvr),
    rawDelta: newOvr - oldOvr, displayedDelta: Math.round(newOvr) - Math.round(oldOvr),
  }

  return { newOvr, breakdown }
}

function getOvrForDisplay(ovrScoreFloat: number | null, matchCount: number): number | null {
  return matchCount < 4 ? null : (ovrScoreFloat === null ? null : Math.round(ovrScoreFloat))
}

function computeTrend(
  previousOvrFloat: number | null,
  currentOvrFloat: number,
): 'Stable' | 'Trending up' | 'Trending down' {
  if (previousOvrFloat === null) return 'Stable'
  const delta = currentOvrFloat - previousOvrFloat
  if (Math.abs(delta) < OVR_TREND_STABILITY_THRESHOLD) return 'Stable'
  return delta > 0 ? 'Trending up' : 'Trending down'
}

function computeGroupMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

async function computeAttributeAverages(groupId: string, ratedPlayerId: string): Promise<void> {
  const ratingsWithRoles = await db
    .select({
      pace: ratings.pace,
      technique: ratings.technique,
      passing: ratings.passing,
      defending: ratings.defending,
      physicality: ratings.physicality,
      effort: ratings.effort,
      raterRole: groupMemberships.role,
      raterUserId: players.userId,
    })
    .from(ratings)
    .innerJoin(players, eq(players.id, ratings.raterPlayerId))
    .innerJoin(groupMemberships, and(
      eq(groupMemberships.userId, players.userId),
      eq(groupMemberships.groupId, groupId),
      isNull(groupMemberships.deletedAt),
    ))
    .where(and(
      eq(ratings.ratedPlayerId, ratedPlayerId),
      eq(ratings.groupId, groupId),
      eq(ratings.isInitial, true),
    ))

  if (ratingsWithRoles.length === 0) return

  const totalWeight = ratingsWithRoles.reduce(
    (s, r) => s + (r.raterRole === 'organizer' ? ORGANIZER_RATING_WEIGHT : 1),
    0,
  )

  const weightedSum = (attr: keyof typeof ratingsWithRoles[0]) =>
    ratingsWithRoles.reduce((s, r) => {
      const w = r.raterRole === 'organizer' ? ORGANIZER_RATING_WEIGHT : 1
      return s + (r[attr] as number) * w
    }, 0)

  const avgPace = weightedSum('pace') / totalWeight
  const avgTechnique = weightedSum('technique') / totalWeight
  const avgPassing = weightedSum('passing') / totalWeight
  const avgDefending = weightedSum('defending') / totalWeight
  const avgPhysicality = weightedSum('physicality') / totalWeight
  const avgEffort = weightedSum('effort') / totalWeight

  const [updatedPlayer] = await db
    .update(players)
    .set({
      avgPace: String(avgPace),
      avgTechnique: String(avgTechnique),
      avgPassing: String(avgPassing),
      avgDefending: String(avgDefending),
      avgPhysicality: String(avgPhysicality),
      avgEffort: String(avgEffort),
      cardState: 'in_progress_1',
    })
    .where(and(eq(players.id, ratedPlayerId), isNull(players.deletedAt)))
    .returning({ userId: players.userId })

  if (updatedPlayer) {
    notificationService.send({
      type: 'CARD_INITIAL_UNLOCKED',
      groupId,
      ratedPlayerId,
      recipientUserId: updatedPlayer.userId,
    })
  }

  // Compute per-rater OVR on OVR scale (×10 to convert 1–10 attribute scale)
  const organizerRow = ratingsWithRoles.find((r) => r.raterRole === 'organizer') ?? null
  const peerRows = ratingsWithRoles.filter((r) => r.raterRole !== 'organizer')

  const toOvrScale = (r: typeof ratingsWithRoles[0]): number =>
    Math.round(
      computeOvr({
        pace: r.pace,
        technique: r.technique,
        passing: r.passing,
        defending: r.defending,
        physicality: r.physicality,
        effort: r.effort,
      }) * 10,
    )

  // Compute group median OVR from unlocked players (used as prior when enough data)
  const unlockedOvrs = await db
    .select({ ovrScoreFloat: players.ovrScoreFloat })
    .from(players)
    .where(and(
      eq(players.groupId, groupId),
      eq(players.cardState, 'unlocked'),
      isNull(players.deletedAt),
    ))

  const unlockedValues = unlockedOvrs
    .map((p) => (p.ovrScoreFloat !== null ? parseFloat(p.ovrScoreFloat) : null))
    .filter((v): v is number => v !== null)

  const groupMedianUnlockedOvr = unlockedValues.length >= SEED_PRIOR_MIN_UNLOCKED_PLAYERS
    ? computeGroupMedian(unlockedValues)
    : null

  await seedingService.computeInitialSeed({
    playerId: ratedPlayerId,
    groupId,
    organizerRating: organizerRow !== null ? toOvrScale(organizerRow) : null,
    organizerUserId: organizerRow?.raterUserId ?? null,
    peerRatings: peerRows.map((r) => ({ raterUserId: r.raterUserId, rating: toOvrScale(r) })),
    groupMedianUnlockedOvr,
  })
}

function evaluatePlayerTier(ovrScore: number): PlayerTier {
  if (ovrScore >= PLAYER_TIER_THRESHOLDS.crack) return 'crack'
  if (ovrScore >= PLAYER_TIER_THRESHOLDS.performeur) return 'performeur'
  if (ovrScore >= PLAYER_TIER_THRESHOLDS.joueur) return 'joueur'
  return 'rookie'
}

async function runPostMatchUpdate(matchId: string): Promise<void> {
  // 1. Load match metadata
  const [match] = await db
    .select({
      id: matches.id,
      groupId: matches.groupId,
      mvpPlayerId: matches.mvpPlayerId,
    })
    .from(matches)
    .where(eq(matches.id, matchId))

  if (!match) return

  // 2. Resolve group tier for EMA multiplier
  const [groupRow] = await db
    .select({ tier: groups.tier })
    .from(groups)
    .where(eq(groups.id, match.groupId))

  const groupTier = (groupRow?.tier ?? 'amateur') as GroupTier

  // 5. Load all participants with goals/assists
  const participants = await db
    .select({
      playerId: matchParticipants.playerId,
      goalsScored: matchParticipants.goalsScored,
      assists: matchParticipants.assists,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.matchId, matchId))

  for (const participant of participants) {
    if (!participant.playerId) continue // GDPR-anonymized participant — skip

    // 6. Load current player state
    const [player] = await db
      .select({
        id: players.id,
        userId: players.userId,
        ovrScoreFloat: players.ovrScoreFloat,
        matchCount: players.matchCount,
        lastMatchAt: players.lastMatchAt,
        cardState: players.cardState,
        playerTier: players.playerTier,
        avgPace: players.avgPace,
        avgTechnique: players.avgTechnique,
        avgPassing: players.avgPassing,
        avgDefending: players.avgDefending,
        avgPhysicality: players.avgPhysicality,
        avgEffort: players.avgEffort,
      })
      .from(players)
      .where(and(eq(players.id, participant.playerId), isNull(players.deletedAt)))

    if (!player) continue

    // 7. Aggregate this match's post-match ratings for this player
    const matchRatings = await db
      .select({
        pace: ratings.pace,
        technique: ratings.technique,
        passing: ratings.passing,
        defending: ratings.defending,
        physicality: ratings.physicality,
        effort: ratings.effort,
      })
      .from(ratings)
      .where(and(
        eq(ratings.ratedPlayerId, participant.playerId),
        eq(ratings.matchId, matchId),
        eq(ratings.isInitial, false),
      ))

    // If no post-match ratings exist for this player, skip OVR update
    if (matchRatings.length === 0) continue

    // 8. Apply EMA with full breakdown — replaces applySignals() from Story 4.4
    const currentOvr = player.ovrScoreFloat ? parseFloat(player.ovrScoreFloat) : TEAM_GEN_OVR_FALLBACK
    const isMvp = match.mvpPlayerId === participant.playerId
    const { newOvr, breakdown } = applyEmaWithBreakdown({
      matchId,
      player: {
        ovrScoreFloat: currentOvr,
        matchCount: player.matchCount,
        lastMatchAt: player.lastMatchAt,
        avgPace: player.avgPace,
        avgTechnique: player.avgTechnique,
        avgPassing: player.avgPassing,
        avgDefending: player.avgDefending,
        avgPhysicality: player.avgPhysicality,
        avgEffort: player.avgEffort,
      },
      matchRatings,
      goalCount: participant.goalsScored,
      assistCount: participant.assists,
      isMvp,
      groupTier,
    })
    // Only count this match toward card unlock when there were enough raters to actually update OVR.
    // A zero alpha (raterCount < 2) leaves OVR unchanged; unlocking the card on stale OVR is misleading.
    const newMatchCount = breakdown.alpha.finalAlphaAfterClamp > 0 ? player.matchCount + 1 : player.matchCount

    // 9. Recompute attribute averages from ALL ratings for this player (initial + post-match)
    // Do NOT apply goal/assist boosts here — those affect the EMA signal only, not stored averages
    const allRatings = await db
      .select({
        pace: ratings.pace,
        technique: ratings.technique,
        passing: ratings.passing,
        defending: ratings.defending,
        physicality: ratings.physicality,
        effort: ratings.effort,
      })
      .from(ratings)
      .where(and(
        eq(ratings.ratedPlayerId, participant.playerId),
        eq(ratings.groupId, match.groupId),
      ))

    const allCount = allRatings.length
    const newAvgPace = allRatings.reduce((s, r) => s + r.pace, 0) / allCount
    const newAvgTechnique = allRatings.reduce((s, r) => s + r.technique, 0) / allCount
    const newAvgPassing = allRatings.reduce((s, r) => s + r.passing, 0) / allCount
    const newAvgDefending = allRatings.reduce((s, r) => s + r.defending, 0) / allCount
    const newAvgPhysicality = allRatings.reduce((s, r) => s + r.physicality, 0) / allCount
    const newAvgEffort = allRatings.reduce((s, r) => s + r.effort, 0) / allCount

    // 10. Determine card state transition
    const newCardState = getCardState(newMatchCount, true) // player has initial ratings by this point

    // 11. Evaluate player tier (only meaningful once card is unlocked)
    const newTier = evaluatePlayerTier(Math.round(newOvr))
    const tierChanged = newTier !== (player.playerTier ?? 'rookie')

    // 12. Persist all updates atomically
    await db
      .update(players)
      .set({
        ovrScoreFloat: String(newOvr),
        previousOvrScoreFloat: player.ovrScoreFloat,
        matchCount: newMatchCount,
        cardState: newCardState,
        playerTier: newTier,
        lastMatchAt: new Date(),
        avgPace: String(newAvgPace),
        avgTechnique: String(newAvgTechnique),
        avgPassing: String(newAvgPassing),
        avgDefending: String(newAvgDefending),
        avgPhysicality: String(newAvgPhysicality),
        avgEffort: String(newAvgEffort),
      })
      .where(and(eq(players.id, participant.playerId), isNull(players.deletedAt)))

    // 12b. Write MATCH_UPDATE audit event
    await db.insert(ratingEvents).values({
      playerId: participant.playerId,
      eventType: 'MATCH_UPDATE',
      oldOvr: String(currentOvr),
      newOvr: String(newOvr),
      seedStatus: null,
      breakdown: breakdown as unknown as Record<string, unknown>,
    })

    // 13. Dispatch CARD_UNLOCKED notification when transitioning to 'unlocked'
    if (player.cardState !== 'unlocked' && newCardState === 'unlocked') {
      notificationService.send({
        type: 'CARD_UNLOCKED',
        groupId: match.groupId,
        playerId: participant.playerId,
        recipientUserId: player.userId,
      })
    }

    // 14. Dispatch PLAYER_TIER_CHANGED notification when tier changes
    if (tierChanged) {
      notificationService.send({
        type: 'PLAYER_TIER_CHANGED',
        groupId: match.groupId,
        playerId: participant.playerId,
        previousTier: player.playerTier ?? 'rookie',
        newTier,
        recipientUserId: player.userId,
      })
    }
  }
}

function calibrateMatchImpact(attributeScore: number): number {
  const anchors = OVR_CALIBRATION_ANCHORS
  if (attributeScore <= anchors[0].rating) return anchors[0].ovr
  if (attributeScore >= anchors[anchors.length - 1].rating) return anchors[anchors.length - 1].ovr

  for (let i = 0; i < anchors.length - 1; i++) {
    const lower = anchors[i]
    const upper = anchors[i + 1]
    if (attributeScore >= lower.rating && attributeScore <= upper.rating) {
      const t = (attributeScore - lower.rating) / (upper.rating - lower.rating)
      return lower.ovr + t * (upper.ovr - lower.ovr)
    }
  }

  return anchors[anchors.length - 1].ovr
}

export const ovrService = {
  computeOvr,
  applyEma,
  getCardState,
  applySignals,
  applyEmaWithBreakdown,
  computeAlphaBreakdown,
  calibrateMatchImpact,
  getOvrForDisplay,
  computeTrend,
  computeAttributeAverages,
  evaluatePlayerTier,
  runPostMatchUpdate,
}
