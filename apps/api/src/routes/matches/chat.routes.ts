import { Router, type Response } from 'express'
import { asyncHandler } from '../../middleware/async-handler'
import { loadMatch, requirePlayer } from '../../middleware/match-context'
import { chatService } from '../../services/matches/chat.service'
import { PostChatMessageSchema, ChatPageQuerySchema } from './schemas'
import { ErrorCode } from '@fivematch/types'

const router = Router()

const errorFor = (code: string, statusCode: number, meta?: unknown) => ({
  error: { code, statusCode, ...(meta ? { meta } : {}) },
})

/**
 * The match thread.
 *
 * Read and write are both restricted to people on the sheet — including anyone
 * who marked themselves out or is on the waitlist. Someone who has just
 * withdrawn is precisely who needs to explain and help find cover, so locking
 * them out the moment they release a seat would punish the behaviour the app
 * wants.
 *
 * No websocket. The client polls while the screen is focused, which needs no new
 * infrastructure and no new dependency, and a five-a-side thread moves at
 * conversation speed rather than trading-floor speed. If it ever needs to be
 * live-live, this shape is what a socket would sit in front of anyway.
 */

/** Domain failures carry their own code + status; anything else is a real bug. */
const handle = (err: unknown, res: Response) => {
  const code = (err as { code?: string }).code
  const statusCode = (err as { statusCode?: number }).statusCode ?? 500
  if (code && code in ErrorCode) return res.status(statusCode).json(errorFor(code, statusCode))
  throw err
}

// GET /v1/matches/:matchId/messages
router.get(
  '/:matchId/messages',
  loadMatch,
  requirePlayer,
  asyncHandler(async (req, res) => {
    try {
      const { before } = ChatPageQuerySchema.parse(req.query)
      const page = await chatService.listMessages(req.match.id, req.user.internalId!, before)
      return res.json({ data: page })
    } catch (err: unknown) {
      return handle(err, res)
    }
  }),
)

// POST /v1/matches/:matchId/messages
router.post(
  '/:matchId/messages',
  loadMatch,
  requirePlayer,
  asyncHandler(async (req, res) => {
    try {
      const { body } = PostChatMessageSchema.parse(req.body)
      const message = await chatService.postMessage(req.match.id, req.user.internalId!, body)
      return res.status(201).json({ data: message })
    } catch (err: unknown) {
      return handle(err, res)
    }
  }),
)

// POST /v1/matches/:matchId/messages/read — move the high-water mark
router.post(
  '/:matchId/messages/read',
  loadMatch,
  requirePlayer,
  asyncHandler(async (req, res) => {
    try {
      await chatService.markReadForUser(req.match.id, req.user.internalId!)
      return res.json({ data: { success: true } })
    } catch (err: unknown) {
      return handle(err, res)
    }
  }),
)

export default router
