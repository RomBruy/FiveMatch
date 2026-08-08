import { and, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm'
import { CARD_AUTO_FINALIZE_HOURS } from '@fivematch/types'
import { db } from '../db'
import { matchAttendances, matches } from '../db/schema'
import { attendanceFinalizationService } from '../services/matches/attendance-finalization.service'
import { logger } from '../lib/logger'

/**
 * Settle completed matches whose host never confirmed the sheet (ADR-029).
 *
 * Card eligibility needs a finalized `attended` outcome, so without this a
 * player's progress toward their card would depend on someone else's admin.
 * The sweep derives outcomes from the same stored facts a host would have
 * confirmed — it decides nothing a manual pass would not have.
 *
 * A host who finalizes late finds nothing left to settle: finalization only
 * touches rows that are still unsettled, so the two paths cannot disagree.
 */
export async function runAttendanceAutoFinalizeJob(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - CARD_AUTO_FINALIZE_HOURS * 60 * 60 * 1000)

  const due = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(
      eq(matches.status, 'completed'),
      isNotNull(matches.scoreA),
      isNotNull(matches.scoreB),
      isNull(matches.voidedAt),
      lt(matches.completedAt, cutoff),
      // Only matches with something left to settle, so the sweep does not walk
      // the entire history of completed fixtures on every run.
      sql`EXISTS (
        SELECT 1 FROM ${matchAttendances}
        WHERE ${matchAttendances.matchId} = ${matches.id}
          AND ${matchAttendances.finalizedAt} IS NULL
      )`,
    ))
    .limit(200)

  let settled = 0
  for (const match of due) {
    try {
      await attendanceFinalizationService.finalizeMatch(match.id, null)
      settled += 1
    } catch (err) {
      // One bad match must not stop the sweep; the next run retries it.
      logger.error({ err, matchId: match.id }, 'auto-finalize failed for match')
    }
  }

  if (settled > 0) logger.info({ settled }, 'attendance auto-finalized')
  return settled
}
