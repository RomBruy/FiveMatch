import { Router } from 'express'
import { eq, and, isNull, isNotNull, desc } from 'drizzle-orm'
import { asyncHandler } from '../../middleware/async-handler'
import { requireGroupMember } from '../../middleware/require-group-member'
import { db } from '../../db'
import { players, users, matches } from '../../db/schema'
import { ovrService } from '../../services/players/ovr.service'
import { ErrorCode } from '@fivematch/types'
import { logger } from '../../lib/logger'

const router = Router({ mergeParams: true })

// GET /v1/groups/:groupId/players
router.get(
  '/',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params as { groupId: string }

    const rows = await db
      .select({
        id: players.id,
        displayName: users.name,
        cardState: players.cardState,
        matchCount: players.matchCount,
        ovrScoreFloat: players.ovrScoreFloat,
        previousOvrScoreFloat: players.previousOvrScoreFloat,
        avgPace: players.avgPace,
        avgTechnique: players.avgTechnique,
        avgPassing: players.avgPassing,
        avgDefending: players.avgDefending,
        avgPhysicality: players.avgPhysicality,
        avgEffort: players.avgEffort,
        profilePhotoCardUrl: players.profilePhotoCardUrl,
      })
      .from(players)
      .innerJoin(users, eq(users.id, players.userId))
      .where(and(eq(players.groupId, groupId), isNull(players.deletedAt)))

    const items = rows.map((row) => {
      const hasAttributes = row.avgPace !== null
      const attributes = hasAttributes
        ? {
            pace: parseFloat(row.avgPace!),
            technique: parseFloat(row.avgTechnique!),
            passing: parseFloat(row.avgPassing!),
            defending: parseFloat(row.avgDefending!),
            physicality: parseFloat(row.avgPhysicality!),
            effort: parseFloat(row.avgEffort!),
          }
        : null

      const currentFloat = row.ovrScoreFloat ? parseFloat(row.ovrScoreFloat) : null
      const previousFloat = row.previousOvrScoreFloat ? parseFloat(row.previousOvrScoreFloat) : null
      let trend: 'up' | 'down' | 'stable' | null = null
      if (currentFloat !== null && previousFloat !== null) {
        const computedTrend = ovrService.computeTrend(previousFloat, currentFloat)
        if (computedTrend === 'Trending up') trend = 'up'
        else if (computedTrend === 'Trending down') trend = 'down'
        else trend = 'stable'
      }

      return {
        playerId: row.id,
        displayName: row.displayName,
        cardState: row.cardState,
        matchCount: row.matchCount,
        ovrScore: ovrService.getOvrForDisplay(currentFloat, row.matchCount),
        trend,
        attributes,
        photoUrl: row.profilePhotoCardUrl ?? null,
      }
    })

    return res.json({ data: { items, hasMore: false } })
  }),
)

// GET /v1/groups/:groupId/players/:playerId
router.get(
  '/:playerId',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId, playerId } = req.params as { groupId: string; playerId: string }

    const [row] = await db
      .select({
        id: players.id,
        displayName: users.name,
        cardState: players.cardState,
        matchCount: players.matchCount,
        ovrScoreFloat: players.ovrScoreFloat,
        previousOvrScoreFloat: players.previousOvrScoreFloat,
        avgPace: players.avgPace,
        avgTechnique: players.avgTechnique,
        avgPassing: players.avgPassing,
        avgDefending: players.avgDefending,
        avgPhysicality: players.avgPhysicality,
        avgEffort: players.avgEffort,
        profilePhotoCardUrl: players.profilePhotoCardUrl,
      })
      .from(players)
      .innerJoin(users, eq(users.id, players.userId))
      .where(and(eq(players.id, playerId), eq(players.groupId, groupId)))
      .limit(1)

    if (!row) {
      return res.status(404).json({
        error: { code: ErrorCode.MEMBER_NOT_FOUND, message: 'Player not found in group', statusCode: 404 },
      })
    }

    // Drizzle returns numeric columns as strings — parse to numbers
    const hasAttributes = row.avgPace !== null
    const attributes = hasAttributes
      ? {
          pace: parseFloat(row.avgPace!),
          technique: parseFloat(row.avgTechnique!),
          passing: parseFloat(row.avgPassing!),
          defending: parseFloat(row.avgDefending!),
          physicality: parseFloat(row.avgPhysicality!),
          effort: parseFloat(row.avgEffort!),
        }
      : null

    const currentFloat = row.ovrScoreFloat ? parseFloat(row.ovrScoreFloat) : null
    const previousFloat = row.previousOvrScoreFloat ? parseFloat(row.previousOvrScoreFloat) : null
    let trend: 'up' | 'down' | 'stable' | null = null
    if (currentFloat !== null && previousFloat !== null) {
      const computedTrend = ovrService.computeTrend(previousFloat, currentFloat)
      if (computedTrend === 'Trending up') trend = 'up'
      else if (computedTrend === 'Trending down') trend = 'down'
      else trend = 'stable'
    }

    const recentMvpMatch = await db
      .select({ mvpPlayerId: matches.mvpPlayerId })
      .from(matches)
      .where(
        and(
          eq(matches.groupId, groupId),
          eq(matches.status, 'completed'),
          isNotNull(matches.mvpVotingResolvedAt)
        )
      )
      .orderBy(desc(matches.mvpVotingResolvedAt))
      .limit(1)

    const isMvp = recentMvpMatch[0]?.mvpPlayerId === row.id

    return res.json({
      data: {
        playerId: row.id,
        displayName: row.displayName,
        cardState: row.cardState,
        matchCount: row.matchCount,
        ovrScore: ovrService.getOvrForDisplay(currentFloat, row.matchCount),
        trend,
        attributes,
        photoUrl: row.profilePhotoCardUrl ?? null,
        isMvp,
      },
    })
  }),
)

// POST /v1/groups/:groupId/players/:playerId/card-share-event
router.post(
  '/:playerId/card-share-event',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId, playerId } = req.params as { groupId: string; playerId: string }
    logger.info({ groupId, playerId, userId: req.user.userId }, 'card_share_event')
    return res.status(200).json({ data: { ok: true } })
  })
)

export default router
