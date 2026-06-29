import { Router } from 'express'
import express from 'express'
import { Webhook } from 'svix'
import { ErrorCode } from '@fivematch/types'
import { logger } from '../lib/logger'
import { asyncHandler } from '../middleware/async-handler'
import { gdprService } from '../services/gdpr/gdpr.service'

const webhooksRouter = Router()

// Raw body parser — must run before express.json() processes this route.
// svix signature verification requires the exact raw request body bytes.
webhooksRouter.post(
  '/clerk',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
    if (!webhookSecret) {
      logger.error('CLERK_WEBHOOK_SECRET is not set — cannot verify webhook')
      return res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Webhook secret not configured', statusCode: 500 },
      })
    }

    const svixId = req.headers['svix-id'] as string | undefined
    const svixTimestamp = req.headers['svix-timestamp'] as string | undefined
    const svixSignature = req.headers['svix-signature'] as string | undefined

    if (!svixId || !svixTimestamp || !svixSignature) {
      return res.status(401).json({
        error: { code: ErrorCode.INVALID_SIGNATURE, message: 'Missing svix headers', statusCode: 401 },
      })
    }

    if (!(req.body instanceof Buffer)) {
      logger.error('Webhook body is not a Buffer — express.raw() middleware may have been bypassed')
      return res.status(400).json({
        error: { code: 'INVALID_BODY', message: 'Raw body required for webhook verification', statusCode: 400 },
      })
    }
    const body = req.body.toString('utf8')

    let event: { type: string; data: Record<string, unknown> }
    try {
      const wh = new Webhook(webhookSecret)
      event = wh.verify(body, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as typeof event
    } catch {
      return res.status(401).json({
        error: { code: ErrorCode.INVALID_SIGNATURE, message: 'Invalid webhook signature', statusCode: 401 },
      })
    }

    if (event.type === 'user.deleted') {
      const clerkUserId = event.data['id'] as string | undefined
      if (clerkUserId) {
        await gdprService.softDeleteUser(clerkUserId)
        logger.info({ clerkUserId }, 'User soft-deleted via Clerk webhook')
      }
    }

    return res.status(200).json({ received: true })
  }),
)

export default webhooksRouter
