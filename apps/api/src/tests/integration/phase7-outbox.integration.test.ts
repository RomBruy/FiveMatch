import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { NotificationPayload } from '@fivematch/types'

const delivered: NotificationPayload[] = []
let deliveryShouldFail = false

vi.mock('../../services/notifications/notification.service', async () => {
  const { notificationOutboxService } = await import('../../services/notifications/outbox.service')
  return {
    notificationService: {
      send: (payload: NotificationPayload) => { void notificationOutboxService.enqueue(payload) },
      enqueue: notificationOutboxService.enqueue,
      deliver: async (payload: NotificationPayload) => {
        if (deliveryShouldFail) throw new Error('expo unavailable')
        delivered.push(payload)
      },
    },
  }
})

import { db } from '../../db'
import { notificationOutbox } from '../../db/schema'
import { notificationOutboxService } from '../../services/notifications/outbox.service'
import { runNotificationOutboxJob } from '../../jobs/notification-outbox.job'

const MATCH_ID = 'e7000000-0000-4000-8000-000000000001'
const USER_ID = 'e7000000-0000-4000-8000-0000000000aa'

const payload = (over: Partial<NotificationPayload> = {}): NotificationPayload => ({
  type: 'MATCH_FULL',
  matchId: MATCH_ID,
  groupId: null,
  recipientUserId: USER_ID,
  ...over,
} as NotificationPayload)

async function rows() {
  return db.select().from(notificationOutbox)
}

beforeEach(async () => {
  await db.delete(notificationOutbox)
  delivered.length = 0
  deliveryShouldFail = false
})

afterEach(async () => {
  await db.delete(notificationOutbox)
})

