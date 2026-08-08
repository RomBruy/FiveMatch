import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../db', () => ({ db: { select: vi.fn() } }))
vi.mock('../../services/cards/card-generation.service', () => ({
  cardGenerationService: { getStatus: vi.fn().mockResolvedValue({ state: 'idle' }) },
}))
vi.mock('../../jobs/card-generation.job', () => ({ processCardGenerationJob: vi.fn() }))

import { db } from '../../db'
import { cardGenerationService } from '../../services/cards/card-generation.service'
import router from './index'

function selectOwner(userId: string | null) {
  const chain = { from: vi.fn(), where: vi.fn(), limit: vi.fn() }
  chain.from.mockReturnValue(chain)
  chain.where.mockReturnValue(chain)
  chain.limit.mockResolvedValue(userId ? [{ userId }] : [])
  return chain as unknown as ReturnType<typeof db.select>
}

function app() {
  const instance = express()
  instance.use((req, _res, next) => {
    req.user = { userId: 'clerk-owner', internalId: 'internal-owner', playerId: 'player-owner' }
    next()
  })
  instance.use('/players/:playerId/card-photo', router)
  return instance
}

describe('card photo status privacy', () => {
  beforeEach(() => vi.clearAllMocks())

  it('allows the owner to view processing state', async () => {
    vi.mocked(db.select).mockReturnValue(selectOwner('internal-owner'))
    const response = await request(app()).get('/players/player-owner/card-photo/status')
    expect(response.status).toBe(200)
    expect(cardGenerationService.getStatus).toHaveBeenCalledWith('player-owner')
  })

  it('does not expose another player consent/job state', async () => {
    vi.mocked(db.select).mockReturnValue(selectOwner('internal-someone-else'))
    const response = await request(app()).get('/players/player-other/card-photo/status')
    expect(response.status).toBe(403)
    expect(cardGenerationService.getStatus).not.toHaveBeenCalled()
  })
})
