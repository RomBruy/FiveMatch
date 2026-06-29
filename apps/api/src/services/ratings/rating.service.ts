import { eq, and, isNull } from 'drizzle-orm'
import { db } from '../../db'
import { matches } from '../../db/schema'
import type { TestClock } from '../../tests/integration/gdpr-anonymize.integration.test'
import { ovrService } from '../players/ovr.service'

const RATING_WINDOW_MS = 48 * 60 * 60 * 1000 // 48 hours in milliseconds

class RatingService {
  private clock: TestClock

  constructor(clock?: TestClock) {
    this.clock = clock ?? { now: () => new Date(), advance: () => {} }
  }

  isWindowOpen(match: { completedAt: Date | null }): boolean {
    if (!match.completedAt) return false
    const deadline = new Date(match.completedAt.getTime() + RATING_WINDOW_MS)
    return this.clock.now() < deadline
  }

  async closeWindow(matchId: string): Promise<void> {
    // Set ratingWindowClosedAt exactly once — idempotent via WHERE IS NULL guard
    const result = await db
      .update(matches)
      .set({ ratingWindowClosedAt: this.clock.now(), updatedAt: this.clock.now() })
      .where(and(eq(matches.id, matchId), isNull(matches.ratingWindowClosedAt)))
      .returning({ id: matches.id })

    // Only trigger OVR pipeline if this call actually closed the window (not a duplicate)
    if (result.length > 0) {
      await ovrService.runPostMatchUpdate(matchId)
    }
  }
}

export const ratingService = new RatingService()
export { RatingService }
