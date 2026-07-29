// bankroll.service.ts — the Pronos betting money layer (Story 11.2).
//
// Bankroll is a closed fictional-points economy. It READS nothing from the OVR pipeline
// and WRITES nothing into it. OVR = player performance. Pronos = prediction.
// See: _bmad-output/planning-artifacts/pronos-betting-module-brief.md §2
//
// Every mutation of players.pronos_balance has exactly one prono_bets row behind it, so
// a balance is always reconstructable: PRONOS_STARTING_BANKROLL + Σpayout − Σstake.
//
// Scope: money integrity only. Betting-window, match-status and membership checks belong
// to the route layer (Story 11.3).
import { and, eq, gte, isNull, sql } from 'drizzle-orm'
import {
  PRONOS_STARTING_BANKROLL,
  PRONOS_MAX_STAKE,
  PRONOS_CLOSE_REFUND,
} from '@fivematch/types/algorithm-constants'
import { ErrorCode } from '@fivematch/types/errors'
import { db } from '../../db'
import { players, pronoBets } from '../../db/schema'
import type { PronoBet } from '../../db/schema'

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type BetMarket = 'result' | 'score' | 'mvp'
export type SettledStatus = 'won' | 'lost' | 'close'

export interface PlaceBetInput {
  playerId: string
  matchId: string
  market: BetMarket
  /** Encoding per market — see the `selection` doc in db/schema/prono_bets.ts */
  selection: string
  stake: number
  /** The cote frozen on the bet, as a number (odds-engine output). */
  oddsAtBet: number
}

export interface SettleBetInput {
  betId: string
  status: SettledStatus
  /** Amount to CREDIT back. 'lost' → 0 (the stake was forfeited at debit time). */
  payout: number
}

export interface Reconciliation {
  stored: number
  audited: number
  /** stored − audited. Anything but 0 means the cached column has drifted. */
  drift: number
}

function fail(code: string, statusCode: number): never {
  throw Object.assign(new Error(code), { code, statusCode })
}

const RESULT_SELECTIONS = new Set(['teamA', 'draw', 'teamB'])
const SCORE_PATTERN = /^\d{1,2}-\d{1,2}$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Shape-check a selection against its market. Does NOT check that the entity exists. */
export function isValidSelection(market: BetMarket, selection: string): boolean {
  switch (market) {
    case 'result':
      return RESULT_SELECTIONS.has(selection)
    case 'score':
      return SCORE_PATTERN.test(selection)
    case 'mvp':
      return UUID_PATTERN.test(selection)
    default:
      return false
  }
}

// ─── Payout arithmetic (single source of rounding truth) ─────────────────────

/** Credit for a winning bet: stake × frozen cote, rounded to whole points. */
export function wonPayout(stake: number, oddsAtBet: number): number {
  return Math.round(stake * oddsAtBet)
}

/** Soft-landing refund on a "close" correct-score miss. */
export function closeRefund(stake: number): number {
  return Math.round(PRONOS_CLOSE_REFUND * stake)
}

// ─── Balance reads ───────────────────────────────────────────────────────────

/** The cached balance on players.pronos_balance. */
async function getBalance(playerId: string): Promise<number> {
  const [row] = await db
    .select({ balance: players.pronosBalance })
    .from(players)
    .where(and(eq(players.id, playerId), isNull(players.deletedAt)))

  if (!row) fail(ErrorCode.PLAYER_NOT_FOUND, 404)
  return row.balance
}

/**
 * The balance rebuilt from the ledger alone — the auditable source of truth.
 * Deliberately never reads players.pronos_balance.
 */
async function getAuditedBalance(playerId: string): Promise<number> {
  const [row] = await db
    .select({
      staked: sql<string>`coalesce(sum(${pronoBets.stake}), 0)`,
      paid: sql<string>`coalesce(sum(${pronoBets.payout}), 0)`,
    })
    .from(pronoBets)
    .where(eq(pronoBets.playerId, playerId))

  const staked = Number(row?.staked ?? 0)
  const paid = Number(row?.paid ?? 0)
  return PRONOS_STARTING_BANKROLL + paid - staked
}

/** Read-only drift check. Never repairs the cached column. */
async function reconcile(playerId: string): Promise<Reconciliation> {
  const [stored, audited] = await Promise.all([getBalance(playerId), getAuditedBalance(playerId)])
  return { stored, audited, drift: stored - audited }
}

// ─── Writes ──────────────────────────────────────────────────────────────────

/**
 * Debit the stake and append the ledger row, atomically.
 *
 * The balance check IS the conditional UPDATE (`... AND pronos_balance >= stake`), never a
 * SELECT-then-compare: under READ COMMITTED two concurrent bets would both pass a JS check
 * they cannot both afford. Zero rows updated = insufficient funds, and throwing rolls the
 * transaction back so no ledger row survives.
 */
async function placeBet(input: PlaceBetInput): Promise<{ bet: PronoBet; balance: number }> {
  const { playerId, matchId, market, selection, stake, oddsAtBet } = input

  if (!Number.isInteger(stake) || stake < 1) fail(ErrorCode.INVALID_STAKE, 422)
  if (stake > PRONOS_MAX_STAKE) fail(ErrorCode.STAKE_LIMIT_EXCEEDED, 422)
  if (!isValidSelection(market, selection)) fail(ErrorCode.INVALID_SELECTION, 422)

  return db.transaction(async (tx) => {
    const debited = await tx
      .update(players)
      .set({ pronosBalance: sql`${players.pronosBalance} - ${stake}` })
      .where(
        and(
          eq(players.id, playerId),
          isNull(players.deletedAt),
          gte(players.pronosBalance, stake),
        ),
      )
      .returning({ balance: players.pronosBalance })

    if (debited.length === 0) fail(ErrorCode.INSUFFICIENT_BALANCE, 422)

    const [bet] = await tx
      .insert(pronoBets)
      .values({
        matchId,
        playerId,
        market,
        selection,
        stake,
        oddsAtBet: oddsAtBet.toFixed(2), // numeric columns round-trip as strings
        status: 'pending',
        payout: null,
        settledAt: null,
      })
      .returning()

    return { bet, balance: debited[0].balance }
  })
}

/**
 * Settle one pending bet and credit its payout. Takes the caller's transaction so a whole
 * match settles atomically (Story 11.3).
 *
 * Idempotent by construction: the status transition is guarded by `status = 'pending'`, so a
 * replayed settlement matches zero rows, returns null, and credits nothing.
 */
async function settleBet(tx: Tx, input: SettleBetInput): Promise<PronoBet | null> {
  const { betId, status, payout } = input

  const [settled] = await tx
    .update(pronoBets)
    .set({ status, payout, settledAt: new Date() })
    .where(and(eq(pronoBets.id, betId), eq(pronoBets.status, 'pending')))
    .returning()

  if (!settled) return null

  if (payout > 0) {
    await tx
      .update(players)
      .set({ pronosBalance: sql`${players.pronosBalance} + ${payout}` })
      .where(eq(players.id, settled.playerId))
  }

  return settled
}

export const bankrollService = {
  getBalance,
  getAuditedBalance,
  reconcile,
  placeBet,
  settleBet,
  wonPayout,
  closeRefund,
  isValidSelection,
}
