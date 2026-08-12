import { notificationService } from '../services/notifications/notification.service'
import { notificationOutboxService } from '../services/notifications/outbox.service'
import { logger } from '../lib/logger'

/** How many to attempt per tick. Enough to clear a burst, small enough to stay responsive. */
const BATCH_SIZE = 50

/**
 * Deliver what is waiting in the outbox.
 *
 * Each row is settled independently: one bad payload must not stop the rest of
 * the batch, which is the failure mode of draining a queue in a single
 * transaction.
 *
 * Safe to run concurrently — claiming uses `FOR UPDATE SKIP LOCKED`, so two
 * workers take different rows rather than blocking or double-sending.
 */
export async function runNotificationOutboxJob(now?: Date): Promise<{
  sent: number
  failed: number
}> {
  const claimed = await notificationOutboxService.claim(BATCH_SIZE, now)
  let sent = 0
  let failed = 0

  for (const row of claimed) {
    try {
      await notificationService.deliver(row.payload)
      await notificationOutboxService.markSent(row.id)
      sent += 1
    } catch (err) {
      failed += 1
      const message = err instanceof Error ? err.message : String(err)
      await notificationOutboxService.markFailed(row.id, row.attempts, message)

      if (row.attempts >= notificationOutboxService.MAX_ATTEMPTS) {
        // Loud on the last attempt: a dead-lettered notification is somebody
        // not being told something, and it should not be discovered by accident.
        logger.error(
          { id: row.id, type: row.type, attempts: row.attempts, err: message },
          'notification dead-lettered after exhausting retries',
        )
      }
    }
  }

  if (sent > 0 || failed > 0) logger.info({ sent, failed }, 'notification outbox drained')
  return { sent, failed }
}
