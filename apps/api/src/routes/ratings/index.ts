import { Router } from 'express'
import { eq, and, isNull, inArray, count, countDistinct } from 'drizzle-orm'
import { asyncHandler } from '../../middleware/async-handler'
import { requireGroupMember } from '../../middleware/require-group-member'
import { submitInitialRatingSchema } from './schemas'
import { db } from '../../db'
import { ratings, players, groupMemberships } from '../../db/schema'
import { ovrService } from '../../services/players/ovr.service'
import { ErrorCode } from '@fivematch/types'
import { logger } from '../../lib/logger'

const router = Router({ mergeParams: true })

function getAvatarInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return displayName.slice(0, 2).toUpperCase()
}

// POST /v1/groups/:groupId/ratings/initial — submit initial rating for one player
router.post(
  '/initial',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const groupId = req.params['groupId'] as string
    const body = submitInitialRatingSchema.parse(req.body)

    // Look up caller's player record (internalId = users.id set by requireGroupMember)
    const [callerPlayer] = await db
      .select({ id: players.id })
      .from(players)
      .where(and(
        eq(players.userId, req.user.internalId!),
        eq(players.groupId, groupId),
        isNull(players.deletedAt),
      ))
      .limit(1)

    if (!callerPlayer) {
      return res.status(404).json({
        error: { code: ErrorCode.MEMBER_NOT_FOUND, message: 'Player record not found', statusCode: 404 },
      })
    }

    const raterPlayerId = callerPlayer.id

    // Idempotency: reject duplicate initial rating for same pair
    const [existing] = await db
      .select({ id: ratings.id })
      .from(ratings)
      .where(and(
        eq(ratings.groupId, groupId),
        eq(ratings.raterPlayerId, raterPlayerId),
        eq(ratings.ratedPlayerId, body.ratedPlayerId),
        eq(ratings.isInitial, true),
      ))
      .limit(1)

    if (existing) {
      return res.status(409).json({
        error: { code: ErrorCode.MATCH_ALREADY_RATED, message: 'Already submitted initial rating for this player', statusCode: 409 },
      })
    }

    // Insert the rating row — raterPlayerId stored server-side, never in response
    await db.insert(ratings).values({
      groupId,
      raterPlayerId,
      ratedPlayerId: body.ratedPlayerId,
      pace: body.pace,
      technique: body.technique,
      passing: body.passing,
      defending: body.defending,
      physicality: body.physicality,
      effort: body.effort,
      mentality: body.mentality,
      isInitial: true,
    })

    // Check if all active members have now rated this player
    const [{ memberCount }] = await db
      .select({ memberCount: count() })
      .from(groupMemberships)
      .where(and(
        eq(groupMemberships.groupId, groupId),
        inArray(groupMemberships.role, ['member', 'organizer']),
        isNull(groupMemberships.deletedAt),
      ))

    const [{ raterCount }] = await db
      .select({ raterCount: countDistinct(ratings.raterPlayerId) })
      .from(ratings)
      .where(and(
        eq(ratings.ratedPlayerId, body.ratedPlayerId),
        eq(ratings.groupId, groupId),
        eq(ratings.isInitial, true),
      ))

    if (Number(raterCount) >= Number(memberCount)) {
      void ovrService.computeAttributeAverages(groupId, body.ratedPlayerId).catch((err: unknown) => {
        logger.error({ err, groupId, ratedPlayerId: body.ratedPlayerId }, 'computeAttributeAverages failed')
      })
    }

    return res.status(201).json({ data: { rated: true } })
  }),
)

// GET /v1/groups/:groupId/ratings/initial/pending — members caller still needs to rate
router.get(
  '/initial/pending',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const groupId = req.params['groupId'] as string

    // Look up caller's player record
    const [callerPlayer] = await db
      .select({ id: players.id })
      .from(players)
      .where(and(
        eq(players.userId, req.user.internalId!),
        eq(players.groupId, groupId),
        isNull(players.deletedAt),
      ))
      .limit(1)

    if (!callerPlayer) {
      return res.status(404).json({
        error: { code: ErrorCode.MEMBER_NOT_FOUND, message: 'Player record not found', statusCode: 404 },
      })
    }

    const raterPlayerId = callerPlayer.id

    // Find all active members in the group (excluding caller)
    const allMembers = await db
      .select({ playerId: players.id, displayName: players.displayName })
      .from(players)
      .innerJoin(groupMemberships, and(
        eq(groupMemberships.userId, players.userId),
        eq(groupMemberships.groupId, groupId),
        inArray(groupMemberships.role, ['member', 'organizer']),
        isNull(groupMemberships.deletedAt),
      ))
      .where(and(
        eq(players.groupId, groupId),
        isNull(players.deletedAt),
      ))

    // Exclude the caller from the list
    const otherMembers = allMembers.filter((m) => m.playerId !== raterPlayerId)

    if (otherMembers.length === 0) {
      return res.json({ data: { items: [], total: 0, rated: 0 } })
    }

    // Find player IDs that caller has already rated (initial only)
    const alreadyRated = await db
      .select({ ratedPlayerId: ratings.ratedPlayerId })
      .from(ratings)
      .where(and(
        eq(ratings.groupId, groupId),
        eq(ratings.raterPlayerId, raterPlayerId),
        eq(ratings.isInitial, true),
        inArray(ratings.ratedPlayerId, otherMembers.map((m) => m.playerId)),
      ))

    const alreadyRatedIds = new Set(alreadyRated.map((r) => r.ratedPlayerId))

    const pending = otherMembers
      .filter((m) => !alreadyRatedIds.has(m.playerId))
      .map((m) => ({
        playerId: m.playerId,
        displayName: m.displayName,
        avatarInitials: getAvatarInitials(m.displayName),
      }))

    return res.json({
      data: {
        items: pending,
        total: otherMembers.length,
        rated: alreadyRatedIds.size,
      },
    })
  }),
)

export default router
