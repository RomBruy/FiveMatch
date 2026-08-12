import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type { NotificationPayload } from '@fivematch/types'
import { db, type Db } from '../../db'
import { notificationOutbox } from '../../db/schema'

type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * The outbox: enqueue, claim, settle.
 *
 * Delivery itself lives in the notification service; this is only about making
 * sure an intention to notify survives a failure.
 */

/** Retry budget. Beyond this a row is dead-lettered rather than retried forever. */
export const MAX_ATTEMPTS = 6

/**
 * Exponential backoff, capped.
 *
 * Roughly 30s, 1m, 2m, 4m, 8m, 15m. Long enough that a provider outage is not
 * hammered, short enough that "your match is in an hour" still arrives while it
 * is true. Capped because a notification delayed beyond its own event is worse
 * than one that never comes.
 */
export function backoffMs(attempts: number): number {
  const base = 30_000 * Math.pow(2, Math.max(0, attempts - 1))
  return Math.min(base, 15 * 60_000)
}

/**
 * Build a stable idempotency key.
 *
 * Same event, same recipients, same key — so a retried request or a job that
 * runs twice cannot notify someone twice about one thing. Recipients are sorted
 * because the order they arrive in is incidental.
 */
export function defaultDedupeKey(payload: NotificationPayload): string {
  const parts: string[] = [payload.type]

  for (const field of ['matchId', 'groupId', 'playerId'] as const) {
    if (field in payload) parts.push(`${field}:${String((payload as Record<string, unknown>)[field])}`)
  }
  if ('recipientUserId' in payload) parts.push(`to:${payload.recipientUserId}`)
  if ('recipientUserIds' in payload) parts.push(`to:${[...payload.recipientUserIds].sort().join(',')}`)

  return parts.join('|')
}

/**
 * Put a notification in the outbox.
 *
 * Accepts a transaction so the intention to notify can be written in the same
 * transaction as the change that caused it — the point of an outbox. A
 * notification for a rolled-back change is never sent, and a committed change
 * always leaves its notification behind.
 */
async function enqueue(
  payload: NotificationPayload,
  options: { dedupeKey?: string | null; tx?: Transaction } = {},
): Promise<{ enqueued: boolean }> {
  const executor = options.tx ?? db
  const dedupeKey = options.dedupeKey === null ? null : options.dedupeKey ?? defaultDedupeKey(payload)

  const inserted = await executor
    .insert(notificationOutbox)
    .values({ type: payload.type, payload, dedupeKey })
    // A duplicate is a success from the caller's point of view: the thing they
    // wanted announced is already queued or already sent.
    .onConflictDoNothing({ target: notificationOutbox.dedupeKey })
    .returning({ id: notificationOutbox.id })

  return { enqueued: inserted.length > 0 }
}

/**
 * Take up to `limit` rows that are due.
 *
 * `FOR UPDATE SKIP LOCKED` is what makes more than one worker safe: each claims
 * different rows instead of blocking on, or duplicating, the same ones. Without
 * it a second worker either stalls behind the first or sends everything twice.
 */
async function claim(limit: number, now?: Date) {
  // Default to the database's own clock rather than the application's.
  // `next_attempt_at` is written with microsecond precision by `now()`, while a
  // JavaScript Date truncates to milliseconds — so a row enqueued and claimed
  // inside the same millisecond can look "not yet due" and be skipped for a
  // whole tick. Comparing the database against itself removes that, and any
  // future clock skew between the app and the database with it.
  const dueAt = now ? sql`${now}` : sql`now()`

  return db.transaction(async (tx) => {
    const due = await tx
      .select({ id: notificationOutbox.id })
      .from(notificationOutbox)
      .where(and(
        eq(notificationOutbox.status, 'pending'),
        sql`${notificationOutbox.nextAttemptAt} <= ${dueAt}`,
      ))
      .orderBy(asc(notificationOutbox.nextAttemptAt))
      .limit(limit)
      .for('update', { skipLocked: true })

    if (due.length === 0) return []

    // Claiming increments attempts immediately, so a worker that dies mid-send
    // cannot leave a row to be retried forever at zero cost.
    const ids = due.map((row) => row.id)
    return tx
      .update(notificationOutbox)
      .set({ attempts: sql`${notificationOutbox.attempts} + 1` })
      .where(inArray(notificationOutbox.id, ids))
      .returning()
  })
}

async function markSent(id: string): Promise<void> {
  await db
    .update(notificationOutbox)
    .set({ status: 'sent', sentAt: new Date(), lastError: null })
    .where(eq(notificationOutbox.id, id))
}

/**
 * Record a failure: schedule a retry, or give up.
 *
 * Giving up is deliberate and visible. A row that retries forever hides a
 * permanent problem — a revoked push token, a payload the provider rejects —
 * behind an ever-growing queue.
 */
async function markFailed(id: string, attempts: number, error: string): Promise<void> {
  const exhausted = attempts >= MAX_ATTEMPTS

  await db
    .update(notificationOutbox)
    .set({
      status: exhausted ? 'dead' : 'pending',
      nextAttemptAt: new Date(Date.now() + backoffMs(attempts)),
      lastError: error.slice(0, 1000),
    })
    .where(eq(notificationOutbox.id, id))
}

export const notificationOutboxService = {
  enqueue,
  claim,
  markSent,
  markFailed,
  backoffMs,
  defaultDedupeKey,
  MAX_ATTEMPTS,
}
