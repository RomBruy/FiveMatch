import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../../db', () => ({
  db: {
    select: vi.fn(),
  },
}))

vi.mock('../../../db/schema', () => ({
  players: {
    id: 'id',
    groupId: 'group_id',
    userId: 'user_id',
    cardState: 'card_state',
    matchCount: 'match_count',
    ovrScore: 'ovr_score',
    ovrScoreFloat: 'ovr_score_float',
    previousOvrScoreFloat: 'previous_ovr_score_float',
    avgPace: 'avg_pace',
    avgTechnique: 'avg_technique',
    avgPassing: 'avg_passing',
    avgDefending: 'avg_defending',
    avgPhysicality: 'avg_physicality',
    avgEffort: 'avg_effort',
    deletedAt: 'deleted_at',
    profilePhotoCardUrl: 'profile_photo_card_url',
  },
  users: {
    id: 'id',
    name: 'name',
    profilePhotoUrl: 'profile_photo_url',
    currentClub: 'current_club',
    formerClub: 'former_club',
    preferredPosition: 'preferred_position',
    strongFoot: 'strong_foot',
    playerStyle: 'player_style',
    specialSkill: 'special_skill',
    favoriteExcuse: 'favorite_excuse',
    badFaithLevel: 'bad_faith_level',
    lockerRoomStyle: 'locker_room_style',
    thirdHalfProfile: 'third_half_profile',
  },
  matches: {
    id: 'id',
    groupId: 'group_id',
    status: 'status',
    scheduledAt: 'scheduled_at',
    scoreA: 'score_a',
    scoreB: 'score_b',
    mvpPlayerId: 'mvp_player_id',
    mvpVotingResolvedAt: 'mvp_voting_resolved_at',
  },
  matchParticipants: { matchId: 'match_id', playerId: 'player_id' },
}))

vi.mock('../../../middleware/require-group-member', () => ({
  requireGroupMember: vi.fn(
    (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.user.internalId = 'internal-uuid-1'
      req.user.groupRole = 'member'
      next()
    },
  ),
}))

vi.mock('../../../services/players/ovr.service', () => ({
  ovrService: {
    getOvrForDisplay: vi.fn((ovrScore: number | null, matchCount: number) =>
      matchCount >= 4 ? ovrScore : null,
    ),
  },
}))

import { db } from '../../../db'
import playersRouter from '../index'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    ;(req as express.Request & { user: { userId: string; internalId?: string; groupRole?: string } }).user =
      { userId: 'clerk-user-1' }
    next()
  })
  app.use('/groups/:groupId/players', playersRouter)
  return app
}

