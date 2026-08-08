import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm'
import {
  BEHAVIOUR_NEGATIVE_WEIGHTS,
  BEHAVIOUR_POSITIVE_WEIGHTS,
  FAIR_PLAY_CREDIT_PER_WEIGHT,
  FAIR_PLAY_PENALTY_PER_WEIGHT,
  FAIR_PLAY_POSITIVE_CAP,
  FAIR_PLAY_START,
  RELIABILITY_FREE_EXCUSES,
  RELIABILITY_WEIGHTS,
  RELIABLE_CHECK_MIN_MATCHES,
  RELIABLE_CHECK_MIN_SCORE,
  TRUST_MIN_SAMPLE,
  TRUST_RECENCY_HALF_LIFE,
  TRUST_WINDOW_MATCHES,
} from '@fivematch/types'
import { db } from '../../db'
import { behaviourReports, matchAttendances, matches } from '../../db/schema'

/**
 * Reliability and fair play (ADR-019).
 *
 * This module must never be imported by an OVR path. OVR measures football
 * ability; these measure whether someone turns up and how they behave. Keeping
 * them apart is a product rule, not a layering preference — see
 * `trust-signal-isolation.test.ts`, which fails if the boundary is crossed.
 */

export type AttendanceOutcome = 'attended' | 'excused' | 'late_cancel' | 'no_show'

export type OutcomeRecord = {
  outcome: AttendanceOutcome
  arrivedLate: boolean
}

export type BehaviourRecord = {
  category: keyof typeof BEHAVIOUR_NEGATIVE_WEIGHTS | keyof typeof BEHAVIOUR_POSITIVE_WEIGHTS
  /** Index into the same ordered window used by reliability. */
  matchIndex: number
}

export type TrustProjection = {
  reliability: number | null
  fairPlay: number | null
  sampleCount: number
  isReliable: boolean
}

/** Most recent record carries full weight; each half-life halves it. */
export function recencyWeight(index: number): number {
  return Math.pow(0.5, index / TRUST_RECENCY_HALF_LIFE)
}

/**
 * Reliability from an ordered window, most recent first.
 *
 * Pure and total. `records` is already truncated to the window by the caller, so
 * this never reads a clock or a database and always answers the same way for the
 * same input.
 */
export function computeReliability(records: OutcomeRecord[]): number | null {
  if (records.length < TRUST_MIN_SAMPLE) return null

  let excusesUsed = 0
  let weightedTotal = 0
  let weightSum = 0

  records.forEach((record, index) => {
    const decay = recencyWeight(index)
    let value: number

    switch (record.outcome) {
      case 'attended':
        value = record.arrivedLate ? RELIABILITY_WEIGHTS.attendedLate : RELIABILITY_WEIGHTS.attended
        break
      case 'excused':
        // The first two cancellations in the window are free. Counted most-recent
        // first, so the allowance is spent on what happened lately.
        excusesUsed += 1
        value = excusesUsed <= RELIABILITY_FREE_EXCUSES
          ? RELIABILITY_WEIGHTS.attended
          : RELIABILITY_WEIGHTS.excused
        break
      case 'late_cancel':
        value = RELIABILITY_WEIGHTS.lateCancel
        break
      case 'no_show':
        value = RELIABILITY_WEIGHTS.noShow
        break
    }

    weightedTotal += value * decay
    weightSum += decay
  })

  if (weightSum === 0) return null
  return Math.round((weightedTotal / weightSum) * 100)
}

/**
 * Fair play from finalized reports inside the same window. Starts at 100 and
 * moves only on evidence somebody validated or enough peers corroborated.
 */
export function computeFairPlay(reports: BehaviourRecord[], sampleCount: number): number | null {
  if (sampleCount < TRUST_MIN_SAMPLE) return null

  let penalty = 0
  let credit = 0

  for (const report of reports) {
    const decay = recencyWeight(report.matchIndex)

    if (report.category in BEHAVIOUR_NEGATIVE_WEIGHTS) {
      const weight = BEHAVIOUR_NEGATIVE_WEIGHTS[report.category as keyof typeof BEHAVIOUR_NEGATIVE_WEIGHTS]
      penalty += weight * FAIR_PLAY_PENALTY_PER_WEIGHT * decay
    } else {
      const weight = BEHAVIOUR_POSITIVE_WEIGHTS[report.category as keyof typeof BEHAVIOUR_POSITIVE_WEIGHTS]
      credit += weight * FAIR_PLAY_CREDIT_PER_WEIGHT * decay
    }
  }

  const score = FAIR_PLAY_START - penalty + Math.min(credit, FAIR_PLAY_POSITIVE_CAP)
  return Math.round(Math.max(0, Math.min(100, score)))
}

