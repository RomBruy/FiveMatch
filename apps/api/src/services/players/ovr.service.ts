import {
  OVR_ATTRIBUTE_WEIGHTS,
  ALPHA_FLOOR,
  ALPHA_DECAY,
  ALPHA_BASE,
  ALPHA_CEIL,
  RATER_FULL,
  DIVERSITY_SPRING,
  DIVERSITY_TARGET_CAP,
  GROUP_TIER_MULTIPLIERS,
  PLAYER_TIER_THRESHOLDS,
  TIER_MARGIN,
  OVR_CLAMP_MIN,
  OVR_CLAMP_MAX,
  OVR_TREND_STABILITY_THRESHOLD,
  ORGANIZER_RATING_WEIGHT,
  SEED_PRIOR_MIN_UNLOCKED_PLAYERS,
  TEAM_GEN_OVR_FALLBACK,
  MVP_BONUS,
  GOAL_PT,
  ASSIST_PT,
  OBJECTIVE_GOAL_CAP,
  OUTCOME_WEIGHT,
  EXPECTED_SCALE_D,
  OVR_CALIBRATION_ANCHORS,
} from '@fivematch/types/algorithm-constants'
import type { PlayerTier } from '@fivematch/types/algorithm-constants'
import type { OvrSignal } from './ovr-signal'
import type { CardState, AlphaBreakdown, AttributeSet, MatchUpdateBreakdown } from '@fivematch/types'
import { eq, and, inArray, isNull, ne } from 'drizzle-orm'
import { db, type Db } from '../../db'
import {
  ratings,
  players,
  groupMemberships,
  groups,
  matchParticipants,
  matches,
  ovrProcessingEvents,
  ratingEvents,
} from '../../db/schema'
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
type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0]

// ─── Tier boundary helpers ────────────────────────────────────────────────────

const TIER_ORDER: PlayerTier[] = ['rookie', 'joueur', 'performeur', 'crack']

// Upper boundary OVR that must be crossed (+ TIER_MARGIN) to promote out of this tier.
const TIER_BOUNDARY_UP: Record<PlayerTier, number | null> = {
  rookie: PLAYER_TIER_THRESHOLDS.joueur,
  joueur: PLAYER_TIER_THRESHOLDS.performeur,
  performeur: PLAYER_TIER_THRESHOLDS.crack,
  crack: null,
}

// Lower boundary OVR that must be crossed (- TIER_MARGIN) to demote into the tier below.
const TIER_BOUNDARY_DOWN: Record<PlayerTier, number | null> = {
  rookie: null,
  joueur: PLAYER_TIER_THRESHOLDS.joueur,
  performeur: PLAYER_TIER_THRESHOLDS.performeur,
  crack: PLAYER_TIER_THRESHOLDS.crack,
}

function shouldChangeTier(currentTier: PlayerTier, candidateTier: PlayerTier, newOvr: number): boolean {
  if (candidateTier === currentTier) return false
  const goingUp = TIER_ORDER.indexOf(candidateTier) > TIER_ORDER.indexOf(currentTier)
  if (goingUp) {
    const boundary = TIER_BOUNDARY_UP[currentTier]
    return boundary !== null && newOvr >= boundary + TIER_MARGIN
  }
  const boundary = TIER_BOUNDARY_DOWN[currentTier]
  return boundary !== null && newOvr < boundary - TIER_MARGIN
}

// ─── Core math ────────────────────────────────────────────────────────────────

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

// Standalone EMA used by applySignals (legacy path, kept for compatibility).
// `distinctRatersCount` is passed as the first decay parameter (semantically equivalent
// to matchCount in v1, but now represents rater diversity).
function applyEma(
  currentOvr: number,
  matchImpact: number,
  distinctRatersCount: number,
  groupTier: GroupTier = 'club',
): number {
  const tierMultiplier = GROUP_TIER_MULTIPLIERS[groupTier]
  const rawAlpha = ALPHA_BASE - distinctRatersCount * ALPHA_DECAY
  const baseAlpha = Math.max(ALPHA_FLOOR, rawAlpha)
  const alpha = Math.min(ALPHA_CEIL, Math.max(ALPHA_FLOOR, baseAlpha * tierMultiplier))
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
  distinctRatersCount: number,
  groupTier?: GroupTier,
): number {
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0)
  if (totalWeight === 0) return currentOvr
  const matchImpact = signals.reduce((sum, s) => sum + s.value * s.weight, 0) / totalWeight
  return applyEma(currentOvr, matchImpact, distinctRatersCount, groupTier)
}

