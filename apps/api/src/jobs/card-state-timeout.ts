import { db } from '../db'
import { cardPhotoJobs } from '../db/schema'
import { eq, and, lt } from 'drizzle-orm'
import * as Sentry from '@sentry/node'

export async function runCardStateTimeoutJob(): Promise<void> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

  const stuckJobs = await db
    .select({ id: cardPhotoJobs.id, playerId: cardPhotoJobs.playerId })
    .from(cardPhotoJobs)
    .where(
      and(
        eq(cardPhotoJobs.state, 'processing'),
        lt(cardPhotoJobs.updatedAt, fiveMinutesAgo)
      )
    )

  for (const job of stuckJobs) {
    await db
      .update(cardPhotoJobs)
      .set({
        state: 'failed',
        errorMessage: 'PROCESSING_TIMEOUT',
        updatedAt: new Date(),
      })
      .where(eq(cardPhotoJobs.id, job.id))

    Sentry.captureMessage('Card photo job timed out', {
      extra: { jobId: job.id, playerId: job.playerId },
    })
  }
}
