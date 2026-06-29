import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// Mock DB before importing the router
vi.mock('../../db', () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}))

vi.mock('../../db/schema', () => ({
  users: { clerkUserId: 'clerk_user_id' },
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

  it('returns user data when found', async () => {
    const mockUser = {
      id: 'uuid-1',
      clerkUserId: 'user_abc',
      name: 'Alice',
      email: 'alice@example.com',
      languagePreference: 'en',
      profilePhotoUrl: null,
    }

    const limitMock = vi.fn().mockResolvedValue([mockUser])
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
    const fromMock = vi.fn().mockReturnValue({ where: whereMock })
    vi.mocked(db.select).mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/auth/me')

    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('Alice')
  })

  it('returns 404 when user not found', async () => {
    const limitMock = vi.fn().mockResolvedValue([])
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock })
    const fromMock = vi.fn().mockReturnValue({ where: whereMock })
    vi.mocked(db.select).mockReturnValue({ from: fromMock } as unknown as ReturnType<typeof db.select>)

    const res = await request(buildApp()).get('/auth/me')

    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('NOT_FOUND')
  })
})