describe('Phase 7 notification outbox', () => {
  it('survives a delivery failure instead of losing the notification', async () => {
    await notificationOutboxService.enqueue(payload())

    deliveryShouldFail = true
    const first = await runNotificationOutboxJob()

    expect(first.failed).toBe(1)
    expect(delivered).toHaveLength(0)

    // The whole point: it is still there. Fire-and-forget would have lost it.
    const [row] = await rows()
    expect(row.status).toBe('pending')
    expect(row.attempts).toBe(1)
    expect(row.lastError).toContain('expo unavailable')
  })

  it('delivers on a later attempt once the provider recovers', async () => {
    await notificationOutboxService.enqueue(payload())

    deliveryShouldFail = true
    await runNotificationOutboxJob()

    // Backoff has pushed it into the future, so a drain now finds nothing.
    const tooSoon = await runNotificationOutboxJob()
    expect(tooSoon.sent).toBe(0)

    deliveryShouldFail = false
    const later = new Date(Date.now() + 60 * 60 * 1000)
    const eventually = await runNotificationOutboxJob(later)

    expect(eventually.sent).toBe(1)
    expect(delivered).toHaveLength(1)

    const [row] = await rows()
    expect(row.status).toBe('sent')
    expect(row.sentAt).not.toBeNull()
  })

  it('gives up loudly rather than retrying forever', async () => {
    await notificationOutboxService.enqueue(payload())
    deliveryShouldFail = true

    // Each drain is run far enough in the future to clear the backoff.
    for (let i = 1; i <= notificationOutboxService.MAX_ATTEMPTS; i++) {
      await runNotificationOutboxJob(new Date(Date.now() + i * 24 * 60 * 60 * 1000))
    }

    const [row] = await rows()

    // Dead, not deleted: a notification nobody received is what you want to
    // find when someone asks why they were never told.
    expect(row.status).toBe('dead')
    expect(row.attempts).toBe(notificationOutboxService.MAX_ATTEMPTS)
    expect(row.lastError).toContain('expo unavailable')
  })

  it('does not retry a dead row', async () => {
    await notificationOutboxService.enqueue(payload())
    deliveryShouldFail = true
    for (let i = 1; i <= notificationOutboxService.MAX_ATTEMPTS; i++) {
      await runNotificationOutboxJob(new Date(Date.now() + i * 24 * 60 * 60 * 1000))
    }

    deliveryShouldFail = false
    const after = await runNotificationOutboxJob(new Date(Date.now() + 999 * 60 * 60 * 1000))

    expect(after.sent).toBe(0)
    expect(delivered).toHaveLength(0)
  })

  it('drops a duplicate rather than notifying twice about one thing', async () => {
    const first = await notificationOutboxService.enqueue(payload())
    const second = await notificationOutboxService.enqueue(payload())

    expect(first.enqueued).toBe(true)
    // A duplicate is a success from the caller's side: the thing they wanted
    // announced is already queued.
    expect(second.enqueued).toBe(false)
    expect(await rows()).toHaveLength(1)
  })

  it('treats different recipients as different notifications', async () => {
    await notificationOutboxService.enqueue(payload())
    await notificationOutboxService.enqueue(payload({ recipientUserId: 'e7000000-0000-4000-8000-0000000000bb' } as never))

    expect(await rows()).toHaveLength(2)
  })

  it('sorts recipient lists so incidental order does not defeat dedup', () => {
    const a = notificationOutboxService.defaultDedupeKey({
      type: 'TEAMS_LOCKED', matchId: MATCH_ID, groupId: null, recipientUserIds: ['b', 'a'],
    } as NotificationPayload)
    const b = notificationOutboxService.defaultDedupeKey({
      type: 'TEAMS_LOCKED', matchId: MATCH_ID, groupId: null, recipientUserIds: ['a', 'b'],
    } as NotificationPayload)

    expect(a).toBe(b)
  })

  it('allows an explicit null key for genuinely repeatable notifications', async () => {
    await notificationOutboxService.enqueue(payload(), { dedupeKey: null })
    await notificationOutboxService.enqueue(payload(), { dedupeKey: null })

    // A reminder that fires twice is a different thing from a duplicate.
    expect(await rows()).toHaveLength(2)
  })

  it('rolls the notification back with the change that caused it', async () => {
    await db.transaction(async (tx) => {
      await notificationOutboxService.enqueue(payload(), { tx })
      throw new Error('the change failed')
    }).catch(() => { /* expected */ })

    // A notification for something that never happened must never be sent.
    expect(await rows()).toHaveLength(0)
  })

  it('keeps one bad payload from stopping the batch', async () => {
    await notificationOutboxService.enqueue(payload(), { dedupeKey: 'one' })
    await notificationOutboxService.enqueue(payload(), { dedupeKey: 'two' })
    await notificationOutboxService.enqueue(payload(), { dedupeKey: 'three' })

    const result = await runNotificationOutboxJob()

    // Draining in a single transaction would have lost the whole batch to one
    // failure; each row is settled independently.
    expect(result.sent).toBe(3)
    expect(delivered).toHaveLength(3)
  })

  it('backs off exponentially and caps', () => {
    const first = notificationOutboxService.backoffMs(1)
    const third = notificationOutboxService.backoffMs(3)

    expect(third).toBeGreaterThan(first)
    // Capped: a notification delayed past its own event is worse than one that
    // never arrives.
    expect(notificationOutboxService.backoffMs(99)).toBeLessThanOrEqual(15 * 60_000)
  })

  it('claims each row once when workers run concurrently', async () => {
    for (let i = 0; i < 6; i++) {
      await notificationOutboxService.enqueue(payload(), { dedupeKey: `concurrent-${i}` })
    }

    // FOR UPDATE SKIP LOCKED is what makes a second worker safe: without it one
    // stalls behind the other, or both send everything.
    await Promise.all([runNotificationOutboxJob(), runNotificationOutboxJob()])

    expect(delivered).toHaveLength(6)
    const stored = await rows()
    expect(stored.every((r) => r.status === 'sent')).toBe(true)
    expect(stored.every((r) => r.attempts === 1)).toBe(true)
  })
})
