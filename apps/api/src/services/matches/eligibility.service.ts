import { and, count, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import type { CardState } from '@fivematch/types'
import { db, type Db } from '../../db'
import {
  matchAttendances,
  matchParticipants,
  matches,
  playerMatchEligibilities,
  players,
} from '../../db/schema'

type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0]

export function hasPhase1EligibilityEvidence(match: {
  status: string
  scoreA: number | null
  scoreB: number | null
}): boolean {
  return match.status === 'completed' && match.scoreA !== null && match.scoreB !== null
}

/** Evidence recorded on a ledger row, so a strengthening never rewrites history. */
export const PHASE4_EVIDENCE_VERSION = 'phase4_finalized_attendance_v1'

/**
 * A match may count toward a card only when it completed with a real result and
 * was not struck from the record (PR-030/031).
 */
export function isCountableMatch(match: {
  status: string
  scoreA: number | null
  scoreB: number | null
  voidedAt: Date | null
}): boolean {
  return hasPhase1EligibilityEvidence(match) && match.voidedAt === null
}

export function cardStateForEligibleCount(eligibleCount: number): CardState {
  if (eligibleCount <= 0) return 'not_started'
  if (eligibleCount === 1) return 'in_progress_1'
  if (eligibleCount === 2) return 'in_progress_2'
  if (eligibleCount === 3) return 'in_progress_3'
  return 'unlocked'
}

async function activeEligibilityCount(tx: Transaction, playerId: string): Promise<number> {
  const [row] = await tx
    .select({ total: count() })
    .from(playerMatchEligibilities)
    .where(and(
      eq(playerMatchEligibilities.playerId, playerId),
      isNull(playerMatchEligibilities.invalidatedAt),
    ))
  return Number(row?.total ?? 0)
}

async function recordCompletedMatchInTransaction(
  tx: Transaction,
  matchId: string,
): Promise<{ createdPlayerIds: string[]; newlyUnlocked: Array<{ playerId: string; userId: string }> }> {
  const [match] = await tx
    .select({
      status: matches.status,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      completedAt: matches.completedAt,
      voidedAt: matches.voidedAt,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1)

  if (!match || !isCountableMatch(match)) return { createdPlayerIds: [], newlyUnlocked: [] }

  // Phase 4 raises the evidence bar from "was in the final snapshot" to
  // "finalized as having attended". Being named on a team sheet is not proof of
  // turning up, and a no-show sitting in the snapshot used to count (PR-030).
  const attended = await tx
    .select({ playerId: matchAttendances.playerId })
    .from(matchAttendances)
    .where(and(
      eq(matchAttendances.matchId, matchId),
      eq(matchAttendances.outcome, 'attended'),
      isNotNull(matchAttendances.finalizedAt),
    ))

  const attendedIds = new Set(
    attended.map((row) => row.playerId).filter((id): id is string => id !== null),
  )
  if (attendedIds.size === 0) return { createdPlayerIds: [], newlyUnlocked: [] }

  // Both bars must hold. The snapshot proves they were part of the match that
  // produced the result; the outcome proves they were actually there.
  const snapshot = await tx
    .select({ playerId: matchParticipants.playerId })
    .from(matchParticipants)
    .where(eq(matchParticipants.matchId, matchId))

  const playerIds = [...new Set(
    snapshot
      .map((row) => row.playerId)
      .filter((id): id is string => id !== null && attendedIds.has(id)),
  )]
  if (playerIds.length === 0) return { createdPlayerIds: [], newlyUnlocked: [] }

  const created = await tx
    .insert(playerMatchEligibilities)
    .values(playerIds.map((playerId) => ({
      matchId,
      playerId,
      evidenceVersion: PHASE4_EVIDENCE_VERSION,
    })))
    .onConflictDoNothing()
    .returning({ playerId: playerMatchEligibilities.playerId })

  const newlyUnlocked: Array<{ playerId: string; userId: string }> = []
  for (const { playerId } of created) {
    const canonicalCount = await activeEligibilityCount(tx, playerId)
    const [current] = await tx
      .select({ cardState: players.cardState, userId: players.userId })
      .from(players)
      .where(and(eq(players.id, playerId), isNull(players.deletedAt)))
      .limit(1)

    if (!current) continue

    const nextCardState = current.cardState === 'unlocked'
      ? 'unlocked'
      : cardStateForEligibleCount(canonicalCount)

    await tx
      .update(players)
      .set({
        // Transitional cache: only a successfully inserted canonical record may
        // advance it. Historical drift is reported, never silently rewritten.
        matchCount: sql`${players.matchCount} + 1`,
        cardState: nextCardState,
        lastMatchAt: match.completedAt,
      })
      .where(and(eq(players.id, playerId), isNull(players.deletedAt)))

    if (current.cardState !== 'unlocked' && nextCardState === 'unlocked') {
      newlyUnlocked.push({ playerId, userId: current.userId })
    }
  }

  return { createdPlayerIds: created.map((row) => row.playerId), newlyUnlocked }
}

async function recordCompletedMatch(matchId: string): Promise<{
  createdPlayerIds: string[]
  newlyUnlocked: Array<{ playerId: string; userId: string }>
}> {
  return db.transaction((tx) => recordCompletedMatchInTransaction(tx, matchId))
}

async function getMatchCountDrift(playerId: string): Promise<{
  cached: number
  canonical: number
  delta: number
}> {
  const [player] = await db
    .select({ matchCount: players.matchCount })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1)
  const [canonical] = await db
    .select({ total: count() })
    .from(playerMatchEligibilities)
    .where(and(
      eq(playerMatchEligibilities.playerId, playerId),
      isNull(playerMatchEligibilities.invalidatedAt),
    ))

  const cached = player?.matchCount ?? 0
  const canonicalCount = Number(canonical?.total ?? 0)
  return { cached, canonical: canonicalCount, delta: cached - canonicalCount }
}

