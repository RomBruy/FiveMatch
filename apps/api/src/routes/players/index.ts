import { Router } from 'express'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { players } from '../../db/schema'
import { ProfileFieldVisibilitySchema } from '@fivematch/types'
import { PRONOS_STARTING_BANKROLL } from '@fivematch/types/algorithm-constants'
import { ErrorCode } from '@fivematch/types'
import { asyncHandler } from '../../middleware/async-handler'
import { bankrollService } from '../../services/pronos/bankroll.service'
import { pronosFeedService } from '../../services/pronos/pronos-feed.service'
import { playerProfileService } from '../../services/players/player-profile.service'
import { logger } from '../../lib/logger'

const router = Router({ mergeParams: true })

const notFound = () => ({
  error: { code: ErrorCode.PLAYER_NOT_FOUND, message: 'Player not found', statusCode: 404 },
})

// Owner-only DTO. This is intentionally a different serializer from /:playerId.
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.user.playerId) return res.status(404).json(notFound())
    const profile = await playerProfileService.getPrivateProfile(req.user.playerId, req.user.userId)
    return profile ? res.json({ data: profile }) : res.status(404).json(notFound())
  }),
)

router.patch(
  '/me/visibility',
  asyncHandler(async (req, res) => {
    if (!req.user.internalId || !req.user.playerId) return res.status(404).json(notFound())
    const visibility = ProfileFieldVisibilitySchema.parse(req.body)
    const updated = await playerProfileService.updateVisibility(req.user.internalId, visibility)
    return updated ? res.json({ data: { visibility: updated } }) : res.status(404).json(notFound())
  }),
)

router.get(
  '/me/bankroll',
  asyncHandler(async (req, res) => {
    if (!req.user.playerId) return res.status(404).json(notFound())
    const balance = await bankrollService.getBalance(req.user.playerId)
    return res.json({ data: { balance, startingBankroll: PRONOS_STARTING_BANKROLL } })
  }),
)

// PUT /v1/players/me/photo-source
//
// The photo generation reads from. Kept separate from the generated card image
// so a second generation restyles the original rather than its own output.
//
// A URL rather than an upload: Clerk already hosts the player's photo over
// HTTPS, so re-implementing upload and hosting here would add a second copy of
// the same personal data for no benefit.
router.put(
  '/me/photo-source',
  asyncHandler(async (req, res) => {
    if (!req.user.playerId) return res.status(404).json(notFound())

    const { sourceUrl } = z.object({ sourceUrl: z.string().url() }).parse(req.body)

    // The generation job refuses anything but HTTPS; rejecting it here too means
    // the player finds out immediately rather than through a failed job.
    if (!sourceUrl.startsWith('https://')) {
      return res.status(400).json({
        error: { code: ErrorCode.VALIDATION_ERROR, message: 'Source photo must be https', statusCode: 400 },
      })
    }

    await db.update(players).set({ profilePhotoSourceUrl: sourceUrl }).where(eq(players.id, req.user.playerId))
    return res.json({ data: { sourceUrl } })
  }),
)

// GET /v1/players/me/pronos
//
// The whole Pronos tab in one call: balance, every market this player may bet on
// right now, and their bet history. Betting itself stays on the match-scoped
// routes — this is the index that never existed while everything was per match.
router.get(
  '/me/pronos',
  asyncHandler(async (req, res) => {
    if (!req.user.playerId || !req.user.internalId) return res.status(404).json(notFound())
    const feed = await pronosFeedService.getFeed(req.user.internalId, req.user.playerId)
    return res.json({ data: feed })
  }),
)

// Audience-filtered public DTO. It never builds or returns the owner DTO.
router.get(
  '/:playerId',
  asyncHandler(async (req, res) => {
    const { playerId } = req.params as { playerId: string }
    const profile = await playerProfileService.getPublicProfile(
      playerId,
      req.user.internalId!,
      req.user.playerId,
    )
    return profile ? res.json({ data: profile }) : res.status(404).json(notFound())
  }),
)

router.post(
  '/:playerId/card-share-event',
  asyncHandler(async (req, res) => {
    const { playerId } = req.params as { playerId: string }
    logger.info({ playerId, userId: req.user.userId }, 'card_share_event')
    return res.status(200).json({ data: { ok: true } })
  }),
)

export default router
