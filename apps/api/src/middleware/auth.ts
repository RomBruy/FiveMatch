import { clerkMiddleware, requireAuth, getAuth } from '@clerk/express'
import { Request, Response, NextFunction } from 'express'
import { ErrorCode } from '@fivematch/types'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: {
        userId: string
        internalId?: string
        /** Global player identity — set by attachPlayer, 1:1 with the user. */
        playerId?: string
        groupRole?: 'organizer' | 'member'
      }
    }
  }
}

export { clerkMiddleware }

export function attachUser(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req)
  if (!auth.userId) {
    res.status(401).json({
      error: { code: ErrorCode.UNAUTHORIZED, message: 'Authentication required', statusCode: 401 },
    })
    return
  }
  req.user = { userId: auth.userId }
  next()
}

export { requireAuth }
