import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

vi.mock('@clerk/express', () => ({
  clerkMiddleware: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
  requireAuth: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
  getAuth: vi.fn(),
}))

import { getAuth } from '@clerk/express'
import { attachUser } from './auth'

describe('attachUser middleware', () => {
  let req: Partial<Request>
  let res: Partial<Response>
  let next: NextFunction

  beforeEach(() => {
    req = {}
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }
    next = vi.fn()
  })

  it('attaches req.user.userId when auth is valid', () => {
    vi.mocked(getAuth).mockReturnValue({ userId: 'user_123' } as ReturnType<typeof getAuth>)
    attachUser(req as Request, res as Response, next)
    expect((req as Request).user).toEqual({ userId: 'user_123' })
    expect(next).toHaveBeenCalled()
  })

  it('returns 401 when userId is null', () => {
    vi.mocked(getAuth).mockReturnValue({ userId: null } as ReturnType<typeof getAuth>)
    attachUser(req as Request, res as Response, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ statusCode: 401 }) })
    )
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when userId is undefined', () => {
    vi.mocked(getAuth).mockReturnValue({ userId: undefined } as unknown as ReturnType<typeof getAuth>)
    attachUser(req as Request, res as Response, next)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
