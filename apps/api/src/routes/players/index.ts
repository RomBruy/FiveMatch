import { Router } from 'express'
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
