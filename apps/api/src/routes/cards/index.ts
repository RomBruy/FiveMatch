import { Router, type Request, type Response, type NextFunction } from 'express'
import { eq } from 'drizzle-orm'
import { asyncHandler } from '../../middleware/async-handler'
import { db } from '../../db'
import { players } from '../../db/schema'
import { cardGenerationService } from '../../services/cards/card-generation.service'
import { photoConsentService } from '../../services/cards/photo-consent.service'
import { processCardGenerationJob } from '../../jobs/card-generation.job'
import { ErrorCode } from '@fivematch/types'

const router = Router({ mergeParams: true })

const forbidden = (res: Response, message: string) =>
  res.status(403).json({ error: { code: ErrorCode.FORBIDDEN, message, statusCode: 403 } })

/**
 * Every route here is owner-only (rule 39).
 *
 * Previously each handler repeated its own ownership lookup, which is how one
 * eventually gets forgotten. Consent state, processing status, generated assets
 * and deletion are all things only the subject may see or do.
 */
async function requirePhotoOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const { playerId } = req.params as { playerId: string }
    const [owner] = await db
      .select({ userId: players.userId })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1)

    if (!owner || owner.userId !== req.user.internalId) {
      forbidden(res, 'Photo processing is owner-only')
      return
    }
    next()
  } catch (err) {
    next(err)
  }
}

router.use(requirePhotoOwner)

// GET /v1/players/:playerId/card-photo/consent
// What the player agreed to, when, and whether it still stands.
router.get(
  '/consent',
  asyncHandler(async (req, res) => {
    const { playerId } = req.params as { playerId: string }
    return res.json({ data: await photoConsentService.getState(playerId) })
  }),
)

// POST /v1/players/:playerId/card-photo/consent
router.post(
  '/consent',
  asyncHandler(async (req, res) => {
    const { playerId } = req.params as { playerId: string }
    return res.json({ data: await photoConsentService.grant(playerId) })
  }),
)

// DELETE /v1/players/:playerId/card-photo/consent
// Withdrawal destroys what was generated under the consent, in storage as well
// as in the database — the images exist only because the consent did (rule 37).
router.delete(
  '/consent',
  asyncHandler(async (req, res) => {
    const { playerId } = req.params as { playerId: string }
    const result = await photoConsentService.withdraw(playerId)
    return res.json({ data: result.state })
  }),
)

// DELETE /v1/players/:playerId/card-photo
// Delete generated photos but keep consent. "I dislike this portrait" is a
// different request from "stop processing my face".
router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const { playerId } = req.params as { playerId: string }
    await photoConsentService.deleteGeneratedPhotos(playerId)
    return res.json({ data: { deleted: true } })
  }),
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

    // Consent must be current, not merely once given: a consent under an older
    // policy version is an agreement to different terms (rule 35).
    const consent = await photoConsentService.getState(playerId)
    if (!consent.current) {
      return res.status(403).json({
        error: { code: ErrorCode.CONSENT_REQUIRED, message: 'Current photo consent required', statusCode: 403 },
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
  }),
)

// GET /v1/players/:playerId/card-photo/status
router.get(
  '/status',
  asyncHandler(async (req, res) => {
    const { playerId } = req.params as { playerId: string }
    const status = await cardGenerationService.getStatus(playerId)
    return res.json({ data: status })
  }),
)

export default router
