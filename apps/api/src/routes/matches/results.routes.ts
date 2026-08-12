import {Router} from 'express'
 import {asyncHandler} from '../../middleware/async-handler'
import {loadMatch, requireMatchCapability, requireMatchHost, requirePlayer} from '../../middleware/match-context'
import {RecordResultSchema, SubmitMvpVoteSchema, SubmitPostMatchRatingSchema} from './schemas'
import {ErrorCode} from '@fivematch/types'
import {db} from '../../db'
import {matches, teamGenerationJobs, players, matchParticipants, groups, mvpVotes} from '../../db/schema'
import {eq, and, isNull, sql} from 'drizzle-orm'
import {notificationService} from '../../services/notifications/notification.service'
import {tierService} from '../../services/matches/tier.service'
import {betService} from '../../services/pronos/bet.service'
import {logger} from '../../lib/logger'
import {RatingSubmissionError, ratingService} from '../../services/ratings/rating.service'
import {ovrService} from '../../services/players/ovr.service'

/**
 * Matches are a top-level resource. They used to hang off /v1/groups/:groupId,
 * which made them unreachable for anyone without a crew — the exact user the
 * product is now built around. Authorization moved from "is a group member" to
 * "what is this caller's relation to this match" (see middleware/match-context).
 */
const router = Router()

const errorFor = (code: string, statusCode: number, meta?: unknown) => ({
  error: { code, statusCode, ...(meta ? { meta } : {}) },
})

// ---------------------------------------------------------------------------
// Discovery + creation
// ---------------------------------------------------------------------------

// GET /v1/matches/discover — public matches near the caller with spots left
/**
 * After the whistle: the result, the final participant snapshot, MVP voting
 * and post-match ratings.
 *
 * Split out of a 1255-line `index.ts` that mixed five unrelated concerns
 * (Phase 7D). Route order within this file is preserved from the original.
 */

// POST /v1/matches/:matchId/result — host only
router.post(
  '/:matchId/result',
  loadMatch,
  requireMatchHost,
  asyncHandler(async (req, res) => {
    const { scoreA, scoreB, playerStats } = RecordResultSchema.parse(req.body)
    const match = req.match
    const matchId = match.id

    if (match.status === 'completed') return res.status(409).json(errorFor(ErrorCode.RESULT_ALREADY_SUBMITTED, 409))
    if (match.status !== 'in_progress') {
      return res.status(422).json(errorFor(ErrorCode.WRONG_MATCH_STATUS, 422, {
        current: match.status, required: 'in_progress',
      }))
    }

    const participants = await db
      .select({ playerId: matchParticipants.playerId, userId: matchParticipants.userId })
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, matchId))

    const completedAt = new Date()

    const resultRecord = await db.transaction(async (tx) => {
      // Concurrency boundary: only one request can transition this match. All
      // downstream counters/evidence are conditional on winning this update.
      const transitioned = await tx
        .update(matches)
        .set({ status: 'completed', completedAt, scoreA, scoreB, updatedAt: new Date() })
        .where(and(eq(matches.id, matchId), eq(matches.status, 'in_progress')))
        .returning({ id: matches.id })

      if (transitioned.length === 0) return null

      for (const stat of playerStats) {
        if (stat.goalsScored > 0 || stat.assists > 0) {
          await tx
            .update(matchParticipants)
            .set({ goalsScored: stat.goalsScored, assists: stat.assists })
            .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.playerId, stat.playerId)))
        }
      }

      if (match.groupId) {
        await tx
          .update(groups)
          .set({ matchCount: sql`${groups.matchCount} + 1`, updatedAt: new Date() })
          .where(eq(groups.id, match.groupId))
      }

      // Card eligibility is NOT recorded here any more. Phase 4 requires a
      // finalized `attended` outcome, which does not exist until the sheet is
      // settled — by the host, or by the automatic sweep 48h later (ADR-029).
      // Recording a result no longer unlocks anything on its own.
      return { newlyUnlocked: [] as Array<{ playerId: string; userId: string }> }
    })

    if (!resultRecord) {
      return res.status(409).json(errorFor(ErrorCode.RESULT_ALREADY_SUBMITTED, 409))
    }

    for (const unlocked of resultRecord.newlyUnlocked) {
      notificationService.send({
        type: 'CARD_UNLOCKED',
        groupId: match.groupId,
        playerId: unlocked.playerId,
        recipientUserId: unlocked.userId,
      })
    }

    // Crew tiering only means something for a crew.
    if (match.groupId) {
      try {
        const [group] = await db
          .select({ matchCount: groups.matchCount })
          .from(groups)
          .where(eq(groups.id, match.groupId))
        const newGroupMatchCount = group?.matchCount ?? 0
        await tierService.evaluateTier(match.groupId, newGroupMatchCount)
      } catch (err) {
        logger.error({ err, groupId: match.groupId }, 'tierService.evaluateTier failed')
      }
    }

    // Settle the betting ledger (Epic 11). Result and correct-score bets settle
    // now; MVP bets stay pending until the vote resolves, which re-runs this.
    betService.settleMatchBets(matchId).catch((err: unknown) => {
      logger.error({ err, matchId }, 'betService.settleMatchBets failed')
    })

    const recipientUserIds = participants.map((p) => p.userId).filter(Boolean) as string[]
    if (recipientUserIds.length > 0) {
      notificationService.send({ type: 'SCORE_SUBMITTED', matchId, groupId: match.groupId, recipientUserIds })
      notificationService.send({ type: 'MVP_VOTING_OPEN', matchId, groupId: match.groupId, recipientUserIds })
    }

    return res.json({ data: { success: true, completedAt: completedAt.toISOString() } })
  }),
)

