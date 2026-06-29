import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(),
  },
}))

vi.mock('../../db/schema', () => ({
  groups: { id: 'id', name: 'name', organizerId: 'organizer_id', inviteCode: 'invite_code' },
  users: { id: 'id', name: 'name' },
  groupMemberships: { groupId: 'group_id', role: 'role' },
  pushTokens: { userId: 'user_id', token: 'token' },
  notificationPreferences: { userId: 'user_id', type: 'type', enabled: 'enabled' },
  NOTIFICATION_TYPES: [
    'JOIN_REQUEST_RECEIVED', 'JOIN_APPROVED', 'JOIN_REJECTED',
    'ATTENDANCE_REMINDER', 'MATCH_FULL', 'WAITLIST_SPOT_OPEN',
    'TEAMS_LOCKED', 'SCORE_SUBMITTED', 'MVP_VOTING_OPEN',
    'MVP_VOTING_REMINDER', 'CARD_UNLOCKED', 'PRONOS_WINDOW_OPEN',
    'PRONOS_REVEALED', 'PLAYER_TIER_CHANGED', 'RATING_REMINDER',
    'ORGANIZER_TRANSFERRED',
  ],
}))

vi.mock('@clerk/express', () => ({
  requireAuth: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  clerkMiddleware: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))

vi.mock('../../middleware/auth', () => ({
  attachUser: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  clerkMiddleware: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}))

import { db } from '../../db'
import apiRouter from '../index'

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/v1', apiRouter)
  return app
}

const mockGroup = {
  id: 'group-uuid-1',
  name: 'Les Potes FC',
  organizerId: 'organizer-uuid-1',
}

describe('GET /v1/invite/:code', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns invite preview for valid code (200)', async () => {
    const selectChain = { from: vi.fn(), where: vi.fn() }
    selectChain.from.mockReturnValue(selectChain)
    selectChain.where
      .mockResolvedValueOnce([mockGroup])           // group lookup
      .mockResolvedValueOnce([{ name: 'Thomas' }]) // organizer lookup
      .mockResolvedValueOnce([{ value: '7' }])     // member count

    vi.mocked(db.select).mockReturnValue(selectChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/v1/invite/ABC123XY')

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      groupId: 'group-uuid-1',
      groupName: 'Les Potes FC',
      organizerDisplayName: 'Thomas',
      memberCount: 7,
    })
  })

  it('returns 404 INVITE_CODE_NOT_FOUND for unknown code', async () => {
    const selectChain = { from: vi.fn(), where: vi.fn() }
    selectChain.from.mockReturnValue(selectChain)
    selectChain.where.mockResolvedValueOnce([]) // no group found

    vi.mocked(db.select).mockReturnValue(selectChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/v1/invite/BADCODE')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('INVITE_CODE_NOT_FOUND')
  })

  it('falls back to "Organizer" when organizer name is null', async () => {
    const selectChain = { from: vi.fn(), where: vi.fn() }
    selectChain.from.mockReturnValue(selectChain)
    selectChain.where
      .mockResolvedValueOnce([mockGroup])
      .mockResolvedValueOnce([{ name: null }])
      .mockResolvedValueOnce([{ value: '3' }])

    vi.mocked(db.select).mockReturnValue(selectChain as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/v1/invite/ABC123XY')

    expect(res.status).toBe(200)
    expect(res.body.data.organizerDisplayName).toBe('Organizer')
  })
})
