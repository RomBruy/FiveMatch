import { and, eq, isNull } from 'drizzle-orm'
import { db } from '../../db'
import { matches, matchAttendances, matchParticipants, players } from '../../db/schema'
import { notificationService } from '../../services/notifications/notification.service'
import { ratingService } from '../../services/ratings/rating.service'
import { logger } from '../../lib/logger'

/**
 * Lazy post-match nudges, shared by the lifecycle and results routers.
 *
 * Lived between two route definitions in the old 1255-line index, which is
 * how it ended up being read by one router and defined in another. It is a
 * helper, not a route, so it belongs in neither.
 */
/**
 * Fire-and-forget nudges that used to live inline in GET /:matchId. Both are
 * lazily triggered by reads because there is no scheduler: MVP voting reminders
 * at +12h, rating reminders at +24h, and a lazy close of the rating window.
 */
export function sendPostMatchReminders(matchId: string, groupId: string | null): void {
  void (async () => {
    try {
      const [matchRow] = await db
        .select({
          status: matches.status,
          completedAt: matches.completedAt,
          mvpVotingResolvedAt: matches.mvpVotingResolvedAt,
          ratingWindowClosedAt: matches.ratingWindowClosedAt,
        })
        .from(matches)
        .where(eq(matches.id, matchId))

      if (!matchRow || matchRow.status !== 'completed' || !matchRow.completedAt) return
      const elapsed = Date.now() - matchRow.completedAt.getTime()
      const HOURS = 60 * 60 * 1000

      // MVP voting reminder — once per confirmed attendee, in the 12–24h band.
      if (!matchRow.mvpVotingResolvedAt && elapsed >= 12 * HOURS && elapsed < 24 * HOURS) {
        const pending = await db
          .select({ playerId: matchAttendances.playerId, userId: players.userId })
          .from(matchAttendances)
          .innerJoin(players, eq(players.id, matchAttendances.playerId))
          .where(and(
            eq(matchAttendances.matchId, matchId),
            eq(matchAttendances.status, 'in'),
            eq(matchAttendances.mvpReminderSent, false),
            isNull(matchAttendances.waitlistPosition),
          ))

        for (const row of pending) {
          // Mark sent BEFORE dispatching — prevents a double-send under concurrency.
          const updated = await db
            .update(matchAttendances)
            .set({ mvpReminderSent: true })
            .where(and(
              eq(matchAttendances.matchId, matchId),
              eq(matchAttendances.playerId, row.playerId!),
              eq(matchAttendances.mvpReminderSent, false),
            ))
            .returning({ id: matchAttendances.id })

          if (updated.length > 0) {
            notificationService.send({ type: 'MVP_VOTING_REMINDER', matchId, groupId, recipientUserId: row.userId })
          }
        }
      }

      // Rating reminder at +24h, then a lazy close of the window at +48h.
      if (matchRow.ratingWindowClosedAt) return
      const WINDOW_MS = 48 * HOURS

      if (elapsed >= 24 * HOURS && elapsed < WINDOW_MS) {
        const participants = await db
          .select({ playerId: matchParticipants.playerId, userId: matchParticipants.userId })
          .from(matchParticipants)
          .where(eq(matchParticipants.matchId, matchId))

        for (const participant of participants) {
          if (!participant.playerId || !participant.userId) continue

          const updated = await db
            .update(matchAttendances)
            .set({ ratingReminderSent: true })
            .where(and(
              eq(matchAttendances.matchId, matchId),
              eq(matchAttendances.playerId, participant.playerId),
              eq(matchAttendances.ratingReminderSent, false),
            ))
            .returning({ id: matchAttendances.id })

          if (updated.length > 0) {
            notificationService.send({ type: 'RATING_REMINDER', matchId, groupId, recipientUserId: participant.userId })
          }
        }
      }

      if (elapsed >= WINDOW_MS) {
        void ratingService.closeWindow(matchId).catch((err: unknown) => {
          logger.error({ err, matchId }, 'closeWindow failed')
        })
      }
    } catch (err: unknown) {
      logger.error({ err, matchId }, 'post-match reminder check failed')
    }
  })()
}