// ─── Alpha breakdown (Step 7) ─────────────────────────────────────────────────

function computeAlphaBreakdown(params: {
  matchCountBefore: number
  distinctRatersBefore: number
  diversityTarget: number
  raterCount: number
  ratingStdDev: number
  groupTier: GroupTier
}): AlphaBreakdown {
  const { matchCountBefore, distinctRatersBefore, diversityTarget, raterCount, ratingStdDev, groupTier } = params

  // Settling component: alpha decays with match count
  const rawAlpha = ALPHA_BASE - matchCountBefore * ALPHA_DECAY
  const baseAlpha = Math.max(ALPHA_FLOOR, rawAlpha)

  // Diversity guard: bounded additive bonus when evidence is narrow relative to available group
  const diversityRatio = diversityTarget > 0 ? Math.min(1, distinctRatersBefore / diversityTarget) : 1
  const diversityGuard = DIVERSITY_SPRING * Math.max(0, 1 - diversityRatio)
  const adjustedBaseAlpha = Math.min(ALPHA_CEIL, baseAlpha + diversityGuard)

  const tierMultiplier = GROUP_TIER_MULTIPLIERS[groupTier]

  if (raterCount < 2) {
    return {
      matchCountBefore, distinctRatersBefore, diversityTarget,
      baseAlpha, diversityGuard, adjustedBaseAlpha,
      raterCount, ratingStdDev,
      countFactor: 0, rawAgreementFactor: 0, agreementFactor: 0, evidenceQuality: 0,
      tierMultiplier,
      finalAlphaBeforeClamp: 0, finalAlphaAfterClamp: 0,
    }
  }

  const countFactor = Math.min(1, raterCount / RATER_FULL)

  let rawAgreementFactor: number
  if (ratingStdDev <= 0.75) rawAgreementFactor = 1.00
  else if (ratingStdDev >= 2.50) rawAgreementFactor = 0.60
  else rawAgreementFactor = 1.00 - 0.40 * (ratingStdDev - 0.75) / (2.50 - 0.75)

  // Small-sample shrinkage: trust "high consensus" less when few raters
  const agreementFactor = 1 - countFactor * (1 - rawAgreementFactor)
  const evidenceQuality = countFactor * agreementFactor

  const finalAlphaBeforeClamp = adjustedBaseAlpha * evidenceQuality * tierMultiplier
  const finalAlphaAfterClamp = Math.min(ALPHA_CEIL, Math.max(ALPHA_FLOOR, finalAlphaBeforeClamp))

  return {
    matchCountBefore, distinctRatersBefore, diversityTarget,
    baseAlpha, diversityGuard, adjustedBaseAlpha,
    raterCount, ratingStdDev,
    countFactor, rawAgreementFactor, agreementFactor, evidenceQuality,
    tierMultiplier,
    finalAlphaBeforeClamp, finalAlphaAfterClamp,
  }
}

// ─── Full pipeline (Steps 1–8) ────────────────────────────────────────────────

type ApplyEmaWithBreakdownParams = {
  matchId: string
  player: {
    ovrScoreFloat: number
    matchCount: number            // used as matchCountBefore for alpha decay
    lastMatchAt: Date | null
    avgPace: string | null; avgTechnique: string | null; avgPassing: string | null
    avgDefending: string | null; avgPhysicality: string | null; avgEffort: string | null
  }
  matchRatings: Array<{ pace: number; technique: number; passing: number; defending: number; physicality: number; effort: number }>
  goalCount: number
  assistCount: number
  isMvp: boolean
  groupTier: GroupTier
  distinctRatersCount: number     // distinct people who have EVER rated this player
  diversityTarget: number         // min(activeRosterSize - 1, DIVERSITY_TARGET_CAP)
  myTeamAvgOvr: number            // from teamAOvrAtLock / teamBOvrAtLock (reproducible snapshot)
  oppTeamAvgOvr: number
  matchOutcome: 'win' | 'draw' | 'loss'
}

