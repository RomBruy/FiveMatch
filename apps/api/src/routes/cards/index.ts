import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { asyncHandler } from '../../middleware/async-handler'
import { db } from '../../db'
import { players } from '../../db/schema'
import { cardGenerationService } from '../../services/cards/card-generation.service'
import { processCardGenerationJob } from '../../jobs/card-generation.job'
import { ErrorCode } from '@fivematch/types'

const router = Router({ mergeParams: true })

// POST /v1/players/:playerId/card-photo/consent
router.post(
  '/consent',
  asyncHandler(async (req, res) => {
    const { playerId } = req.params as { playerId: string }
    // Verify the acting user owns this player record (compare internal UUIDs)
    const ownerCheck = await db
      .select({ userId: players.userId })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1)
    if (!ownerCheck[0] || ownerCheck[0].userId !== req.user.internalId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Cannot modify consent for another player', statusCode: 403 },
      })
    }
    await cardGenerationService.grantConsent(playerId)
    return res.json({ data: { photoConsentGiven: true } })
  })
)

// POST /v1/players/:playerId/card-photo/generate
router.post(
  '/generate',
  asyncHandler(async (req, res) => {
    const { playerId } = req.params as { playerId: string }
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined
    if (!idempotencyKey) {
      return res.status(400).json({
        error: { code: 'MISSING_IDEMPOTENCY_KEY', message: 'Idempotency-Key header is required', statusCode: 400 },
      })
    }

    // Verify the acting user owns this player record
    const ownerCheck = await db
      .select({ userId: players.userId })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1)
    if (!ownerCheck[0] || ownerCheck[0].userId !== req.user.internalId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Cannot generate card for another player', statusCode: 403 },
      })
    }

    // Consent gate
    const hasConsent = await cardGenerationService.checkConsent(playerId)
    if (!hasConsent) {
      return res.status(403).json({
        error: { code: ErrorCode.CONSENT_REQUIRED, message: 'Photo consent required', statusCode: 403 },
      })
    }

    const result = await cardGenerationService.createGenerationJob(playerId, idempotencyKey)
    if ('error' in result) {
      return res.status(result.statusCode).json({
        error: { code: result.error, message: result.error, statusCode: result.statusCode, meta: result.meta },
      })
    }

    // Fire-and-forget: trigger job processing asynchronously
    if (result.state === 'pending') {
      processCardGenerationJob(result.jobId).catch(() => {
        // Errors are captured inside processCardGenerationJob via Sentry
      })
    }

    return res.status(202).json({ data: { jobId: result.jobId, state: result.state } })
  })
)

// GET /v1/players/:playerId/card-photo/status
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const { playerId } = req.params as { playerId: string }
    const [owner] = await db.select({ userId: players.userId }).from(players)
      .where(eq(players.id, playerId)).limit(1)
    if (!owner || owner.userId !== req.user.internalId) {
      return res.status(403).json({
        error: { code: ErrorCode.FORBIDDEN, message: 'Cannot view another player photo status', statusCode: 403 },
      })
    }
    const status = await cardGenerationService.getStatus(playerId)
    return res.json({ data: status })
  })
)

export default router