// GET /v1/matches/:matchId/participants

// GET /v1/matches/:matchId/participants
router.get(
  '/:matchId/participants',
  loadMatch,
  asyncHandler(async (req, res) => {
    const matchId = req.match.id

    // cardState/ovrScore ride along so the pitch board renders from one call —
    // it used to fetch the whole group roster just to colour eleven names.
    const participants = await db
      .select({
        playerId: matchParticipants.playerId,
        displayName: matchParticipants.displayName,
        teamSide: matchParticipants.teamSide,
        userId: matchParticipants.userId,
        cardState: players.cardState,
        ovrScoreFloat: players.ovrScoreFloat,
        matchCount: players.matchCount,
      })
      .from(matchParticipants)
      .leftJoin(players, eq(players.id, matchParticipants.playerId))
      .where(eq(matchParticipants.matchId, matchId))

    const toEntry = (p: (typeof participants)[number]) => ({
      playerId: p.playerId,
      displayName: p.displayName,
      cardState: p.cardState ?? 'not_started',
      ovrScore: ovrService.getOvrForDisplay(
        p.ovrScoreFloat !== null ? Number(p.ovrScoreFloat) : null,
        p.matchCount ?? 0,
      ),
    })

    // Fairness score of the split that was locked — the same last-completed-job
    // rule as lock-teams. Manual swaps don't recompute it (matches the pre-lock display).
    const [lastJob] = await db
      .select({ fairnessScore: teamGenerationJobs.fairnessScore })
      .from(teamGenerationJobs)
      .where(and(eq(teamGenerationJobs.matchId, matchId), eq(teamGenerationJobs.status, 'complete')))
      .orderBy(sql`${teamGenerationJobs.generationNumber} DESC`)
      .limit(1)

    const myPlayerId = req.user.playerId ?? null
    const myTeamSide = participants.find((p) => p.playerId === myPlayerId)?.teamSide ?? null

    return res.json({
      data: {
        myPlayerId,
        myTeamSide,
        fairnessScore: lastJob?.fairnessScore != null ? Number(lastJob.fairnessScore) : null,
        teamA: participants.filter((p) => p.teamSide === 'A').map(toEntry),
        teamB: participants.filter((p) => p.teamSide === 'B').map(toEntry),
      },
    })
  }),
)

// POST /v1/matches/:matchId/mvp-votes — participants only

// POST /v1/matches/:matchId/mvp-votes — participants only
router.post(
  '/:matchId/mvp-votes',
  loadMatch,
  requireMatchCapability('canRate'),
  requirePlayer,
  asyncHandler(async (req, res) => {
    const { nominatedPlayerId } = SubmitMvpVoteSchema.parse(req.body)
    const match = req.match
    const matchId = match.id

    if (match.status !== 'completed' || !match.completedAt) {
      return res.status(422).json(errorFor(ErrorCode.MVP_VOTING_CLOSED, 422))
    }

    const elapsed = Date.now() - match.completedAt.getTime()
    if (elapsed > 24 * 60 * 60 * 1000 || match.mvpVotingResolvedAt !== null) {
      return res.status(422).json(errorFor(ErrorCode.MVP_VOTING_CLOSED, 422))
    }

    const voterPlayerId = req.user.playerId!

    const [voterParticipant] = await db
      .select({ teamSide: matchParticipants.teamSide })
      .from(matchParticipants)
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.playerId, voterPlayerId)))

    if (!voterParticipant) return res.status(403).json(errorFor(ErrorCode.NOT_A_PARTICIPANT, 403))

    const [nominatedParticipant] = await db
      .select({ teamSide: matchParticipants.teamSide })
      .from(matchParticipants)
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.playerId, nominatedPlayerId)))

    if (!nominatedParticipant) return res.status(403).json(errorFor(ErrorCode.NOT_A_PARTICIPANT, 403))
    if (voterParticipant.teamSide === nominatedParticipant.teamSide) {
      return res.status(422).json(errorFor(ErrorCode.CANNOT_VOTE_OWN_TEAM, 422))
    }

    try {
      await db.insert(mvpVotes).values({ matchId, voterPlayerId, nominatedPlayerId })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        return res.status(409).json(errorFor(ErrorCode.ALREADY_VOTED, 409))
      }
      throw err
    }

    return res.json({ data: { success: true } })
  }),
)

