import { and, desc, eq, gt, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { PRONOS_STARTING_BANKROLL } from '@fivematch/types/algorithm-constants'
import { db } from '../../db'
import {
  groupMemberships,
  matchAttendances,
  matches,
  players,
  pronoBets,
} from '../../db/schema'
import { bankrollService } from './bankroll.service'

/**
 * Everything the Pronos tab needs, across every match rather than one.
 *
 * The per-match betting API stays the source of truth for odds and placement.
 * This exists because a bankroll and a bet history belong to the player, not to
 * a fixture, and had no home while every pronos route was match-scoped.
 */

/**
 * The market-open proxy: teams are generated (so `teamOvrAtLock` exists and odds
 * can be priced) and kickoff has not passed. It matches the odds route's own
 * `ODDS_NOT_AVAILABLE` precondition exactly, so a card here never opens onto a
 * 422.
 */
function marketOpenCondition() {
  return and(eq(matches.status, 'teams_generated'), gt(matches.scheduledAt, new Date()))
}

/**
 * Matches this player may bet on. Mirrors `canSubmitProno` — participant, crew
 * member, or host — evaluated in one query rather than per match.
 */
function eligibilityCondition(internalUserId: string, playerId: string) {
  return or(
    eq(matches.hostId, internalUserId),
    sql`EXISTS (
      SELECT 1 FROM ${matchAttendances}
      WHERE ${matchAttendances.matchId} = ${matches.id}
        AND ${matchAttendances.playerId} = ${playerId}
        AND ${matchAttendances.status} = 'in'
        AND ${matchAttendances.waitlistPosition} IS NULL
    )`,
    sql`(${matches.groupId} IS NOT NULL AND EXISTS (
      SELECT 1 FROM ${groupMemberships}
      WHERE ${groupMemberships.groupId} = ${matches.groupId}
        AND ${groupMemberships.userId} = ${internalUserId}
        AND ${groupMemberships.role} <> 'pending_member'
        AND ${groupMemberships.deletedAt} IS NULL
    ))`,
  )
}

async function getFeed(internalUserId: string, playerId: string) {
  const [balance, openMarkets, bets] = await Promise.all([
    bankrollService.getBalance(playerId),

    db
      .select({
        matchId: matches.id,
        scheduledAt: matches.scheduledAt,
        city: matches.city,
        venueName: matches.venueName,
        format: matches.format,
      })
      .from(matches)
      .where(and(marketOpenCondition(), eligibilityCondition(internalUserId, playerId)))
      .orderBy(matches.scheduledAt)
      .limit(20),

    db
      .select({
        id: pronoBets.id,
        matchId: pronoBets.matchId,
        market: pronoBets.market,
        selection: pronoBets.selection,
        stake: pronoBets.stake,
        oddsAtBet: pronoBets.oddsAtBet,
        status: pronoBets.status,
        payout: pronoBets.payout,
        placedAt: pronoBets.placedAt,
        settledAt: pronoBets.settledAt,
        scheduledAt: matches.scheduledAt,
        city: matches.city,
        venueName: matches.venueName,
      })
      .from(pronoBets)
      .innerJoin(matches, eq(matches.id, pronoBets.matchId))
      .where(eq(pronoBets.playerId, playerId))
      .orderBy(desc(pronoBets.placedAt))
      .limit(50),
  ])

  // Which open markets already carry a stake, so the board can say so rather
  // than inviting a bet the player has already made.
  const stakedMatchIds = new Set(
    bets.filter((bet) => bet.status === 'pending').map((bet) => bet.matchId),
  )

  return {
    balance,
    startingBankroll: PRONOS_STARTING_BANKROLL,
    openMarkets: openMarkets.map((market) => ({
      ...market,
      scheduledAt: market.scheduledAt.toISOString(),
      hasOpenBet: stakedMatchIds.has(market.matchId),
    })),
    bets: bets.map((bet) => ({
      id: bet.id,
      matchId: bet.matchId,
      market: bet.market,
      selection: bet.selection,
      stake: bet.stake,
      oddsAtBet: Number(bet.oddsAtBet),
      status: bet.status,
      payout: bet.payout,
      placedAt: bet.placedAt.toISOString(),
      settledAt: bet.settledAt ? bet.settledAt.toISOString() : null,
      scheduledAt: bet.scheduledAt.toISOString(),
      city: bet.city,
      venueName: bet.venueName,
    })),
  }
}

/**
 * Crew bankroll standings. Members who have never bet are excluded rather than
 * padding the table with identical starting balances.
 */
async function getCrewStandings(groupId: string) {
  const memberRows = await db
    .select({ userId: groupMemberships.userId })
    .from(groupMemberships)
    .where(and(
      eq(groupMemberships.groupId, groupId),
      ne(groupMemberships.role, 'pending_member'),
      isNull(groupMemberships.deletedAt),
    ))

  const userIds = memberRows.map((row) => row.userId)
  if (userIds.length === 0) return []

  return db
    .select({
      playerId: players.id,
      displayName: players.displayName,
      balance: players.pronosBalance,
    })
    .from(players)
    .where(and(inArray(players.userId, userIds), isNull(players.deletedAt)))
    .orderBy(desc(players.pronosBalance))
    .limit(50)
}

export const pronosFeedService = {
  getFeed,
  getCrewStandings,
}
