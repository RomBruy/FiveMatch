import { pgTable, uuid, text, integer, timestamp, jsonb, pgEnum, index } from 'drizzle-orm/pg-core'
import type { NotificationPayload } from '@fivematch/types'

/**
 * `pending` — waiting for its turn, or waiting out a backoff.
 * `sent`    — handed to Expo successfully.
 * `dead`    — gave up after the retry budget. Kept, never deleted: a
 *             notification nobody received is exactly what you want to find
 *             when someone asks why they were not told.
 */
export const notificationOutboxStatusEnum = pgEnum('notification_outbox_status', [
  'pending',
  'sent',
  'dead',
])

/**
 * Durable notifications.
 *
 * Sending used to be `void dispatch(payload).catch(log)` — fire and forget. A
 * transient Expo failure, a network blip or a restart mid-flight lost the
 * notification permanently, with nothing left behind to say it had happened.
 * Nobody would ever know a waitlist promotion went unannounced.
 *
 * Writing a row is far more reliable than an HTTP call to a third party, so the
 * write happens first and delivery is somebody else's problem — a worker that
 * can retry, back off and eventually give up loudly.
 */
export const notificationOutbox = pgTable('notification_outbox', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: text('type').notNull(),
  /** The full payload, so delivery needs nothing else to reconstruct it. */
  payload: jsonb('payload').$type<NotificationPayload>().notNull(),
  /**
   * Optional idempotency key. Enqueueing the same event twice — a retried
   * request, a job that ran again — collides here and is dropped rather than
   * notifying someone twice about one thing.
   */
  dedupeKey: text('dedupe_key').unique(),
  status: notificationOutboxStatusEnum('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  /** When this row becomes eligible again. Drives the backoff. */
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }).defaultNow().notNull(),
  /** Kept for the dead-letter case: "it failed" is not a diagnosis. */
  lastError: text('last_error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
}, (table) => ({
  // The drain query: pending rows whose time has come, oldest first.
  claimIdx: index('notification_outbox_claim_idx').on(table.status, table.nextAttemptAt),
}))

export type NotificationOutboxRow = typeof notificationOutbox.$inferSelect
export type NewNotificationOutboxRow = typeof notificationOutbox.$inferInsert
