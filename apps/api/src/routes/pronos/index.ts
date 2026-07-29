import { Router } from 'express'
import { asyncHandler } from '../../middleware/async-handler'
import { requireGroupMember } from '../../middleware/require-group-member'
import { db } from '../../db'
import { matches, players, pronoBets } from '../../db/schema'
import { eq, and, isNull, inArray, asc } from 'drizzle-orm'
import { ErrorCode } from '@fivematch/types'
import { PlaceBetSchema } from './schemas'
import { betService } from '../../services/pronos/bet.service'
import { bankrollService } from '../../services/pronos/bankroll.service'
import { resultOf } from '../../services/pronos/odds-engine'

const router = Router({ mergeParams: true })

/** The reveal's zero state — a match nobody bet on, or one not yet played. */
const EMPTY_TOTALS = { staked: 0, returned: 0, net: 0 } as const

// Bankroll failures arrive as thrown errors carrying { code, statusCode } — map them to
// the standard error envelope; anything unrecognised belongs to the error handler.
const BANKROLL_ERROR_STATUS: Record<string, number> = {
  INSUFFICIENT_BALANCE: 422,
  STAKE_LIMIT_EXCEEDED: 422,
  INVALID_STAKE: 422,
  INVALID_SELECTION: 422,
  PLAYER_NOT_FOUND: 404,
}

// ─── Story 11.3 — betting ────────────────────────────────────────────────────

/** Resolve the caller's player row for this group. */
async function resolveCallerPlayer(userInternalId: string, groupId: string) {
  const [callerPlayer] = await db
    .select({ id: players.id })
    .from(players)
    .where(and(eq(players.userId, userInternalId), eq(players.groupId, groupId), isNull(players.deletedAt)))
  return callerPlayer ?? null
}

/** Load the match scoped to its group, with everything the betting routes need. */
async function loadBettableMatch(matchId: string, groupId: string) {
  const [match] = await db
    .select({
      id: matches.id,
      scheduledAt: matches.scheduledAt,
      teamAOvrAtLock: matches.teamAOvrAtLock,
      teamBOvrAtLock: matches.teamBOvrAtLock,
    })
    .from(matches)
    .where(and(eq(matches.id, matchId), eq(matches.groupId, groupId)))
  return match ?? null
}

// GET /v1/groups/:groupId/matches/:matchId/pronos/odds — the live board
router.get(
  '/odds',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }

    const match = await loadBettableMatch(matchId, groupId)
    if (!match) {
      return res.status(404).json({ error: { code: ErrorCode.MATCH_NOT_FOUND, statusCode: 404 } })
    }
    if (match.teamAOvrAtLock === null || match.teamBOvrAtLock === null) {
      return res.status(422).json({ error: { code: ErrorCode.ODDS_NOT_AVAILABLE, statusCode: 422 } })
    }

    const roster = await betService.getLockedRoster(matchId)
    const board = betService.buildOddsBoard(
      Number(match.teamAOvrAtLock),
      Number(match.teamBOvrAtLock),
      roster,
    )

    return res.json({
      data: {
        ...board,
        // The locked OVR pair the board above was priced from. Exposed so the screen's
        // header can never show a live OVR that contradicts its own cotes (Story 11.5).
        teams: {
          teamAOvr: Number(match.teamAOvrAtLock),
          teamBOvr: Number(match.teamBOvrAtLock),
        },
        window: {
          open: new Date() < match.scheduledAt,
          closesAt: match.scheduledAt.toISOString(),
        },
      },
    })
  }),
)

