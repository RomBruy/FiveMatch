import { and, count, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { CardState } from '@fivematch/types'
import { db, type Db } from '../../db'
import { matchParticipants, matches, playerMatchEligibilities, players } from '../../db/schema'

type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0]

export function hasPhase1EligibilityEvidence(match: {
  status: string
  scoreA: number | null
  scoreB: number | null
}): boolean {
  return match.status === 'completed' && match.scoreA !== null && match.scoreB !== null
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
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1)

  if (!match || !hasPhase1EligibilityEvidence(match)) return { createdPlayerIds: [], newlyUnlocked: [] }

  const snapshot = await tx
    .select({ playerId: matchParticipants.playerId })
    .from(matchParticipants)
    .where(eq(matchParticipants.matchId, matchId))

  const playerIds = [...new Set(snapshot.map((row) => row.playerId).filter((id): id is string => id !== null))]
  if (playerIds.length === 0) return { createdPlayerIds: [], newlyUnlocked: [] }

  const created = await tx
    .insert(playerMatchEligibilities)
    .values(playerIds.map((playerId) => ({ matchId, playerId })))
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

export const eligibilityService = {
  recordCompletedMatch,
  recordCompletedMatchInTransaction,
  getMatchCountDrift,
  getCanonicalCounts,
}
