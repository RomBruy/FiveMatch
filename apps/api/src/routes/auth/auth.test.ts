import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// Mock DB before importing the router
vi.mock('../../db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../../db/schema', () => ({
  ACTIVE_CREW_ROLES: ['organizer', 'co_host', 'member'],
  users: { clerkUserId: 'clerk_user_id', id: 'id' },
  players: { userId: 'user_id', skillLevel: 'skill_level' },
}))

vi.mock('@clerk/express', () => ({
  requireAuth: vi.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  getAuth: vi.fn(),
}))

import { db } from '../../db'
import authRouter from './index'

function buildApp(userId = 'user_abc') {
  const app = express()
  app.use(express.json())
  app.use((req, _res, next) => {
    ;(req as express.Request & { user: { userId: string } }).user = { userId }
    next()
  })
  app.use('/auth', authRouter)
  return app
}

describe('POST /auth/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('upserts and returns the user', async () => {
    const mockUser = {
      id: 'uuid-1',
      clerkUserId: 'user_abc',
      name: 'Alice',
      email: 'alice@example.com',
      languagePreference: 'en',
      profilePhotoUrl: null,
    }

    const returningMock = vi.fn().mockResolvedValue([mockUser])
    const onConflictMock = vi.fn().mockReturnValue({ returning: returningMock })
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock })
    vi.mocked(db.insert).mockReturnValue({ values: valuesMock } as unknown as ReturnType<typeof db.insert>)

    const res = await request(buildApp())
      .post('/auth/sync')
      .send({ email: 'alice@example.com', name: 'Alice', languagePreference: 'en' })

    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('Alice')
    expect(res.body.data.email).toBe('alice@example.com')
  })

  it('returns 400 for invalid body (missing email)', async () => {
    // ZodError is thrown — but we need the error handler in the app too
    const app = buildApp()
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message, statusCode: 400 } })
    })

    const res = await request(app).post('/auth/sync').send({ name: 'Alice' })
    expect(res.status).toBe(400)
  })
})

describe('GET /auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /** Two selects now: the user row, then the player row that carries the level. */
  function mockSelects(...results: unknown[][]) {
    let call = 0
    vi.mocked(db.select).mockImplementation(() => {
      const result = results[Math.min(call, results.length - 1)] ?? []
      call += 1
      const limitMock = vi.fn().mockResolvedValue(result)
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
      const fromMock = vi.fn().mockReturnValue({ where: whereMock })
      return { from: fromMock } as unknown as ReturnType<typeof db.select>
    })
  }

  it('returns user data when found', async () => {
    const mockUser = {
      id: 'uuid-1',
      clerkUserId: 'user_abc',
      name: 'Alice',
      email: 'alice@example.com',
      languagePreference: 'en',
      profilePhotoUrl: null,
    }

    mockSelects([mockUser], [{ skillLevel: 'casual' }])

    const res = await request(buildApp()).get('/auth/me')

    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('Alice')
    expect(res.body.data.skillLevel).toBe('casual')
  })

  it('returns 404 when user not found', async () => {
    mockSelects([])

    const res = await request(buildApp()).get('/auth/me')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})

describe('PATCH /auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('completes the football profile', async () => {
    const updatedUser = {
      id: 'uuid-1',
      clerkUserId: 'user_abc',
      name: 'Nico',
      email: 'nico@example.com',
      languagePreference: 'fr',
      profilePhotoUrl: null,
      currentClub: 'FC Five',
      formerClub: 'ES Lanfonnet',
      preferredPosition: 'midfielder',
      strongFoot: 'right',
      playerStyle: 'playmaker',
      specialSkill: 'Frappe en tribune',
      favoriteExcuse: "J'ai pris une cuite hier",
      badFaithLevel: 2,
      lockerRoomStyle: 'Clown',
      thirdHalfProfile: "C'est moi qui ferme",
      onboardingCompletedAt: new Date(),
    }
    const returningMock = vi.fn().mockResolvedValue([updatedUser])
    const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
    const setMock = vi.fn().mockReturnValue({ where: whereMock })
    vi.mocked(db.update).mockReturnValue({ set: setMock } as unknown as ReturnType<typeof db.update>)

    // The player identity is upserted at the end of onboarding.
    const onConflictMock = vi.fn().mockResolvedValue(undefined)
    const insertValuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictMock })
    vi.mocked(db.insert).mockReturnValue({ values: insertValuesMock } as unknown as ReturnType<typeof db.insert>)

    const res = await request(buildApp())
      .patch('/auth/me')
      .send({
        name: 'Nico',
        languagePreference: 'fr',
        skillLevel: 'intermediate',
        profilePhotoUrl: null,
        currentClub: 'FC Five',
        formerClub: 'ES Lanfonnet',
        preferredPosition: 'midfielder',
        strongFoot: 'right',
        playerStyle: 'playmaker',
        specialSkill: 'Frappe en tribune',
        favoriteExcuse: "J'ai pris une cuite hier",
        badFaithLevel: 2,
        lockerRoomStyle: 'Clown',
        thirdHalfProfile: "C'est moi qui ferme",
      })

    expect(res.status).toBe(200)
    expect(res.body.data.onboardingCompletedAt).toBeTruthy()
    expect(setMock).toHaveBeenCalledWith(expect.objectContaining({
      currentClub: 'FC Five',
      preferredPosition: 'midfielder',
      playerStyle: 'playmaker',
      specialSkill: 'Frappe en tribune',
      badFaithLevel: 2,
      lockerRoomStyle: 'Clown',
    }))
    expect(insertValuesMock).toHaveBeenCalledWith(expect.objectContaining({
      skillLevel: 'intermediate',
    }))
  })

  it('rejects a bad-faith level outside 1 to 5', async () => {
    const app = buildApp()
    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: err.message, statusCode: 400 } })
    })

    const res = await request(app)
      .patch('/auth/me')
      .send({
        name: 'Nico',
        languagePreference: 'fr',
        profilePhotoUrl: null,
        currentClub: null,
        formerClub: null,
        preferredPosition: 'midfielder',
        strongFoot: 'right',
        playerStyle: 'playmaker',
        specialSkill: null,
        favoriteExcuse: null,
        badFaithLevel: 6,
        lockerRoomStyle: null,
        thirdHalfProfile: null,
      })

    expect(res.status).toBe(400)
  })
})