// GET /v1/matches/:matchId/mvp-result

// GET /v1/matches/:matchId/mvp-result
router.get(
  '/:matchId/mvp-result',
  loadMatch,
  asyncHandler(async (req, res) => {
    const match = req.match
    const matchId = match.id

    if (match.status !== 'completed') return res.status(422).json(errorFor(ErrorCode.WRONG_MATCH_STATUS, 422))

    const nameOf = async (playerId: string | null) => {
      if (!playerId) return null
      const [player] = await db.select({ displayName: players.displayName }).from(players).where(eq(players.id, playerId))
      return player?.displayName ?? null
    }

    if (match.mvpVotingResolvedAt) {
      return res.json({
        data: { resolved: true, mvpPlayerId: match.mvpPlayerId, mvpDisplayName: await nameOf(match.mvpPlayerId) },
      })
    }

    const windowClosed = !match.completedAt || Date.now() - match.completedAt.getTime() > 24 * 60 * 60 * 1000
    if (!windowClosed) {
      return res.json({ data: { resolved: false, mvpPlayerId: null, mvpDisplayName: null } })
    }

    const voteTallies = await db
      .select({ nominatedPlayerId: mvpVotes.nominatedPlayerId, voteCount: sql<number>`count(*)::int` })
      .from(mvpVotes)
      .where(eq(mvpVotes.matchId, matchId))
      .groupBy(mvpVotes.nominatedPlayerId)

    let winnerId: string | null = null
    if (voteTallies.length > 0) {
      const maxVotes = Math.max(...voteTallies.map((t) => t.voteCount))
      const topCandidates = voteTallies.filter((t) => t.voteCount === maxVotes)
      winnerId = topCandidates[Math.floor(Math.random() * topCandidates.length)]!.nominatedPlayerId
    }

    // Race-condition guard: only the request that finds it unresolved persists.
    const persisted = await db
      .update(matches)
      .set({ mvpPlayerId: winnerId, mvpVotingResolvedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(matches.id, matchId), isNull(matches.mvpVotingResolvedAt)))
      .returning({ mvpPlayerId: matches.mvpPlayerId })

    const resolvedWinnerId = persisted.length > 0 ? (persisted[0]!.mvpPlayerId ?? null) : winnerId

    // The MVP is now known — settle the bets left pending at result time.
    // Idempotent, so the race-loser above cannot double-credit anything.
    betService.settleMatchBets(matchId).catch((err: unknown) => {
      logger.error({ err, matchId }, 'betService.settleMatchBets failed')
    })

    return res.json({
      data: { resolved: true, mvpPlayerId: resolvedWinnerId, mvpDisplayName: await nameOf(resolvedWinnerId) },
    })
  }),
)

// POST /v1/matches/:matchId/ratings — participants only, within the 48h window

// POST /v1/matches/:matchId/ratings — participants only, within the 48h window
router.post(
  '/:matchId/ratings',
  loadMatch,
  requireMatchCapability('canRate'),
  requirePlayer,
  asyncHandler(async (req, res) => {
    const body = SubmitPostMatchRatingSchema.parse(req.body)
    const match = req.match
    const matchId = match.id
    const raterPlayerId = req.user.playerId!

    try {
      const result = await ratingService.submitPostMatchRating({
        matchId,
        raterPlayerId,
        ratedPlayerId: body.ratedPlayerId,
        values: {
          pace: body.pace,
          technique: body.technique,
          passing: body.passing,
          defending: body.defending,
          physicality: body.physicality,
          effort: body.effort,
        },
      })
      return res.status(201).json({ data: result })
    } catch (error: unknown) {
      if (!(error instanceof RatingSubmissionError)) throw error
      if (error.code === 'RATING_WINDOW_CLOSED' && !match.ratingWindowClosedAt) {
        void ratingService.closeWindow(matchId).catch((err: unknown) => {
          logger.error({ err, matchId }, 'closeWindow failed')
        })
      }
      return res.status(error.statusCode).json(errorFor(ErrorCode[error.code], error.statusCode))
    }
  }),
)

export default router