describe('GET /groups/:groupId/players', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns player list with correct shape and no raterPlayerId', async () => {
    const mockRows = [
      {
        id: 'player-uuid-1',
        displayName: 'Marcus Test',
        cardState: 'in_progress_2',
        matchCount: 1,
        ovrScore: null,
        avgPace: '7.50',
        avgTechnique: '6.00',
        avgPassing: '5.50',
        avgDefending: '4.00',
        avgPhysicality: '6.50',
        avgEffort: '8.00',
      },
    ]

    const selectChain = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn() }
    selectChain.from.mockReturnValue(selectChain)
    selectChain.innerJoin.mockReturnValue(selectChain)
    selectChain.where.mockResolvedValue(mockRows)
    vi.mocked(db.select).mockReturnValue(selectChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/groups/group-uuid-1/players')

    expect(res.status).toBe(200)
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.hasMore).toBe(false)

    const item = res.body.data.items[0]
    expect(item.playerId).toBe('player-uuid-1')
    expect(item.displayName).toBe('Marcus Test')
    expect(item.cardState).toBe('in_progress_2')
    expect(item.matchCount).toBe(1)
    // raterPlayerId must never appear
    expect(item).not.toHaveProperty('raterPlayerId')
    expect(item.attributes).toBeDefined()
    expect(item.attributes.pace).toBe(7.5)
    expect(item.attributes.technique).toBe(6.0)
  })

  it('returns ovrScore null when matchCount < 4', async () => {
    const mockRows = [
      {
        id: 'player-uuid-2',
        displayName: 'Thomas Test',
        cardState: 'in_progress_3',
        matchCount: 3,
        ovrScore: 72,
        avgPace: '7.00',
        avgTechnique: '7.00',
        avgPassing: '7.00',
        avgDefending: '7.00',
        avgPhysicality: '7.00',
        avgEffort: '7.00',
      },
    ]

    const selectChain = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn() }
    selectChain.from.mockReturnValue(selectChain)
    selectChain.innerJoin.mockReturnValue(selectChain)
    selectChain.where.mockResolvedValue(mockRows)
    vi.mocked(db.select).mockReturnValue(selectChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/groups/group-uuid-1/players')

    expect(res.status).toBe(200)
    // getOvrForDisplay returns null when matchCount < 4
    expect(res.body.data.items[0].ovrScore).toBeNull()
  })

  it('returns null attributes when no initial ratings yet', async () => {
    const mockRows = [
      {
        id: 'player-uuid-3',
        displayName: 'New Player',
        cardState: 'not_started',
        matchCount: 0,
        ovrScore: null,
        avgPace: null,
        avgTechnique: null,
        avgPassing: null,
        avgDefending: null,
        avgPhysicality: null,
        avgEffort: null,
      },
    ]

    const selectChain = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn() }
    selectChain.from.mockReturnValue(selectChain)
    selectChain.innerJoin.mockReturnValue(selectChain)
    selectChain.where.mockResolvedValue(mockRows)
    vi.mocked(db.select).mockReturnValue(selectChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/groups/group-uuid-1/players')

    expect(res.status).toBe(200)
    expect(res.body.data.items[0].attributes).toBeNull()
    expect(res.body.data.items[0].ovrScore).toBeNull()
  })

  it('returns the player personality and tightest group match', async () => {
    const playerRow = {
      id: 'player-uuid-4',
      displayName: 'Nico',
      cardState: 'unlocked',
      matchCount: 8,
      ovrScoreFloat: '77.40',
      previousOvrScoreFloat: null,
      avgPace: '75.00',
      avgTechnique: '72.00',
      avgPassing: '78.00',
      avgDefending: '68.00',
      avgPhysicality: '70.00',
      avgEffort: '82.00',
      profilePhotoCardUrl: null,
      profilePhotoUrl: 'https://example.com/nico.jpg',
      currentClub: 'FC Five',
      formerClub: null,
      preferredPosition: 'midfielder',
      strongFoot: 'right',
      playerStyle: 'playmaker',
      specialSkill: 'Frappe en tribune',
      favoriteExcuse: "J'ai pris une cuite hier",
      badFaithLevel: 2,
      lockerRoomStyle: 'Clown',
      thirdHalfProfile: "C'est moi qui ferme",
    }
    const tightestRow = { scheduledAt: new Date('2026-03-25T18:00:00Z'), scoreA: 16, scoreB: 11 }

    const detailChain = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn(), limit: vi.fn() }
    detailChain.from.mockReturnValue(detailChain)
    detailChain.innerJoin.mockReturnValue(detailChain)
    detailChain.where.mockReturnValue(detailChain)
    detailChain.limit.mockResolvedValue([playerRow])

    const mvpChain = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn() }
    mvpChain.from.mockReturnValue(mvpChain)
    mvpChain.where.mockReturnValue(mvpChain)
    mvpChain.orderBy.mockReturnValue(mvpChain)
    mvpChain.limit.mockResolvedValue([{ mvpPlayerId: 'player-uuid-4' }])

    const historyChain = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn() }
    historyChain.from.mockReturnValue(historyChain)
    historyChain.innerJoin.mockReturnValue(historyChain)
    historyChain.where.mockReturnValue(historyChain)
    historyChain.orderBy.mockReturnValue(historyChain)
    historyChain.limit.mockResolvedValue([tightestRow])

    vi.mocked(db.select)
      .mockReturnValueOnce(detailChain as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce(mvpChain as unknown as ReturnType<typeof db.select>)
      .mockReturnValueOnce(historyChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/groups/group-uuid-1/players/player-uuid-4')

    expect(res.status).toBe(200)
    expect(res.body.data.personality).toEqual(expect.objectContaining({
      specialSkill: 'Frappe en tribune',
      badFaithLevel: 2,
      lockerRoomStyle: 'Clown',
    }))
    expect(res.body.data.memory.tightestMatch).toEqual(expect.objectContaining({ scoreA: 16, scoreB: 11 }))
    expect(res.body.data.photoUrl).toBe('https://example.com/nico.jpg')
    expect(res.body.data.isMvp).toBe(true)
  })
})