function applyEmaWithBreakdown(params: ApplyEmaWithBreakdownParams): { newOvr: number; breakdown: MatchUpdateBreakdown } {
  const { matchId, player, matchRatings, goalCount, assistCount, isMvp, groupTier,
          distinctRatersCount, diversityTarget, myTeamAvgOvr, oppTeamAvgOvr, matchOutcome } = params
  const raterCount = matchRatings.length

  // Step 1 — average peer attributes (pure peer opinion, no boosts in v2)
  const rawAttributes: AttributeSet = { pace: 0, technique: 0, passing: 0, defending: 0, physicality: 0, effort: 0 }
  for (const r of matchRatings) {
    rawAttributes.pace += r.pace; rawAttributes.technique += r.technique
    rawAttributes.passing += r.passing; rawAttributes.defending += r.defending
    rawAttributes.physicality += r.physicality; rawAttributes.effort += r.effort
  }
  const n = raterCount || 1
  for (const k of Object.keys(rawAttributes) as (keyof AttributeSet)[]) rawAttributes[k] /= n

  // Step 3 — weighted attribute score (1–10 scale)
  const attributeScoreRaw = computeOvr(rawAttributes)

  // StdDev on per-rater scores for alpha evidence quality (1–10 scale)
  const perRaterScores = matchRatings.map((r) => computeOvr(r))
  const ratingMean = perRaterScores.reduce((s, v) => s + v, 0) / Math.max(1, raterCount)
  const variance = perRaterScores.reduce((sum, score) => sum + Math.pow(score - ratingMean, 2), 0) / Math.max(1, raterCount)
  const ratingStdDev = Math.sqrt(variance)

  // Step 4 — calibrate to OVR scale, clamp to [40, 99]
  const matchImpactRaw = calibrateMatchImpact(attributeScoreRaw)
  const matchImpactBase = Math.min(OVR_CLAMP_MAX, Math.max(OVR_CLAMP_MIN, matchImpactRaw))

  // Step 5 — assemble match impact with objective signals
  const mvpBonus = isMvp ? MVP_BONUS : 0
  const goalContribution = Math.min(OBJECTIVE_GOAL_CAP, goalCount * GOAL_PT + assistCount * ASSIST_PT)

  const expectedWin = 1 / (1 + Math.pow(10, -(myTeamAvgOvr - oppTeamAvgOvr) / EXPECTED_SCALE_D))
  const actual = matchOutcome === 'win' ? 1.0 : matchOutcome === 'draw' ? 0.5 : 0.0
  const outcomeAdjustment = OUTCOME_WEIGHT * (actual - expectedWin)

  const matchImpact = Math.min(OVR_CLAMP_MAX, Math.max(OVR_CLAMP_MIN,
    matchImpactBase + mvpBonus + goalContribution + outcomeAdjustment))

  // Step 7 — reliability / alpha (split roles: matchCount for settling, diversity guard for evidence breadth)
  const alphaBreakdown = computeAlphaBreakdown({
    matchCountBefore: player.matchCount,
    distinctRatersBefore: distinctRatersCount,
    diversityTarget,
    raterCount, ratingStdDev, groupTier,
  })
  const finalAlpha = alphaBreakdown.finalAlphaAfterClamp

  // Step 8 — EMA update
  const oldOvr = player.ovrScoreFloat
  const newOvrBeforeClamp = oldOvr + finalAlpha * (matchImpact - oldOvr)
  const newOvr = Math.min(OVR_CLAMP_MAX, Math.max(OVR_CLAMP_MIN, newOvrBeforeClamp))

  const breakdown: MatchUpdateBreakdown = {
    matchId, rawAttributes, goalCount, assistCount, raterCount, ratingStdDev,
    attributeScoreRaw, matchImpactRaw, matchImpactBase,
    mvpBonus, goalContribution,
    myTeamAvgOvr, oppTeamAvgOvr, expectedWin, actual, outcomeAdjustment, matchImpact,
    groupTier, alpha: alphaBreakdown,
    oldOvr, newOvrBeforeClamp, newOvr,
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

  // The seed prior is now the median of every unlocked player, not of one crew.
  // With a global identity a crew median would be a biased sample of the same
  // population — and a solo player has no crew to take a median of.
  const unlockedOvrs = await db
    .select({ ovrScoreFloat: players.ovrScoreFloat })
    .from(players)
    .where(and(
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

async function getEligibleRatingsForPlayer(tx: Transaction, ratedPlayerId: string) {
  const candidates = await tx
    .select({
      matchId: ratings.matchId,
      raterPlayerId: ratings.raterPlayerId,
      pace: ratings.pace,
      technique: ratings.technique,
      passing: ratings.passing,
      defending: ratings.defending,
      physicality: ratings.physicality,
      effort: ratings.effort,
      matchStatus: matches.status,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
    })
    .from(ratings)
    .innerJoin(matches, eq(matches.id, ratings.matchId))
    .where(and(
      eq(ratings.ratedPlayerId, ratedPlayerId),
      eq(ratings.isInitial, false),
    ))

  const matchIds = [...new Set(candidates.map((row) => row.matchId).filter((id): id is string => id !== null))]
  if (matchIds.length === 0) return []

  const snapshots = await tx
    .select({
      matchId: matchParticipants.matchId,
      playerId: matchParticipants.playerId,
      teamSide: matchParticipants.teamSide,
    })
    .from(matchParticipants)
    .where(inArray(matchParticipants.matchId, matchIds))

  const sideByMatchPlayer = new Map(
    snapshots
      .filter((row): row is typeof row & { playerId: string } => row.playerId !== null)
      .map((row) => [`${row.matchId}:${row.playerId}`, row.teamSide]),
  )

  return candidates.filter((rating) => {
    if (!rating.matchId || !rating.raterPlayerId) return false
    if (rating.raterPlayerId === ratedPlayerId) return false
    if (rating.matchStatus !== 'completed' || rating.scoreA === null || rating.scoreB === null) return false
    const raterSide = sideByMatchPlayer.get(`${rating.matchId}:${rating.raterPlayerId}`)
    const targetSide = sideByMatchPlayer.get(`${rating.matchId}:${ratedPlayerId}`)
    return raterSide !== undefined && targetSide !== undefined && raterSide !== targetSide
  })
}

async function runPostMatchUpdate(matchId: string): Promise<void> {
  // 1. Load match metadata (including OVR snapshot from team lock — fix #3)
  const [match] = await db
    .select({
      id: matches.id,
      groupId: matches.groupId,
      status: matches.status,
      mvpPlayerId: matches.mvpPlayerId,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      teamAOvrAtLock: matches.teamAOvrAtLock,
      teamBOvrAtLock: matches.teamBOvrAtLock,
    })
    .from(matches)
    .where(eq(matches.id, matchId))

  if (!match || match.status !== 'completed' || match.scoreA === null || match.scoreB === null) return

  // 2. Resolve crew tier for the alpha multiplier. A standalone match has no
  //    crew, so it sits at the baseline tier.
  const [groupRow] = match.groupId
    ? await db.select({ tier: groups.tier }).from(groups).where(eq(groups.id, match.groupId))
    : [undefined]

  const groupTier = (groupRow?.tier ?? 'amateur') as GroupTier

  // 3. Diversity target — "have enough different people seen you". For a crew
  //    match the denominator is the active roster; for a standalone match it is
  //    everyone who actually turned out, which is the only pool that exists.
  const diversityPool = match.groupId
    ? (await db
        .select({ id: groupMemberships.id })
        .from(groupMemberships)
        .where(and(
          eq(groupMemberships.groupId, match.groupId),
          isNull(groupMemberships.deletedAt),
          ne(groupMemberships.role, 'pending_member'),
        ))).length
    : (await db
        .select({ id: matchParticipants.id })
        .from(matchParticipants)
        .where(eq(matchParticipants.matchId, matchId))).length

  const diversityTarget = Math.min(Math.max(0, diversityPool - 1), DIVERSITY_TARGET_CAP)

  // 4. Team OVR averages: read from the snapshot stored at team-lock time (reproducible).
  //    Fall back to neutral value only if the match pre-dates the snapshot column.
  const teamAAvgOvr = match.teamAOvrAtLock !== null
    ? parseFloat(match.teamAOvrAtLock)
    : TEAM_GEN_OVR_FALLBACK
  const teamBAvgOvr = match.teamBOvrAtLock !== null
    ? parseFloat(match.teamBOvrAtLock)
    : TEAM_GEN_OVR_FALLBACK

  // 5. Load all participants with team sides
  const allParticipants = await db
    .select({
      playerId: matchParticipants.playerId,
      teamSide: matchParticipants.teamSide,
      goalsScored: matchParticipants.goalsScored,
      assists: matchParticipants.assists,
    })
    .from(matchParticipants)
    .where(eq(matchParticipants.matchId, matchId))

  // 6. Match result direction (team A perspective)
  const teamAWon = match.scoreA > match.scoreB
  const isDraw = match.scoreA === match.scoreB

  // 7. Process each participant. The claim, player projection and audit event
  //    commit in one transaction, so retries/concurrent closes are deterministic.
  for (const participant of allParticipants) {
    if (!participant.playerId) continue // GDPR-anonymized participant — skip
    const processed = await db.transaction(async (tx) => {
      const [player] = await tx
        .select({
          id: players.id,
          userId: players.userId,
          ovrScoreFloat: players.ovrScoreFloat,
          matchCount: players.matchCount,
          lastMatchAt: players.lastMatchAt,
          playerTier: players.playerTier,
          avgPace: players.avgPace,
          avgTechnique: players.avgTechnique,
          avgPassing: players.avgPassing,
          avgDefending: players.avgDefending,
          avgPhysicality: players.avgPhysicality,
          avgEffort: players.avgEffort,
        })
        .from(players)
        .where(and(eq(players.id, participant.playerId!), isNull(players.deletedAt)))
        .limit(1)

      if (!player) return null

      const allEligibleRatings = await getEligibleRatingsForPlayer(tx, participant.playerId!)
      const currentMatchRatings = allEligibleRatings.filter((rating) => rating.matchId === matchId)
      if (currentMatchRatings.length === 0) return null

      const claim = await tx
        .insert(ovrProcessingEvents)
        .values({ matchId, playerId: participant.playerId!, processingType: 'MATCH_UPDATE' })
        .onConflictDoNothing()
        .returning({ id: ovrProcessingEvents.id })
      if (claim.length === 0) return null

      const distinctRatersCount = new Set(
        allEligibleRatings.map((rating) => rating.raterPlayerId).filter((id): id is string => id !== null),
      ).size

      const side = participant.teamSide
      const matchOutcome: 'win' | 'draw' | 'loss' = isDraw ? 'draw'
        : (side === 'A' ? (teamAWon ? 'win' : 'loss') : (teamAWon ? 'loss' : 'win'))
      const myTeamAvgOvr = side === 'A' ? teamAAvgOvr : teamBAvgOvr
      const oppTeamAvgOvr = side === 'A' ? teamBAvgOvr : teamAAvgOvr
      const currentOvr = player.ovrScoreFloat ? parseFloat(player.ovrScoreFloat) : TEAM_GEN_OVR_FALLBACK

      const { newOvr, breakdown } = applyEmaWithBreakdown({
        matchId,
        player: {
          ovrScoreFloat: currentOvr,
          matchCount: player.matchCount,
          lastMatchAt: player.lastMatchAt,
          avgPace: player.avgPace, avgTechnique: player.avgTechnique, avgPassing: player.avgPassing,
          avgDefending: player.avgDefending, avgPhysicality: player.avgPhysicality, avgEffort: player.avgEffort,
        },
        matchRatings: currentMatchRatings,
        goalCount: participant.goalsScored,
        assistCount: participant.assists,
        isMvp: match.mvpPlayerId === participant.playerId,
        groupTier,
        distinctRatersCount,
        diversityTarget,
        myTeamAvgOvr,
        oppTeamAvgOvr,
        matchOutcome,
      })

      const allCount = allEligibleRatings.length
      const average = (attribute: 'pace' | 'technique' | 'passing' | 'defending' | 'physicality' | 'effort') =>
        allEligibleRatings.reduce((sum, rating) => sum + rating[attribute], 0) / allCount

      const currentTier = (player.playerTier ?? 'rookie') as PlayerTier
      const candidateTier = evaluatePlayerTier(Math.round(newOvr))
      const tierChanged = shouldChangeTier(currentTier, candidateTier, newOvr)
      const newTier = tierChanged ? candidateTier : currentTier

      await tx
        .update(players)
        .set({
          ovrScoreFloat: String(newOvr),
          previousOvrScoreFloat: player.ovrScoreFloat,
          playerTier: newTier,
          avgPace: String(average('pace')),
          avgTechnique: String(average('technique')),
          avgPassing: String(average('passing')),
          avgDefending: String(average('defending')),
          avgPhysicality: String(average('physicality')),
          avgEffort: String(average('effort')),
        })
        .where(and(eq(players.id, participant.playerId!), isNull(players.deletedAt)))

      await tx.insert(ratingEvents).values({
        playerId: participant.playerId!,
        matchId,
        eventType: 'MATCH_UPDATE',
        oldOvr: String(currentOvr),
        newOvr: String(newOvr),
        seedStatus: null,
        breakdown: breakdown as unknown as Record<string, unknown>,
      })

      return { tierChanged, currentTier, newTier, userId: player.userId }
    })

    if (processed?.tierChanged) {
      notificationService.send({
        type: 'PLAYER_TIER_CHANGED',
        groupId: match.groupId,
        playerId: participant.playerId,
        previousTier: processed.currentTier,
        newTier: processed.newTier,
        recipientUserId: processed.userId,
      })
    }
  }
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