// POST /v1/groups/:groupId/matches/:matchId/pronos/bets — stake points on a market
router.post(
  '/bets',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }
    const data = PlaceBetSchema.parse(req.body)

    const callerPlayer = await resolveCallerPlayer(req.user.internalId!, groupId)
    if (!callerPlayer) {
      return res.status(403).json({ error: { code: ErrorCode.NOT_A_MEMBER, statusCode: 403 } })
    }

    const match = await loadBettableMatch(matchId, groupId)
    if (!match) {
      return res.status(404).json({ error: { code: ErrorCode.MATCH_NOT_FOUND, statusCode: 404 } })
    }
    if (match.teamAOvrAtLock === null || match.teamBOvrAtLock === null) {
      return res.status(422).json({ error: { code: ErrorCode.ODDS_NOT_AVAILABLE, statusCode: 422 } })
    }
    if (new Date() >= match.scheduledAt) {
      return res.status(422).json({ error: { code: ErrorCode.PRONOS_WINDOW_CLOSED, statusCode: 422 } })
    }

    // Price the board server-side, then find the caller's selection ON it. A selection
    // that is well-shaped but not on the board (an off-grid scoreline, a player who is
    // not in the locked teams) is rejected here rather than silently priced.
    const roster = await betService.getLockedRoster(matchId)
    const board = betService.buildOddsBoard(
      Number(match.teamAOvrAtLock),
      Number(match.teamBOvrAtLock),
      roster,
    )

    let oddsAtBet: number | undefined
    if (data.market === 'result') {
      if (data.selection === 'teamA' || data.selection === 'draw' || data.selection === 'teamB') {
        oddsAtBet = board.result[data.selection]
      }
    } else if (data.market === 'score') {
      oddsAtBet = board.scores.find((s) => s.selection === data.selection)?.odds
    } else {
      oddsAtBet = board.mvp.find((m) => m.playerId === data.selection)?.odds
    }

    if (oddsAtBet === undefined) {
      return res.status(422).json({ error: { code: ErrorCode.INVALID_SELECTION, statusCode: 422 } })
    }

    try {
      const { bet, balance } = await bankrollService.placeBet({
        playerId: callerPlayer.id,
        matchId,
        market: data.market,
        selection: data.selection,
        stake: data.stake,
        oddsAtBet,
      })

      return res.status(201).json({
        data: {
          bet: { ...bet, oddsAtBet: Number(bet.oddsAtBet) },
          balance,
        },
      })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      const status = code ? BANKROLL_ERROR_STATUS[code] : undefined
      if (code && status) {
        return res.status(status).json({ error: { code, statusCode: status } })
      }
      throw err
    }
  }),
)

// GET /v1/groups/:groupId/matches/:matchId/pronos/bets/my — caller's bets + balance
router.get(
  '/bets/my',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }

    const callerPlayer = await resolveCallerPlayer(req.user.internalId!, groupId)
    if (!callerPlayer) {
      return res.status(403).json({ error: { code: ErrorCode.NOT_A_MEMBER, statusCode: 403 } })
    }

    const rows = await db
      .select()
      .from(pronoBets)
      .where(and(eq(pronoBets.matchId, matchId), eq(pronoBets.playerId, callerPlayer.id)))
      .orderBy(asc(pronoBets.placedAt))

    const balance = await bankrollService.getBalance(callerPlayer.id)
    const netPayout = rows.reduce((sum, b) => sum + ((b.payout ?? 0) - b.stake), 0)

    return res.json({
      data: {
        bets: rows.map((b) => ({
          id: b.id,
          market: b.market,
          selection: b.selection,
          stake: b.stake,
          oddsAtBet: Number(b.oddsAtBet),
          status: b.status,
          payout: b.payout,
          placedAt: b.placedAt.toISOString(),
          settledAt: b.settledAt ? b.settledAt.toISOString() : null,
        })),
        balance,
        netPayout,
      },
    })
  }),
)

// ─── Story 11.6 — settlement reveal ──────────────────────────────────────────