async function getCanonicalCounts(playerIds: string[]): Promise<Map<string, number>> {
  if (playerIds.length === 0) return new Map()
  const rows = await db
    .select({ playerId: playerMatchEligibilities.playerId, total: count() })
    .from(playerMatchEligibilities)
    .where(and(
      inArray(playerMatchEligibilities.playerId, playerIds),
      isNull(playerMatchEligibilities.invalidatedAt),
    ))
    .groupBy(playerMatchEligibilities.playerId)
  return new Map(rows.map((row) => [row.playerId, Number(row.total)]))
}

/**
 * Bring `players.card_state` back in line with the ledger.
 *
 * Deliberately one-way: an unlocked card never re-locks, whatever the count now
 * says (ADR-017). The card reveal is the reward the whole four-match arc builds
 * toward, and an invalidation is usually administrative rather than the player's
 * fault. The correction stays recorded in the ledger; it just does not reach
 * backward into something already given.
 *
 * Eligibility count and card state can therefore legitimately disagree. The
 * ledger is the audit truth; `card_state` is a high-water mark.
 */
async function recomputeCardState(tx: Transaction, playerId: string): Promise<void> {
  const [current] = await tx
    .select({ cardState: players.cardState })
    .from(players)
    .where(and(eq(players.id, playerId), isNull(players.deletedAt)))
    .limit(1)

  if (!current || current.cardState === 'unlocked') return

  const canonicalCount = await activeEligibilityCount(tx, playerId)
  await tx
    .update(players)
    .set({ cardState: cardStateForEligibleCount(canonicalCount) })
    .where(and(eq(players.id, playerId), isNull(players.deletedAt)))
}

/**
 * Strike every eligibility a match produced. Used when a completed match is
 * voided, and idempotent — already-invalidated rows are not touched, so a
 * replay cannot overwrite the original reason or actor.
 */
async function invalidateMatchEligibilitiesInTransaction(
  tx: Transaction,
  matchId: string,
  reason: string,
  invalidatedByPlayerId: string | null,
): Promise<string[]> {
  const invalidated = await tx
    .update(playerMatchEligibilities)
    .set({ invalidatedAt: new Date(), invalidationReason: reason, invalidatedBy: invalidatedByPlayerId })
    .where(and(
      eq(playerMatchEligibilities.matchId, matchId),
      isNull(playerMatchEligibilities.invalidatedAt),
    ))
    .returning({ playerId: playerMatchEligibilities.playerId })

  for (const row of invalidated) {
    await recomputeCardState(tx, row.playerId)
  }

  return invalidated.map((row) => row.playerId)
}

async function invalidateMatchEligibilities(
  matchId: string,
  reason: string,
  invalidatedByPlayerId: string | null,
): Promise<string[]> {
  return db.transaction((tx) =>
    invalidateMatchEligibilitiesInTransaction(tx, matchId, reason, invalidatedByPlayerId))
}

/**
 * Void a completed match and strike what it produced.
 *
 * Historical OVR is never recomputed (PR-031). The result stood at the time and
 * every rating built on it was given in good faith; rewriting ratings months
 * later would be a far larger correction than the one being made.
 */
async function voidMatch(
  matchId: string,
  reason: string,
  voidedByUserId: string,
  voidedByPlayerId: string | null,
): Promise<{ voided: boolean; invalidatedPlayerIds: string[] }> {
  return db.transaction(async (tx) => {
    const [match] = await tx
      .select({ status: matches.status, voidedAt: matches.voidedAt })
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1)

    if (!match || match.status !== 'completed') return { voided: false, invalidatedPlayerIds: [] }
    // Idempotent: voiding twice must not rewrite who did it or why.
    if (match.voidedAt !== null) return { voided: false, invalidatedPlayerIds: [] }

    await tx
      .update(matches)
      .set({ voidedAt: new Date(), voidedBy: voidedByUserId, voidReason: reason })
      .where(eq(matches.id, matchId))

    const invalidatedPlayerIds = await invalidateMatchEligibilitiesInTransaction(
      tx, matchId, reason, voidedByPlayerId,
    )

    return { voided: true, invalidatedPlayerIds }
  })
}

export const eligibilityService = {
  recomputeCardState,
  invalidateMatchEligibilities,
  invalidateMatchEligibilitiesInTransaction,
  voidMatch,
  recordCompletedMatch,
  recordCompletedMatchInTransaction,
  getMatchCountDrift,
  getCanonicalCounts,
}
