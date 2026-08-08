// bet.service.ts — the betting market surface and settlement (Story 11.3).
//
// Reads OVR snapshots, never writes them. Every debit and credit goes through
// bankrollService; this file decides WHAT a bet is worth, never HOW money moves.
//
// Deliberately separate from prono.service.ts (the legacy flat scoring): Story 11.7
// retires that path, and keeping the two apart means 11.7 deletes a call site rather
// than performing surgery on live betting code.
import { and, desc, eq, isNull } from 'drizzle-orm'
import {
  PRONOS_CLOSE_GOAL_TOLERANCE,
  PRONOS_SCORE_BOARD_SIZE,
  TEAM_GEN_OVR_FALLBACK,
} from '@fivematch/types/algorithm-constants'
import { db } from '../../db'
import {
  matches,
  players,
  pronoBets,
  teamGenerationJobs,
  teamGenerationPlayers,
} from '../../db/schema'
import { notificationService } from '../notifications/notification.service'
import {
  computeMvpOdds,
  computeResultOdds,
  computeScoreOdds,
  resultOf,
  type MatchResult,
  type ResultOdds,
} from './odds-engine'
import { bankrollService } from './bankroll.service'

export interface RosterEntry {
  playerId: string
  displayName: string
  ovr: number
}

export interface ScoreBoardEntry {
  scoreA: number
  scoreB: number
  /** The value a bet's `selection` must carry for this line. */
  selection: string
  odds: number
}

export interface MvpBoardEntry {
  playerId: string
  displayName: string
  odds: number
}

export interface OddsBoard {
  result: ResultOdds
  scores: ScoreBoardEntry[]
  mvp: MvpBoardEntry[]
}

/**
 * The roster the market is priced against: the players of the LATEST completed team
 * generation, at the OVR they held when teams locked.
 *
 * Deliberately not live `players.ovrScoreFloat` — a mid-window OVR change must never
 * silently re-price an open market. GDPR-purged rows (playerId NULL) drop out.
 */
export async function getLockedRoster(matchId: string): Promise<RosterEntry[]> {
  const [job] = await db
    .select({ id: teamGenerationJobs.id })
    .from(teamGenerationJobs)
    .where(and(eq(teamGenerationJobs.matchId, matchId), eq(teamGenerationJobs.status, 'complete')))
    .orderBy(desc(teamGenerationJobs.generationNumber))
    .limit(1)

  if (!job) return []

  const rows = await db
    .select({
      playerId: teamGenerationPlayers.playerId,
      displayName: players.displayName,
      ovrAtGeneration: teamGenerationPlayers.ovrAtGeneration,
    })
    .from(teamGenerationPlayers)
    .innerJoin(players, eq(players.id, teamGenerationPlayers.playerId))
    .where(and(eq(teamGenerationPlayers.jobId, job.id), isNull(players.deletedAt)))

  return rows
    .filter((r): r is typeof r & { playerId: string } => r.playerId !== null)
    .map((r) => ({
      playerId: r.playerId,
      displayName: r.displayName,
      // Same fallback the generator itself used, so pricing matches the locked teams.
      ovr: r.ovrAtGeneration !== null ? Number(r.ovrAtGeneration) : TEAM_GEN_OVR_FALLBACK,
    }))
}

/** All three markets for a locked match, ready to serialize. */
export function buildOddsBoard(
  teamAOvr: number,
  teamBOvr: number,
  roster: RosterEntry[],
): OddsBoard {
  const nameOf = new Map(roster.map((r) => [r.playerId, r.displayName]))

  return {
    result: computeResultOdds(teamAOvr, teamBOvr),
    scores: computeScoreOdds(teamAOvr, teamBOvr)
      .slice(0, PRONOS_SCORE_BOARD_SIZE)
      .map((s) => ({
        scoreA: s.scoreA,
        scoreB: s.scoreB,
        selection: `${s.scoreA}-${s.scoreB}`,
        odds: s.odds,
      })),
    mvp: computeMvpOdds(roster.map((r) => ({ playerId: r.playerId, ovr: r.ovr }))).map((m) => ({
      playerId: m.playerId,
      displayName: nameOf.get(m.playerId) ?? '',
      odds: m.odds,
    })),
  }
}

// ─── Settlement ──────────────────────────────────────────────────────────────

type Outcome = { status: 'won' | 'lost' | 'close'; payout: number }

/** Parse an "a-b" selection. Returns null when malformed. */
function parseScore(selection: string): { a: number; b: number } | null {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec(selection)
  if (!m) return null
  return { a: Number(m[1]), b: Number(m[2]) }
}

/**
 * What one pending bet is worth against the final result.
 * Returns null when the bet cannot be settled yet (MVP not resolved) or is unparseable.
 */