/**
 * Whether the public check mark is earned. Deliberately one-directional: there
 * is no failing counterpart, and absence means "not yet", never "unreliable".
 */
export function earnsReliableCheck(reliability: number | null, sampleCount: number): boolean {
  if (reliability === null) return false
  return sampleCount >= RELIABLE_CHECK_MIN_MATCHES && reliability >= RELIABLE_CHECK_MIN_SCORE
}

/** The player's most recent finalized attendance records, newest first. */
async function loadWindow(playerId: string) {
  return db
    .select({
      matchId: matchAttendances.matchId,
      outcome: matchAttendances.outcome,
      arrivedLate: matchAttendances.arrivedLate,
    })
    .from(matchAttendances)
    .innerJoin(matches, eq(matches.id, matchAttendances.matchId))
    .where(and(
      eq(matchAttendances.playerId, playerId),
      isNotNull(matchAttendances.finalizedAt),
      // Rows finalized without an outcome were never on the hook — a waitlist
      // seat that never came up is not evidence of anything.
      isNotNull(matchAttendances.outcome),
    ))
    .orderBy(desc(matches.scheduledAt))
    .limit(TRUST_WINDOW_MATCHES)
}

async function getProjection(playerId: string): Promise<TrustProjection> {
  const window = await loadWindow(playerId)

  const records: OutcomeRecord[] = window.map((row) => ({
    outcome: row.outcome as AttendanceOutcome,
    arrivedLate: row.arrivedLate,
  }))

  const reliability = computeReliability(records)
  const sampleCount = records.length

  const matchIndexById = new Map(window.map((row, index) => [row.matchId, index]))
  const matchIds = [...matchIndexById.keys()]

  const finalizedReports = matchIds.length === 0
    ? []
    : await db
      .select({
        matchId: behaviourReports.matchId,
        category: behaviourReports.category,
      })
      .from(behaviourReports)
      .where(and(
        eq(behaviourReports.subjectPlayerId, playerId),
        // Only finalized evidence. Pending, dismissed and expired count for
        // nothing — an unresolved accusation must never move a score.
        eq(behaviourReports.status, 'finalized'),
        inArray(behaviourReports.matchId, matchIds),
      ))

  const reports: BehaviourRecord[] = finalizedReports.map((row) => ({
    category: row.category as BehaviourRecord['category'],
    matchIndex: matchIndexById.get(row.matchId) ?? 0,
  }))

  return {
    reliability,
    fairPlay: computeFairPlay(reports, sampleCount),
    sampleCount,
    isReliable: earnsReliableCheck(reliability, sampleCount),
  }
}

/**
 * What a stranger may see. No score, no band, no fair play — a match count and
 * a mark you either earned or have not earned yet (ADR-019).
 */
export function toPublicTrust(projection: TrustProjection): { isReliable: boolean } {
  return { isReliable: projection.isReliable }
}

/**
 * Check marks for a whole participant sheet in one query.
 *
 * Fair play is deliberately not computed here — nothing public consumes it, so
 * fetching it would be gathering sensitive data for no purpose. Windows are
 * sliced per player in memory rather than with a correlated per-player query,
 * which keeps a ten-player sheet at one round trip instead of twenty.
 */
async function getReliableFlags(playerIds: string[]): Promise<Map<string, boolean>> {
  const flags = new Map(playerIds.map((id) => [id, false]))
  if (playerIds.length === 0) return flags

  const rows = await db
    .select({
      playerId: matchAttendances.playerId,
      outcome: matchAttendances.outcome,
      arrivedLate: matchAttendances.arrivedLate,
    })
    .from(matchAttendances)
    .innerJoin(matches, eq(matches.id, matchAttendances.matchId))
    .where(and(
      inArray(matchAttendances.playerId, playerIds),
      isNotNull(matchAttendances.finalizedAt),
      isNotNull(matchAttendances.outcome),
    ))
    .orderBy(desc(matches.scheduledAt))

  const byPlayer = new Map<string, OutcomeRecord[]>()
  for (const row of rows) {
    if (!row.playerId) continue
    const window = byPlayer.get(row.playerId) ?? []
    if (window.length >= TRUST_WINDOW_MATCHES) continue
    window.push({ outcome: row.outcome as AttendanceOutcome, arrivedLate: row.arrivedLate })
    byPlayer.set(row.playerId, window)
  }

  for (const [playerId, window] of byPlayer) {
    flags.set(playerId, earnsReliableCheck(computeReliability(window), window.length))
  }

  return flags
}

export const trustProjectionService = {
  getProjection,
  computeReliability,
  computeFairPlay,
  earnsReliableCheck,
  recencyWeight,
  toPublicTrust,
  getReliableFlags,
}
