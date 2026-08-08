import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../../services/players/player-profile.service', () => ({
  playerProfileService: {
    getPublicProfile: vi.fn(),
    getPrivateProfile: vi.fn(),
    updateVisibility: vi.fn(),
  },
}))
vi.mock('../../../services/pronos/bankroll.service', () => ({
  bankrollService: { getBalance: vi.fn().mockResolvedValue(1000) },
}))

import router from '../index'
import { playerProfileService } from '../../../services/players/player-profile.service'

function app(playerId?: string) {
  const instance = express()
  instance.use(express.json())
  instance.use((req, _res, next) => {
    req.user = {
      userId: 'clerk-viewer',
      internalId: 'internal-viewer',
      ...(playerId ? { playerId } : {}),
    }
    next()
  })
  instance.use('/players', router)
  return instance
}

const publicProfile = {
  playerId: 'player-target',
  displayName: 'Target',
  skillLevel: 'casual',
  eligibleMatchCount: 4,
  cardState: 'unlocked',
  ovrScore: 70,
  trend: 'stable',
  reliability: 100,
  ratingAggregate: null,
}

describe('separate player profile routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the audience-filtered public serializer', async () => {
    vi.mocked(playerProfileService.getPublicProfile).mockResolvedValue(publicProfile as never)
    const response = await request(app('player-viewer')).get('/players/player-target')
    expect(response.status).toBe(200)
    expect(response.body.data).toEqual(publicProfile)
    expect(playerProfileService.getPublicProfile).toHaveBeenCalledWith(
      'player-target', 'internal-viewer', 'player-viewer',
    )
    expect(JSON.stringify(response.body)).not.toContain('visibility')
  })

  it('uses the owner-only serializer for /me', async () => {
    vi.mocked(playerProfileService.getPrivateProfile).mockResolvedValue({
      ...publicProfile, isOwner: true, isAdmin: false, visibility: {},
    } as never)
    const response = await request(app('player-viewer')).get('/players/me')
    expect(response.status).toBe(200)
    expect(response.body.data.isOwner).toBe(true)
    expect(playerProfileService.getPrivateProfile).toHaveBeenCalledWith('player-viewer', 'clerk-viewer')
  })

  it('returns 404 when a profile is absent', async () => {
    vi.mocked(playerProfileService.getPublicProfile).mockResolvedValue(null)
    expect((await request(app()).get('/players/missing')).status).toBe(404)
  })

  it('rejects /me before onboarding', async () => {
    expect((await request(app()).get('/players/me')).status).toBe(404)
  })

  it('updates only a complete visibility object', async () => {
    const visibility = {
      profilePhoto: 'private', generatedCardPhoto: 'private', currentClub: 'private', formerClub: 'private',
      preferredPosition: 'private', strongFoot: 'private', playerStyle: 'private', specialSkill: 'private',
      favoriteExcuse: 'private', badFaithLevel: 'private', lockerRoomStyle: 'private', thirdHalfProfile: 'private',
    } as const
    vi.mocked(playerProfileService.updateVisibility).mockResolvedValue(visibility)
    const response = await request(app('player-viewer')).patch('/players/me/visibility').send(visibility)
    expect(response.status).toBe(200)
    expect(playerProfileService.updateVisibility).toHaveBeenCalledWith('internal-viewer', visibility)
  })

  it('returns the global bankroll without profile internals', async () => {
    const response = await request(app('player-viewer')).get('/players/me/bankroll')
    expect(response.status).toBe(200)
    expect(response.body.data.balance).toBe(1000)
  })
})