export function resolveOutcome(
  bet: { market: string; selection: string; stake: number; oddsAtBet: string },
  actual: { scoreA: number; scoreB: number; result: MatchResult; score: string; mvpPlayerId: string | null },
): Outcome | null {
  const stake = bet.stake
  const odds = Number(bet.oddsAtBet)
  const won = (): Outcome => ({ status: 'won', payout: bankrollService.wonPayout(stake, odds) })
  const lost: Outcome = { status: 'lost', payout: 0 }

  switch (bet.market) {
    case 'result':
      return bet.selection === actual.result ? won() : lost

    case 'score': {
      if (bet.selection === actual.score) return won()
      const pred = parseScore(bet.selection)
      if (!pred) return null
      // "Close" — the result was right and the goal difference was nearly right.
      const sameResult = resultOf(pred.a, pred.b) === actual.result
      const diffDelta = Math.abs(pred.a - pred.b - (actual.scoreA - actual.scoreB))
      return sameResult && diffDelta <= PRONOS_CLOSE_GOAL_TOLERANCE
        ? { status: 'close', payout: bankrollService.closeRefund(stake) }
        : lost
    }

    case 'mvp':
      // The MVP is decided by a vote that resolves after the score — leave pending.
      if (actual.mvpPlayerId === null) return null
      return bet.selection === actual.mvpPlayerId ? won() : lost

    default:
      return null
  }
}

export interface SettlementSummary {
  settled: number
  skipped: number
}

/**
 * Settle every pending bet on a match, in one transaction.
 *
 * Safe to call repeatedly: bankrollService.settleBet is guarded on `status = 'pending'`,
 * so a replay credits nothing. That is what lets this run once when the score lands and
 * again when MVP voting resolves.
 */
export async function settleMatchBets(matchId: string): Promise<SettlementSummary> {
  const [match] = await db
    .select({
      id: matches.id,
      groupId: matches.groupId,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      mvpPlayerId: matches.mvpPlayerId,
    })
    .from(matches)
    .where(eq(matches.id, matchId))

  if (!match || match.scoreA === null || match.scoreB === null) return { settled: 0, skipped: 0 }

  const actual = {
    scoreA: match.scoreA,
    scoreB: match.scoreB,
    result: resultOf(match.scoreA, match.scoreB),
    score: `${match.scoreA}-${match.scoreB}`,
    mvpPlayerId: match.mvpPlayerId,
  }

  const pending = await db
    .select()
    .from(pronoBets)
    .where(and(eq(pronoBets.matchId, matchId), eq(pronoBets.status, 'pending')))

  if (pending.length === 0) return { settled: 0, skipped: 0 }

  const work: { betId: string; playerId: string; outcome: Outcome }[] = []
  let skipped = 0

  for (const bet of pending) {
    const outcome = resolveOutcome(bet, actual)
    if (!outcome) {
      // MVP not yet resolved, or a row we cannot parse — leave it pending rather than
      // guessing. A later run settles it; a malformed row is visible in the ledger.
      skipped++
      continue
    }
    work.push({ betId: bet.id, playerId: bet.playerId, outcome })
  }

  let settled = 0
  if (work.length > 0) {
    await db.transaction(async (tx) => {
      for (const w of work) {
        const row = await bankrollService.settleBet(tx, {
          betId: w.betId,
          status: w.outcome.status,
          payout: w.outcome.payout,
        })
        if (row) settled++
      }
    })
  }

  if (settled > 0) await notifySettled(matchId, match.groupId, [...new Set(work.map((w) => w.playerId))])

  return { settled, skipped }
}

/** One push per player who had a bet settled, carrying their net for the whole match. */
async function notifySettled(matchId: string, groupId: string | null, playerIds: string[]): Promise<void> {
  const rows = await db
    .select({
      playerId: pronoBets.playerId,
      userId: players.userId,
      stake: pronoBets.stake,
      payout: pronoBets.payout,
    })
    .from(pronoBets)
    .innerJoin(players, eq(players.id, pronoBets.playerId))
    .where(and(eq(pronoBets.matchId, matchId), isNull(players.deletedAt)))

  const net = new Map<string, { userId: string; net: number }>()
  for (const r of rows) {
    if (!playerIds.includes(r.playerId)) continue
    const cur = net.get(r.playerId) ?? { userId: r.userId, net: 0 }
    cur.net += (r.payout ?? 0) - r.stake
    net.set(r.playerId, cur)
  }

  for (const { userId, net: netPayout } of net.values()) {
    notificationService.send({
      type: 'PRONOS_BETS_SETTLED',
      matchId,
      groupId,
      netPayout,
      recipientUserId: userId,
    })
  }
}

export const betService = {
  getLockedRoster,
  buildOddsBoard,
  resolveOutcome,
  settleMatchBets,
}
