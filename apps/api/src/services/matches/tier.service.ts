import { eq, and, inArray } from 'drizzle-orm'
import { GROUP_TIER_THRESHOLDS } from '@fivematch/types/algorithm-constants'
import { db } from '../../db'
import { ACTIVE_CREW_ROLES, groups, groupMemberships } from '../../db/schema'
import { notificationService } from '../notifications/notification.service'

type GroupTier = 'amateur' | 'club' | 'semiPro' | 'elite'

function computeTierFromMatchCount(matchCount: number): GroupTier {
  if (matchCount >= GROUP_TIER_THRESHOLDS.elite) return 'elite'
  if (matchCount >= GROUP_TIER_THRESHOLDS.semiPro) return 'semiPro'
  if (matchCount >= GROUP_TIER_THRESHOLDS.club) return 'club'
  return 'amateur'
}

async function evaluateTier(
  groupId: string,
  newMatchCount: number,
): Promise<{ previousTier: GroupTier; newTier: GroupTier; changed: boolean }> {
  const [group] = await db
    .select({ tier: groups.tier, name: groups.name })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1)

  const previousTier = (group?.tier ?? 'amateur') as GroupTier
  const newTier = computeTierFromMatchCount(newMatchCount)

  if (newTier !== previousTier) {
    await db.update(groups).set({ tier: newTier, updatedAt: new Date() }).where(eq(groups.id, groupId))

    const memberRows = await db
      .select({ userId: groupMemberships.userId })
      .from(groupMemberships)
      .where(
        and(
          eq(groupMemberships.groupId, groupId),
          inArray(groupMemberships.role, [...ACTIVE_CREW_ROLES]),
        ),
      )

    const recipientUserIds = memberRows.map((r: { userId: string }) => r.userId)

    notificationService.send({
      type: 'GROUP_TIER_CHANGED',
      groupId,
      groupName: group?.name ?? '',
      newTier,
      previousTier,
      recipientUserIds,
    })
  }

  return { previousTier, newTier, changed: newTier !== previousTier }
}

export const tierService = { evaluateTier }
