import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { sql, eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { db } from '../../db'
import { users, groups, players, matches, pronoBets } from '../../db/schema'
import { bankrollService, wonPayout } from '../../services/pronos/bankroll.service'

const TEST_PREFIX = 'test-11-2-bankroll-'

describe('Bankroll ledger', () => {
  let userId: string
  let groupId: string
  let playerId: string
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
      id: groupId,
      organizerId: userId,
      name: `${TEST_PREFIX}group`,
      formatPreset: '5v5',
      goalkeeperMode: 'none',
      generatorStyle: 'pure_ovr',
    })

    playerId = randomUUID()
    // pronosBalance is deliberately NOT specified — the column default must land.
    await db.insert(players).values({
      id: playerId,
      groupId,
      userId,
      displayName: `${TEST_PREFIX}player`,
    })

    matchId = randomUUID()
    await db.insert(matches).values({
      id: matchId,
      groupId,
      organizerId: userId,
      status: 'teams_generated',
      scheduledAt: new Date(Date.now() + 3_600_000),
      format: '5v5',
      playersPerTeam: 5,
      goalkeeperMode: 'none',
    })
  })

  afterEach(async () => {
    // FK order: prono_bets → matches → players → groups → users
    await db.delete(pronoBets).where(eq(pronoBets.matchId, matchId))
    await db.delete(matches).where(eq(matches.id, matchId))
    await db.delete(players).where(sql`display_name LIKE ${TEST_PREFIX + '%'}`)
    await db.delete(groups).where(sql`name LIKE ${TEST_PREFIX + '%'}`)
    await db.delete(users).where(sql`clerk_user_id LIKE ${TEST_PREFIX + '%'}`)
  })

  it('gives a new player the starting bankroll from the column default', async () => {
    expect(await bankrollService.getBalance(playerId)).toBe(1000)
    expect(await bankrollService.getAuditedBalance(playerId)).toBe(1000)
  })

  it('debits the stake atomically and keeps the ledger in agreement', async () => {
    const { bet, balance } = await bankrollService.placeBet({
      playerId,
      matchId,
      market: 'result',
      selection: 'teamA',
      stake: 250,
      oddsAtBet: 2.13,
    })

    expect(balance).toBe(750)
    expect(bet.status).toBe('pending')
    expect(bet.payout).toBeNull()
    expect(bet.settledAt).toBeNull()
    // numeric round-trips as a string — the cote is frozen, not re-priced.
    expect(bet.oddsAtBet).toBe('2.13')
    expect(Number(bet.oddsAtBet)).toBe(2.13)

    expect(await bankrollService.getBalance(playerId)).toBe(750)
    expect(await bankrollService.getAuditedBalance(playerId)).toBe(750)
    expect((await bankrollService.reconcile(playerId)).drift).toBe(0)
  })

  it('rolls back entirely when the stake exceeds the balance', async () => {
    // Two legal bets drain the bankroll to 50, below a third bet that is still under the
    // per-bet cap — so this fails on funds, not on PRONOS_MAX_STAKE.
    for (const stake of [500, 450]) {
      await bankrollService.placeBet({
        playerId,
        matchId,
        market: 'result',
        selection: 'teamA',
        stake,
        oddsAtBet: 2.13,
      })
    }
    expect(await bankrollService.getBalance(playerId)).toBe(50)

    await expect(
      bankrollService.placeBet({
        playerId,
        matchId,
        market: 'result',
        selection: 'teamB',
        stake: 450,
        oddsAtBet: 3.38,
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' })

    expect(await bankrollService.getBalance(playerId)).toBe(50)
    const rows = await db.select().from(pronoBets).where(eq(pronoBets.matchId, matchId))
    expect(rows).toHaveLength(2) // the failed bet left no ledger row
  })

  it('credits a winning settlement once and is idempotent on replay', async () => {
    const { bet } = await bankrollService.placeBet({
      playerId,
      matchId,
      market: 'result',
      selection: 'teamA',
      stake: 250,
      oddsAtBet: 2.13,
    })

    const payout = wonPayout(bet.stake, Number(bet.oddsAtBet))
    expect(payout).toBe(533)

    const settled = await db.transaction((tx) =>
      bankrollService.settleBet(tx, { betId: bet.id, status: 'won', payout }),
    )
    expect(settled?.status).toBe('won')
    expect(settled?.payout).toBe(533)
    expect(settled?.settledAt).not.toBeNull()

    expect(await bankrollService.getBalance(playerId)).toBe(1283)
    expect(await bankrollService.getAuditedBalance(playerId)).toBe(1283)
    expect((await bankrollService.reconcile(playerId)).drift).toBe(0)

    // Replay must not double-credit.
    const replay = await db.transaction((tx) =>
      bankrollService.settleBet(tx, { betId: bet.id, status: 'won', payout }),
    )
    expect(replay).toBeNull()
    expect(await bankrollService.getBalance(playerId)).toBe(1283)
  })

  it('refunds the close fraction on a near-miss correct-score bet', async () => {
    const { bet } = await bankrollService.placeBet({
      playerId,
      matchId,
      market: 'score',
      selection: '3-2',
      stake: 100,
      oddsAtBet: 8.5,
    })

    await db.transaction((tx) =>
      bankrollService.settleBet(tx, {
        betId: bet.id,
        status: 'close',
        payout: bankrollService.closeRefund(bet.stake),
      }),
    )

    expect(await bankrollService.getBalance(playerId)).toBe(940) // 1000 − 100 + 40
    expect(await bankrollService.getAuditedBalance(playerId)).toBe(940)
  })

  it('forfeits the stake on a losing settlement without touching the balance again', async () => {
    const { bet } = await bankrollService.placeBet({
      playerId,
      matchId,
      market: 'result',
      selection: 'teamA',
      stake: 200,
      oddsAtBet: 2.13,
    })

    await db.transaction((tx) =>
      bankrollService.settleBet(tx, { betId: bet.id, status: 'lost', payout: 0 }),
    )

    expect(await bankrollService.getBalance(playerId)).toBe(800)
    expect(await bankrollService.getAuditedBalance(playerId)).toBe(800)
  })

  it('accepts multiple bets from the same player on the same match', async () => {
    await bankrollService.placeBet({
      playerId,
      matchId,
      market: 'result',
      selection: 'teamA',
      stake: 100,
      oddsAtBet: 2.13,
    })
    await bankrollService.placeBet({
      playerId,
      matchId,
      market: 'score',
      selection: '3-2',
      stake: 50,
      oddsAtBet: 8.5,
    })
    await bankrollService.placeBet({
      playerId,
      matchId,
      market: 'mvp',
      selection: playerId,
      stake: 25,
      oddsAtBet: 6,
    })

    const rows = await db.select().from(pronoBets).where(eq(pronoBets.matchId, matchId))
    expect(rows).toHaveLength(3)
    expect(await bankrollService.getBalance(playerId)).toBe(825)
    expect((await bankrollService.reconcile(playerId)).drift).toBe(0)
  })
})
