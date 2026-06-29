import { db } from '../../db'
import { cardPhotoJobs, players } from '../../db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { ErrorCode } from '@fivematch/types'

export type CardPhotoStatus = {
  state: 'idle' | 'pending' | 'processing' | 'complete' | 'failed'
  photoUrl: string | null
  generationsUsed: number
  generationsAllowed: number
  resetsAt: string
}

function currentMonth(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

function nextMonthResetDate(): string {
  const now = new Date()
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return nextMonth.toISOString().slice(0, 10)
}

async function countGenerationsThisMonth(playerId: string): Promise<number> {
  // Timeout-failed jobs do NOT count against the monthly limit
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(cardPhotoJobs)
    .where(
      and(
        eq(cardPhotoJobs.playerId, playerId),
        eq(cardPhotoJobs.generationMonth, currentMonth()),
        sql`NOT (${cardPhotoJobs.state} = 'failed' AND ${cardPhotoJobs.errorMessage} = 'PROCESSING_TIMEOUT')`
      )
    )
  return Number(rows[0]?.count ?? 0)
}

export const cardGenerationService = {
  async checkConsent(playerId: string): Promise<boolean> {
    const rows = await db
      .select({ photoConsentGiven: players.photoConsentGiven })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1)
    return rows[0]?.photoConsentGiven ?? false
  },

  async grantConsent(playerId: string): Promise<void> {
    await db
      .update(players)
      .set({ photoConsentGiven: true })
      .where(eq(players.id, playerId))
  },

  async createGenerationJob(
    playerId: string,
    groupId: string,
    idempotencyKey: string
  ): Promise<{ jobId: string; state: string } | { error: string; statusCode: number; meta?: Record<string, unknown> }> {
    // Idempotency check
    const existing = await db
      .select({ id: cardPhotoJobs.id, state: cardPhotoJobs.state })
      .from(cardPhotoJobs)
      .where(eq(cardPhotoJobs.idempotencyKey, idempotencyKey))
      .limit(1)
    if (existing.length > 0) {
      return { jobId: existing[0].id, state: existing[0].state }
    }

    // Rate-limit check and insert wrapped in a transaction to reduce the concurrent-request race window
    return db.transaction(async (tx) => {
      const limitRows = await tx
        .select({ count: sql<number>`count(*)` })
        .from(cardPhotoJobs)
        .where(
          and(
            eq(cardPhotoJobs.playerId, playerId),
            eq(cardPhotoJobs.generationMonth, currentMonth()),
            sql`NOT (${cardPhotoJobs.state} = 'failed' AND ${cardPhotoJobs.errorMessage} = 'PROCESSING_TIMEOUT')`
          )
        )
      const used = Number(limitRows[0]?.count ?? 0)
      if (used >= 3) {
        return {
          error: ErrorCode.GENERATION_RATE_LIMITED,
          statusCode: 429,
          meta: { generationsUsed: used, resetsAt: nextMonthResetDate() },
        }
      }

      const [job] = await tx
        .insert(cardPhotoJobs)
        .values({
          playerId,
          groupId,
          state: 'pending',
          idempotencyKey,
          generationMonth: currentMonth(),
        })
        .returning({ id: cardPhotoJobs.id, state: cardPhotoJobs.state })

      return { jobId: job.id, state: job.state }
    })
  },

  async getStatus(playerId: string): Promise<CardPhotoStatus> {
    const used = await countGenerationsThisMonth(playerId)

    const rows = await db
      .select({
        state: cardPhotoJobs.state,
        photoUrl: cardPhotoJobs.photoUrl,
      })
      .from(cardPhotoJobs)
      .where(eq(cardPhotoJobs.playerId, playerId))
      .orderBy(sql`${cardPhotoJobs.createdAt} DESC`)
      .limit(1)

    const latest = rows[0]

    return {
      state: latest?.state ?? 'idle',
      photoUrl: latest?.photoUrl ?? null,
      generationsUsed: used,
      generationsAllowed: 3,
      resetsAt: nextMonthResetDate(),
    }
  },
}
