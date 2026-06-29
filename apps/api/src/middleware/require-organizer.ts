import { Request, Response, NextFunction } from 'express'
import { ErrorCode } from '@fivematch/types'

// Requires requireGroupMember to have run first — it populates req.user.groupRole.
export function requireOrganizer(req: Request, res: Response, next: NextFunction): void {
  if (req.user.groupRole !== 'organizer') {
    res.status(403).json({
      error: { code: ErrorCode.ORGANIZER_ONLY, message: 'Organizer access required', statusCode: 403 },
    })
    return
  }
  next()
}
