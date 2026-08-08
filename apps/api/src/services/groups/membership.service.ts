import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../db'
import { groupMemberships } from '../../db/schema'

async function endMembership(groupId: string, userId: string): Promise<boolean> {
  const ended = await db
    .update(groupMemberships)
    .set({ deletedAt: new Date() })
    .where(and(
      eq(groupMemberships.groupId, groupId),
      eq(groupMemberships.userId, userId),
      isNull(groupMemberships.deletedAt),
    ))
    .returning({ id: groupMemberships.id })

  return ended.length > 0
}

export const membershipService = { endMembership }
