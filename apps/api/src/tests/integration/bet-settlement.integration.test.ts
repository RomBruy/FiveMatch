import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { sql, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '../../db'
import { users, groups, players, matches, pronoBets } from '../../db/schema'
import { bankrollService } from '../../services/pronos/bankroll.service'
import { settleMatchBets } from '../../services/pronos/bet.service'

const TEST_PREFIX = 'test-11-3-settle-'

describe('Bet settlement', () => {
  let userId: string
  let groupId: string
  let playerId: string
  let mvpPlayerId: string
  let matchId: string

  beforeEach(async () => {
    userId = randomUUID()
    await db.insert(users).values({
      id: userId,
      clerkUserId: `${TEST_PREFIX}${userId}`,
      name: 'Test Bettor',
      email: `${TEST_PREFIX}${userId}@example.com`,
    })

    groupId = randomUUID()
    await db.insert(groups).values({
      id: groupId, organizerId: userId, name: `${TEST_PREFIX}group`,
      formatPreset: '5v5', goalkeeperMode: 'none', generatorStyle: 'pure_ovr',
    })

    // players is unique on (groupId, userId) — the MVP needs their own user.
    const mvpUserId = randomUUID()
    await db.insert(users).values({
      id: mvpUserId,
      clerkUserId: `${TEST_PREFIX}${mvpUserId}`,
      name: 'Test MVP',
      email: `${TEST_PREFIX}${mvpUserId}@example.com`,
    })

    playerId = randomUUID()
    mvpPlayerId = randomUUID()
    await db.insert(players).values([
      { id: playerId, groupId, userId, displayName: `${TEST_PREFIX}bettor` },
      { id: mvpPlayerId, groupId, userId: mvpUserId, displayName: `${TEST_PREFIX}mvp` },
    ])

    matchId = randomUUID()
    await db.insert(matches).values({
      id: matchId, groupId, organizerId: userId,
      status: 'teams_generated',
      scheduledAt: new Date(Date.now() + 3_600_000),
      format: '5v5', playersPerTeam: 5, goalkeeperMode: 'none',
      teamAOvrAtLock: '78.00', teamBOvrAtLock: '70.00',
    })
  })

  afterEach(async () => {
    await db.delete(pronoBets).where(eq(pronoBets.matchId, matchId))
    await db.delete(matches).where(eq(matches.id, matchId))
    await db.delete(players).where(sql`display_name LIKE ${TEST_PREFIX + '%'}`)
    await db.delete(groups).where(sql`name LIKE ${TEST_PREFIX + '%'}`)
    await db.delete(users).where(sql`clerk_user_id LIKE ${TEST_PREFIX + '%'}`)
  })

  /** Place the three bets the scenario settles: one per market. */
  async function placeThreeBets() {
    const win = await bankrollService.placeBet({
      playerId, matchId, market: 'result', selection: 'teamA', stake: 250, oddsAtBet: 2.13,
    })
    const close = await bankrollService.placeBet({
      playerId, matchId, market: 'score', selection: '3-1', stake: 50, oddsAtBet: 19.99,
    })
    const mvp = await bankrollService.placeBet({
      playerId, matchId, market: 'mvp', selection: mvpPlayerId, stake: 50, oddsAtBet: 6.66,
    })
    return { win, close, mvp }
  }

  /** Record the final score without resolving the MVP yet. */
  async function recordResult(mvp: string | null = null) {
    await db.update(matches)
      .set({ status: 'completed', scoreA: 4, scoreB: 2, mvpPlayerId: mvp })
      .where(eq(matches.id, matchId))
  }

  it('settles result and score bets at the score, and holds MVP bets until the vote resolves', async () => {
    await placeThreeBets()
    expect(await bankrollService.getBalance(playerId)).toBe(650) // 1000 − 350 staked

    await recordResult(null)
    const first = await settleMatchBets(matchId)

    expect(first).toEqual({ settled: 2, skipped: 1 })
    // won 250 × 2.13 = 533; close 0.4 × 50 = 20
    expect(await bankrollService.getBalance(playerId)).toBe(650 + 533 + 20)

    const stillPending = await db.select().from(pronoBets)
      .where(eq(pronoBets.status, 'pending'))
    expect(stillPending.filter((b) => b.matchId === matchId)).toHaveLength(1)
  })

  it('settles the MVP bet on the second run, once the winner is known', async () => {
    await placeThreeBets()
    await recordResult(null)
    await settleMatchBets(matchId)

    await db.update(matches).set({ mvpPlayerId }).where(eq(matches.id, matchId))
    const second = await settleMatchBets(matchId)

    expect(second).toEqual({ settled: 1, skipped: 0 })
    // MVP bet won: 50 × 6.66 = 333
    expect(await bankrollService.getBalance(playerId)).toBe(650 + 533 + 20 + 333)
    expect((await bankrollService.reconcile(playerId)).drift).toBe(0)
  })

  it('is idempotent — a third run credits nothing', async () => {
    await placeThreeBets()
    await recordResult(mvpPlayerId)

    const first = await settleMatchBets(matchId)
    expect(first).toEqual({ settled: 3, skipped: 0 })

    const balanceAfterFirst = await bankrollService.getBalance(playerId)
    expect(balanceAfterFirst).toBe(650 + 533 + 20 + 333)

    const second = await settleMatchBets(matchId)
    const third = await settleMatchBets(matchId)

    expect(second).toEqual({ settled: 0, skipped: 0 })
    expect(third).toEqual({ settled: 0, skipped: 0 })
    expect(await bankrollService.getBalance(playerId)).toBe(balanceAfterFirst)
    expect((await bankrollService.reconcile(playerId)).drift).toBe(0)
  })

  it('forfeits a losing MVP bet without touching the balance again', async () => {
    await bankrollService.placeBet({
      playerId, matchId, market: 'mvp', selection: playerId, stake: 100, oddsAtBet: 6.66,
    })
    await recordResult(mvpPlayerId) // someone else took the MVP

    await settleMatchBets(matchId)

    expect(await bankrollService.getBalance(playerId)).toBe(900)
    const [row] = await db.select().from(pronoBets).where(eq(pronoBets.matchId, matchId))
    expect(row!.status).toBe('lost')
    expect(row!.payout).toBe(0)
  })

  it('does nothing for a match with no recorded score', async () => {
    await placeThreeBets()

    const summary = await settleMatchBets(matchId)

    expect(summary).toEqual({ settled: 0, skipped: 0 })
    expect(await bankrollService.getBalance(playerId)).toBe(650)
  })
})
