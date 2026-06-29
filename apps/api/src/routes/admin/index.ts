import { Router } from 'express'
import { count, countDistinct, isNull, isNotNull, and, eq, gte } from 'drizzle-orm'
import { asyncHandler } from '../../middleware/async-handler'
import { requireAdmin } from '../../middleware/require-admin'
import { db } from '../../db'
import { groups, users, matches, ratings, cardPhotoJobs } from '../../db/schema'

const router = Router()

router.get('/metrics', requireAdmin, asyncHandler(async (_req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [
    [totalGroupsRow],
    [totalActiveUsersRow],
    [totalDeletedUsersRow],
    [totalMatchesRow],
    matchStatusRows,
    [activeGroupsRow],
    [totalRatingsRow],
    [totalPhotoJobsRow],
    photoJobStateRows,
  ] = await Promise.all([
    db.select({ total: count() }).from(groups),
    db.select({ total: count() }).from(users).where(
      and(isNull(users.deletedAt), isNull(users.purgedAt))
    ),
    db.select({ total: count() }).from(users).where(isNotNull(users.deletedAt)),
    db.select({ total: count() }).from(matches),
    db.select({ status: matches.status, total: count() }).from(matches).groupBy(matches.status),
    db.select({ total: countDistinct(matches.groupId) }).from(matches).where(
      and(eq(matches.status, 'completed'), gte(matches.completedAt, thirtyDaysAgo))
    ),
    db.select({ total: count() }).from(ratings),
    db.select({ total: count() }).from(cardPhotoJobs),
    db.select({ state: cardPhotoJobs.state, total: count() }).from(cardPhotoJobs).groupBy(cardPhotoJobs.state),
  ])

  const byStatus = Object.fromEntries(matchStatusRows.map((r) => [r.status, Number(r.total)]))
  const matchesByStatus = {
    planning: (byStatus['planning'] ?? 0) + (byStatus['attendance_open'] ?? 0),
    attendanceLocked: (byStatus['attendance_locked'] ?? 0) + (byStatus['teams_generated'] ?? 0),
    inProgress: byStatus['in_progress'] ?? 0,
    completed: byStatus['completed'] ?? 0,
    cancelled: byStatus['cancelled'] ?? 0,
  }

  const byState = Object.fromEntries(photoJobStateRows.map((r) => [r.state, Number(r.total)]))
  const cardPhotoJobsByState = {
    idle: byState['idle'] ?? 0,
    pending: byState['pending'] ?? 0,
    processing: byState['processing'] ?? 0,
    complete: byState['complete'] ?? 0,
    failed: byState['failed'] ?? 0,
  }

  res.json({
    data: {
      totalGroups: Number(totalGroupsRow!.total),
      totalActiveUsers: Number(totalActiveUsersRow!.total),
      totalDeletedUsers: Number(totalDeletedUsersRow!.total),
      totalMatches: Number(totalMatchesRow!.total),
      matchesByStatus,
      activeGroupsLast30Days: Number(activeGroupsRow!.total),
      totalRatingsSubmitted: Number(totalRatingsRow!.total),
      totalCardPhotoJobs: Number(totalPhotoJobsRow!.total),
      cardPhotoJobsByState,
    },
  })
}))

export default router
