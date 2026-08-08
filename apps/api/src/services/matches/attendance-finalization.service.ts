import { and, eq, isNull } from 'drizzle-orm'
import { DEFAULT_CANCELLATION_DEADLINE_HOURS } from '@fivematch/types'
import { db, type Db } from '../../db'
import { groups, matchAttendances, matchParticipants, matches } from '../../db/schema'
import { hasPhase1EligibilityEvidence } from './eligibility.service'

type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0]

export type AttendanceOutcome = 'attended' | 'excused' | 'late_cancel' | 'no_show'

export type OutcomeInput = {
  /** RSVP at the moment of finalization. */
  status: 'in' | 'out' | 'unknown'
  /** Non-null means they were never promoted off the waitlist. */
  waitlistPosition: number | null
  /** When they released a confirmed seat, if they ever held one. */
  cancelledAt: Date | null
  /** Present in the final participant snapshot — the evidence that they played. */
  appeared: boolean
  scheduledAt: Date
  deadlineHours: number
}

/**
 * Decide what happened to one player at one match.
 *
 * Returning `null` is a real answer, not a failure: it means this player was
 * never on the hook, so they carry no reliability consequence either way. Only
 * someone who held a confirmed seat can let anyone down.
 *
 * Pure and total — no clock, no database. The caller supplies `scheduledAt` so
 * the same inputs always produce the same outcome, which is what makes
 * historical re-derivation possible if the deadline is ever retuned.
 */
export function classifyOutcome(input: OutcomeInput): AttendanceOutcome | null {
  const { status, waitlistPosition, cancelledAt, appeared, scheduledAt, deadlineHours } = input

  // Turning up settles it. Someone who cancelled and then came anyway attended;
  // punishing them for the cancellation would teach exactly the wrong lesson.
  if (appeared) return 'attended'

  if (cancelledAt !== null) {
    const deadline = new Date(scheduledAt.getTime() - deadlineHours * 60 * 60 * 1000)
    return cancelledAt.getTime() <= deadline.getTime() ? 'excused' : 'late_cancel'
  }

  // Held a seat, never released it, never showed.
  if (status === 'in' && waitlistPosition === null) return 'no_show'

  // Never claimed a seat, or sat on the waitlist and was never promoted.
  return null
}

/** A crew may set its own deadline; a standalone match has no crew to ask. */
async function resolveDeadlineHours(tx: Transaction, groupId: string | null): Promise<number> {
  if (!groupId) return DEFAULT_CANCELLATION_DEADLINE_HOURS
  const [crew] = await tx
    .select({ hours: groups.cancellationDeadlineHours })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1)
  return crew?.hours ?? DEFAULT_CANCELLATION_DEADLINE_HOURS
}

async function finalizeMatchInTransaction(
  tx: Transaction,
  matchId: string,
  finalizedByPlayerId: string,
): Promise<{ finalized: Array<{ playerId: string; outcome: AttendanceOutcome }> }> {
  const [match] = await tx
    .select({
      groupId: matches.groupId,
      status: matches.status,
      scheduledAt: matches.scheduledAt,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1)

  // Same evidence bar the card ledger uses: no result, no truth about who played.
  if (!match || !hasPhase1EligibilityEvidence(match)) return { finalized: [] }

  const deadlineHours = await resolveDeadlineHours(tx, match.groupId)

  const snapshot = await tx
    .select({ playerId: matchParticipants.playerId })
    .from(matchParticipants)
    .where(eq(matchParticipants.matchId, matchId))
  const appearedIds = new Set(
    snapshot.map((row) => row.playerId).filter((id): id is string => id !== null),
  )

  // Idempotent by construction: already-finalized rows are never re-read, so a
  // replay cannot move an outcome or double-count anything downstream.
  const pending = await tx
    .select({
      id: matchAttendances.id,
      playerId: matchAttendances.playerId,
      status: matchAttendances.status,
      waitlistPosition: matchAttendances.waitlistPosition,
      cancelledAt: matchAttendances.cancelledAt,
    })
    .from(matchAttendances)
    .where(and(eq(matchAttendances.matchId, matchId), isNull(matchAttendances.finalizedAt)))

  const finalized: Array<{ playerId: string; outcome: AttendanceOutcome }> = []
  const finalizedAt = new Date()

  for (const row of pending) {
    if (!row.playerId) continue

    const outcome = classifyOutcome({
      status: row.status,
      waitlistPosition: row.waitlistPosition,
      cancelledAt: row.cancelledAt,
      appeared: appearedIds.has(row.playerId),
      scheduledAt: match.scheduledAt,
      deadlineHours,
    })

    // Stamp every row, including the inert ones. `finalizedAt` means "this match
    // has been settled for this player", not "this player earned an outcome" —
    // without it a null-outcome row would be reconsidered on every replay.
    await tx
      .update(matchAttendances)
      .set({ outcome, finalizedAt, finalizedBy: finalizedByPlayerId })
      .where(eq(matchAttendances.id, row.id))

    if (outcome) finalized.push({ playerId: row.playerId, outcome })
  }

  return { finalized }
}

async function finalizeMatch(matchId: string, finalizedByPlayerId: string) {
  return db.transaction((tx) => finalizeMatchInTransaction(tx, matchId, finalizedByPlayerId))
}

/**
 * Mark someone as having turned up late. Independent of outcome by design: late
 * is a modifier on `attended`, not a fifth outcome, because the two facts decay
 * at different rates and one of them is far more forgivable.
 */
async function setArrivedLate(matchId: string, playerId: string, arrivedLate: boolean) {
  await db
    .update(matchAttendances)
    .set({ arrivedLate })
    .where(and(eq(matchAttendances.matchId, matchId), eq(matchAttendances.playerId, playerId)))
}

export const attendanceFinalizationService = {
  classifyOutcome,
  finalizeMatch,
  finalizeMatchInTransaction,
  setArrivedLate,
}