// GET /v1/groups/:groupId/matches/:matchId/pronos/bets/reveal
//
// Unlike the legacy flat `GET /reveal` (which 403s until the match completes), this route
// always answers 200 and states the case in `settled`. The betting screen fires it in
// PARALLEL with `GET /odds` to choose between board and reveal mode: a 403 would be
// indistinguishable from a real permission failure, and gating it behind a status the
// client does not yet know would force a render-blocking waterfall.
router.get(
  '/bets/reveal',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }

    const callerPlayer = await resolveCallerPlayer(req.user.internalId!, groupId)
    if (!callerPlayer) {
      return res.status(403).json({ error: { code: ErrorCode.NOT_A_MEMBER, statusCode: 403 } })
    }

    const [match] = await db
      .select({
        id: matches.id,
        status: matches.status,
        scoreA: matches.scoreA,
        scoreB: matches.scoreB,
        mvpPlayerId: matches.mvpPlayerId,
      })
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.groupId, groupId)))

    if (!match) {
      return res.status(404).json({ error: { code: ErrorCode.MATCH_NOT_FOUND, statusCode: 404 } })
    }

    const settled = match.status === 'completed' && match.scoreA !== null && match.scoreB !== null

    if (!settled) {
      return res.json({
        data: {
          settled: false,
          match: {
            status: match.status,
            scoreA: match.scoreA,
            scoreB: match.scoreB,
            actualResult: null,
            actualScore: null,
            mvpPlayerId: match.mvpPlayerId,
            mvpDisplayName: null,
          },
          myBets: [],
          myTotals: EMPTY_TOTALS,
          group: [],
        },
      })
    }

    const rows = await db
      .select({
        id: pronoBets.id,
        playerId: pronoBets.playerId,
        displayName: players.displayName,
        market: pronoBets.market,
        selection: pronoBets.selection,
        stake: pronoBets.stake,
        oddsAtBet: pronoBets.oddsAtBet,
        status: pronoBets.status,
        payout: pronoBets.payout,
        placedAt: pronoBets.placedAt,
        settledAt: pronoBets.settledAt,
      })
      .from(pronoBets)
      .innerJoin(players, and(eq(players.id, pronoBets.playerId), isNull(players.deletedAt)))
      .where(eq(pronoBets.matchId, matchId))
      .orderBy(asc(pronoBets.placedAt))

    // One batched lookup for every display name the payload needs: the MVP selections on
    // mvp-market bets plus the actual MVP. Never one query per bet.
    const nameIds = [
      ...new Set([
        ...rows.filter((r) => r.market === 'mvp').map((r) => r.selection),
        ...(match.mvpPlayerId ? [match.mvpPlayerId] : []),
      ]),
    ]
    const nameMap = new Map<string, string>()
    if (nameIds.length > 0) {
      const named = await db
        .select({ id: players.id, displayName: players.displayName })
        .from(players)
        .where(inArray(players.id, nameIds))
      for (const p of named) nameMap.set(p.id, p.displayName)
    }

    // An mvp bet stores a playerId; every other market stores its own label. A purged or
    // unresolvable player falls back to the raw selection rather than emitting null.
    const labelOf = (market: string, selection: string) =>
      market === 'mvp' ? (nameMap.get(selection) ?? selection) : selection

    const myBets = rows
      .filter((r) => r.playerId === callerPlayer.id)
      .map((r) => ({
        id: r.id,
        market: r.market,
        selection: r.selection,
        selectionLabel: labelOf(r.market, r.selection),
        stake: r.stake,
        oddsAtBet: Number(r.oddsAtBet),
        status: r.status,
        payout: r.payout,
        settledAt: r.settledAt ? r.settledAt.toISOString() : null,
      }))

    // A pending payout is null, meaning "not settled yet" — never zero. Treating it as a
    // loss would tell a player they lost a bet that is still live (mvp bets settle later).
    const totals = new Map<string, { playerId: string; displayName: string; staked: number; returned: number }>()
    for (const r of rows) {
      const entry = totals.get(r.playerId) ?? {
        playerId: r.playerId,
        displayName: r.displayName,
        staked: 0,
        returned: 0,
      }
      entry.staked += r.stake
      entry.returned += r.payout ?? 0
      totals.set(r.playerId, entry)
    }

    const group = [...totals.values()]
      .map((e) => ({ ...e, net: e.returned - e.staked, isMe: e.playerId === callerPlayer.id }))
      .sort((a, b) => b.net - a.net || a.displayName.localeCompare(b.displayName))

    const mine = totals.get(callerPlayer.id)

    return res.json({
      data: {
        settled: true,
        match: {
          status: match.status,
          scoreA: match.scoreA,
          scoreB: match.scoreB,
          actualResult: resultOf(match.scoreA!, match.scoreB!),
          actualScore: `${match.scoreA}-${match.scoreB}`,
          mvpPlayerId: match.mvpPlayerId,
          mvpDisplayName: match.mvpPlayerId ? (nameMap.get(match.mvpPlayerId) ?? null) : null,
        },
        myBets,
        myTotals: mine
          ? { staked: mine.staked, returned: mine.returned, net: mine.returned - mine.staked }
          : EMPTY_TOTALS,
        group,
      },
    })
  }),
)

export default router
