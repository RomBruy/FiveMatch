import { Router } from 'express'
import { asyncHandler } from '../../middleware/async-handler'
import { requireGroupMember } from '../../middleware/require-group-member'
import { db } from '../../db'
import { pronos, matches, players, matchAttendances } from '../../db/schema'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { ErrorCode } from '@fivematch/types'
import { SubmitPronosSchema } from './schemas'

const router = Router({ mergeParams: true })

// POST /v1/groups/:groupId/matches/:matchId/pronos — submit or upsert prono
router.post(
  '/',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }
    const data = SubmitPronosSchema.parse(req.body)

    // Resolve caller's player for this group
    const [callerPlayer] = await db
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.userId, req.user.internalId!), eq(players.groupId, groupId), isNull(players.deletedAt)))

    if (!callerPlayer) {
      return res.status(403).json({ error: { code: ErrorCode.NOT_A_MEMBER, statusCode: 403 } })
    }

    // Load match and verify it belongs to this group
    const [match] = await db
      .select({ id: matches.id, scheduledAt: matches.scheduledAt })
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.groupId, groupId)))

    if (!match) {
      return res.status(404).json({ error: { code: ErrorCode.MATCH_NOT_FOUND, statusCode: 404 } })
    }

    // Check pronos window
    if (new Date() >= match.scheduledAt) {
      return res.status(422).json({
        error: { code: ErrorCode.PRONOS_WINDOW_CLOSED, message: 'Pronos window is closed', statusCode: 422 },
      })
    }

    const submittedAt = new Date()

    await db
      .insert(pronos)
      .values({
        matchId,
        playerId: callerPlayer.id,
        predictionResult: data.predictionResult,
        predictionMvpPlayerId: data.predictionMvpPlayerId,
        predictionScore: `${data.predictionScoreA}-${data.predictionScoreB}`,
        submittedAt,
      })
      .onConflictDoUpdate({
        target: [pronos.matchId, pronos.playerId],
        set: {
          predictionResult: data.predictionResult,
          predictionMvpPlayerId: data.predictionMvpPlayerId,
          predictionScore: `${data.predictionScoreA}-${data.predictionScoreB}`,
          submittedAt,
        },
      })

    return res.json({ data: { submittedAt: submittedAt.toISOString() } })
  }),
)

// GET /v1/groups/:groupId/matches/:matchId/pronos/my — return caller's prono (null if none)
router.get(
  '/my',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }

    const [callerPlayer] = await db
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.userId, req.user.internalId!), eq(players.groupId, groupId), isNull(players.deletedAt)))

    if (!callerPlayer) {
      return res.json({ data: { prono: null } })
    }

    const [prono] = await db
      .select({
        predictionResult: pronos.predictionResult,
        predictionMvpPlayerId: pronos.predictionMvpPlayerId,
        predictionScore: pronos.predictionScore,
        submittedAt: pronos.submittedAt,
        pointsEarned: pronos.pointsEarned,
      })
      .from(pronos)
      .where(and(eq(pronos.matchId, matchId), eq(pronos.playerId, callerPlayer.id)))

    return res.json({ data: { prono: prono ?? null } })
  }),
)

// GET /v1/groups/:groupId/matches/:matchId/pronos/attendees-in — players with status='in'
router.get(
  '/attendees-in',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }

    const rows = await db
      .select({
        playerId: matchAttendances.playerId,
        displayName: players.displayName,
      })
      .from(matchAttendances)
      .innerJoin(players, eq(players.id, matchAttendances.playerId))
      .innerJoin(matches, eq(matches.id, matchAttendances.matchId))
      .where(
        and(
          eq(matchAttendances.matchId, matchId),
          eq(matches.groupId, groupId),
          eq(matchAttendances.status, 'in'),
          isNull(matchAttendances.waitlistPosition),
        ),
      )

    return res.json({
      data: {
        players: rows
          .filter((r) => r.playerId !== null)
          .map((r) => ({ playerId: r.playerId, displayName: r.displayName })),
      },
    })
  }),
)

// GET /v1/groups/:groupId/matches/:matchId/pronos/reveal
router.get(
  '/reveal',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }

    // Verify match belongs to this group and is completed
    const [match] = await db
      .select({
        id: matches.id,
        status: matches.status,
        scoreA: matches.scoreA,
        scoreB: matches.scoreB,
        mvpPlayerId: matches.mvpPlayerId,
      })
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.groupId, groupId)))

    if (!match) {
      return res.status(404).json({ error: { code: ErrorCode.MATCH_NOT_FOUND, statusCode: 404 } })
    }
    if (match.status !== 'completed') {
      return res.status(403).json({ error: { code: ErrorCode.REVEAL_NOT_AVAILABLE, statusCode: 403 } })
    }

    // Derive actual result
    const actualResult =
      match.scoreA! > match.scoreB! ? 'teamA'
      : match.scoreB! > match.scoreA! ? 'teamB'
      : 'draw'
    const actualScore = `${match.scoreA}-${match.scoreB}`

    // Resolve actual MVP display name
    let actualMvpDisplayName: string | null = null
    if (match.mvpPlayerId) {
      const [mvpPlayer] = await db
        .select({ displayName: players.displayName })
        .from(players)
        .where(eq(players.id, match.mvpPlayerId))
      actualMvpDisplayName = mvpPlayer?.displayName ?? null
    }

    // Fetch all pronos rows for this match with player display names
    const rows = await db
      .select({
        playerId: pronos.playerId,
        displayName: players.displayName,
        predictionResult: pronos.predictionResult,
        predictionMvpPlayerId: pronos.predictionMvpPlayerId,
        predictionScore: pronos.predictionScore,
        pointsEarned: pronos.pointsEarned,
      })
      .from(pronos)
      .innerJoin(players, eq(players.id, pronos.playerId))
      .where(eq(pronos.matchId, matchId))

    // Resolve MVP display names for predictions (batch)
    const mvpPlayerIds = [...new Set(
      rows
        .map((r) => r.predictionMvpPlayerId)
        .filter((id): id is string => id !== null)
    )]
    const mvpPlayerMap = new Map<string, string>()
    if (mvpPlayerIds.length > 0) {
      const mvpPlayers = await db
        .select({ id: players.id, displayName: players.displayName })
        .from(players)
        .where(inArray(players.id, mvpPlayerIds))
      for (const p of mvpPlayers) {
        mvpPlayerMap.set(p.id, p.displayName)
      }
    }

    // Build response rows with breakdown
    const responseRows = rows
      .map((row) => {
        const scoreCorrect = row.predictionScore === actualScore
        const resultCorrect = row.predictionResult === actualResult
        const mvpCorrect =
          match.mvpPlayerId !== null &&
          row.predictionMvpPlayerId === match.mvpPlayerId
        return {
          playerId: row.playerId,
          displayName: row.displayName,
          predictionResult: row.predictionResult,
          predictionMvpDisplayName: row.predictionMvpPlayerId
            ? (mvpPlayerMap.get(row.predictionMvpPlayerId) ?? null)
            : null,
          predictionScore: row.predictionScore,
          pointsEarned: row.pointsEarned ?? 0,
          breakdown: { scoreCorrect, resultCorrect, mvpCorrect },
        }
      })
      .sort((a, b) => b.pointsEarned - a.pointsEarned)

    return res.json({
      data: {
        rows: responseRows,
        actualResult,
        actualScore,
        actualMvpDisplayName,
      },
    })
  }),
)

export default router
