import { and, isNotNull, isNull, lt } from 'drizzle-orm'
import { db } from '../db'
import { users } from '../db/schema'
import { gdprService } from '../services/gdpr/gdpr.service'

// Minimal clock interface — structural typing means this is compatible
// with TestClock exported from gdpr-anonymize.integration.test.ts
export interface PurgeClock {
  now(): Date
}

class SystemClock implements PurgeClock {
  now(): Date {
    return new Date()
  }
}

export class GdprPurgeJob {
  private clock: PurgeClock

  constructor(clock?: PurgeClock) {
    this.clock = clock ?? new SystemClock()
  }

  async run(): Promise<void> {
    const now = this.clock.now()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Find users past the 30-day retention window that haven't been purged yet
    const usersToPurge = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          isNotNull(users.deletedAt),
          lt(users.deletedAt, thirtyDaysAgo),
          isNull(users.purgedAt),
        ),
      )

    for (const user of usersToPurge) {
      await gdprService.purgeUser(user.id, now)
    }
  }
}

export const gdprPurgeJob = new GdprPurgeJob()
