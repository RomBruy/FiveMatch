import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { inArray } from 'drizzle-orm'
import { db } from '../../db'
import {
  matchAttendances,
  matchParticipants,
  matchSeries,
  matches,
  players,
  ratings,
  users,
} from '../../db/schema'
import { attentionService } from '../../services/matches/attention.service'
import { phase3Fixtures as fx, phase3SyntheticIdentity as identity } from '../fixtures/phase3-fixtures'

const ALL_USER_IDS = Object.values(fx.users)
const ALL_PLAYER_IDS = Object.values(fx.players)
const ALL_MATCH_IDS = [...Object.values(fx.matches), ...fx.windowMatches]

const ME_USER = fx.users.host
const ME_PLAYER = fx.players.host
const OTHER_PLAYER = fx.players.attended

const RECENT = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
const SOON = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)

async function cleanup() {
  await db.delete(ratings).where(inArray(ratings.matchId, ALL_MATCH_IDS))
  await db.delete(matchAttendances).where(inArray(matchAttendances.matchId, ALL_MATCH_IDS))
  await db.delete(matchParticipants).where(inArray(matchParticipants.matchId, ALL_MATCH_IDS))
  await db.delete(matches).where(inArray(matches.id, ALL_MATCH_IDS))
  await db.delete(matchSeries).where(inArray(matchSeries.hostId, ALL_USER_IDS))
  await db.delete(players).where(inArray(players.id, ALL_PLAYER_IDS))
  await db.delete(users).where(inArray(users.id, ALL_USER_IDS))
}

async function seedIdentities() {
  const keys = Object.keys(fx.users) as Array<keyof typeof fx.users>
  await db.insert(users).values(keys.map((key) => ({
    id: fx.users[key], clerkUserId: identity.clerkId(`p6a-${key}`), email: identity.email(`p6a-${key}`),
  })))
  await db.insert(players).values(keys.map((key) => ({
    id: fx.players[key], userId: fx.users[key], displayName: identity.name(key), ovrScoreFloat: '65.000',
  })))
}

async function seedMatch(matchId: string, options: {
  scheduledAt: Date
  status?: 'attendance_open' | 'completed' | 'cancelled'
  scored?: boolean
  finalized?: boolean
  iPlayed?: boolean
  myRsvp?: 'in' | 'out' | 'unknown'
  voided?: boolean
}) {
  const {
    scheduledAt, status = 'completed', scored = true,
    finalized = true, iPlayed = false, myRsvp, voided = false,
  } = options

  await db.insert(matches).values({
    id: matchId,
    groupId: null,
    hostId: ME_USER,
    status,
    scheduledAt,
    completedAt: status === 'completed' ? scheduledAt : null,
    format: '5v5',
    playersPerTeam: 5,
    goalkeeperMode: 'none',
    generatorStyle: 'pure_ovr',
    scoreA: scored ? 2 : null,
    scoreB: scored ? 1 : null,
    voidedAt: voided ? new Date() : null,
    hostPlays: false,
  })

  if (iPlayed) {
    await db.insert(matchParticipants).values([
      { matchId, playerId: ME_PLAYER, userId: ME_USER, displayName: identity.name('me'), teamSide: 'A' as const },
      { matchId, playerId: OTHER_PLAYER, userId: fx.users.attended, displayName: identity.name('other'), teamSide: 'B' as const },
    ])
  }

  if (myRsvp) {
    await db.insert(matchAttendances).values({
      matchId,
      playerId: ME_PLAYER,
      status: myRsvp,
      finalizedAt: finalized ? scheduledAt : null,
      outcome: finalized ? ('attended' as const) : null,
    })
  }
}

const typesOf = async () =>
  (await attentionService.getAttention(ME_USER, ME_PLAYER)).map((item) => item.type)

beforeEach(async () => {
  await cleanup()
  await seedIdentities()
})

afterEach(cleanup)

describe('Phase 6 needs-attention', () => {
  it('is empty when nothing is waiting', async () => {
    expect(await typesOf()).toEqual([])
  })

  it('flags a played match with no score', async () => {
    await seedMatch(fx.windowMatches[0], {
      scheduledAt: RECENT, status: 'attendance_open', scored: false,
    })
    expect(await typesOf()).toEqual(['record_result'])
  })

  it('flags a scored match whose sheet is unsettled', async () => {
    await seedMatch(fx.windowMatches[0], {
      scheduledAt: RECENT, finalized: false, myRsvp: 'in',
    })
    expect(await typesOf()).toContain('finalize_attendance')
  })

  it('flags a completed match this player has not rated', async () => {
    await seedMatch(fx.windowMatches[0], { scheduledAt: RECENT, iPlayed: true })
    expect(await typesOf()).toContain('rate_opponents')
  })

  it('stops flagging ratings once any have been submitted', async () => {
    await seedMatch(fx.windowMatches[0], { scheduledAt: RECENT, iPlayed: true })
    await db.insert(ratings).values({
      matchId: fx.windowMatches[0],
      raterPlayerId: ME_PLAYER,
      ratedPlayerId: OTHER_PLAYER,
      pace: 7, technique: 7, passing: 7, defending: 7, physicality: 7, effort: 7, mentality: 7,
      isInitial: false,
    })
    expect(await typesOf()).not.toContain('rate_opponents')
  })

  it('flags an unanswered RSVP on an upcoming match', async () => {
    await seedMatch(fx.windowMatches[0], {
      scheduledAt: SOON, status: 'attendance_open', scored: false, myRsvp: 'unknown', finalized: false,
    })
    const types = await typesOf()
    expect(types).toContain('answer_rsvp')
    // Not yet played, so there is no result to chase.
    expect(types).not.toContain('record_result')
  })

  it('does not chase an RSVP that has been answered', async () => {
    await seedMatch(fx.windowMatches[0], {
      scheduledAt: SOON, status: 'attendance_open', scored: false, myRsvp: 'in', finalized: false,
    })
    expect(await typesOf()).not.toContain('answer_rsvp')
  })

  it('ignores cancelled and voided matches', async () => {
    await seedMatch(fx.windowMatches[0], {
      scheduledAt: RECENT, status: 'cancelled', scored: false,
    })
    await seedMatch(fx.windowMatches[1], {
      scheduledAt: RECENT, iPlayed: true, voided: true,
    })

    // Neither is anyone's problem any more.
    expect(await typesOf()).toEqual([])
  })

  it('ignores matches older than the lookback window', async () => {
    const longAgo = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000)
    await seedMatch(fx.windowMatches[0], {
      scheduledAt: longAgo, status: 'attendance_open', scored: false,
    })
    expect(await typesOf()).toEqual([])
  })

  it('orders by how much others are blocked', async () => {
    await seedMatch(fx.windowMatches[0], {
      scheduledAt: SOON, status: 'attendance_open', scored: false, myRsvp: 'unknown', finalized: false,
    })
    await seedMatch(fx.windowMatches[1], { scheduledAt: RECENT, iPlayed: true })
    await seedMatch(fx.windowMatches[2], {
      scheduledAt: RECENT, status: 'attendance_open', scored: false,
    })

    // A missing result holds up everyone's ratings and cards; an unanswered
    // RSVP only affects the person who owes it.
    expect(await typesOf()).toEqual(['record_result', 'rate_opponents', 'answer_rsvp'])
  })
})
