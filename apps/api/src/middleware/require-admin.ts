import { Request, Response, NextFunction } from 'express'
import { ErrorCode } from '@fivematch/types'

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminIds = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)

  if (adminIds.length === 0 || !adminIds.includes(req.user.userId)) {
    res.status(403).json({
      error: { code: ErrorCode.FORBIDDEN, message: 'Admin access required', statusCode: 403 },
    })
    return
  }
  next()
}
