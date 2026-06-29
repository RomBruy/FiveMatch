import { Request, Response, NextFunction } from 'express'
import { db } from '../db'
import { groupMemberships, users } from '../db/schema'
import { eq, and, inArray, isNull } from 'drizzle-orm'
import { ErrorCode } from '@fivematch/types'

export function requireGroupMember(req: Request, res: Response, next: NextFunction): void {
  const groupId = req.params['groupId'] as string
  const clerkUserId = req.user.userId

  db
    .select({ internalId: users.id, role: groupMemberships.role })
    .from(groupMemberships)
    .innerJoin(users, eq(users.id, groupMemberships.userId))
    .where(
      and(
        eq(users.clerkUserId, clerkUserId),
        eq(groupMemberships.groupId, groupId),
        inArray(groupMemberships.role, ['member', 'organizer']),
        isNull(groupMemberships.deletedAt),
      ),
    )
    .limit(1)
    .then((rows) => {
      if (rows.length === 0) {
        res.status(403).json({
          error: { code: ErrorCode.NOT_A_MEMBER, message: 'Not a group member', statusCode: 403 },
        })
        return
      }
      req.user.internalId = rows[0].internalId
      req.user.groupRole = rows[0].role as 'organizer' | 'member'
      next()
    })
    .catch(next)
}
