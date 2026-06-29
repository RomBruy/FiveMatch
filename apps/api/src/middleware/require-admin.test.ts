import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { requireAdmin } from './require-admin'

describe('requireAdmin middleware', () => {
  let req: Partial<Request>
  let res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> }
  let next: NextFunction
  const originalEnv = process.env.ADMIN_USER_IDS

  beforeEach(() => {
    req = { user: { userId: 'user_xyz' } }
    const jsonFn = vi.fn().mockReturnThis()
    const statusFn = vi.fn().mockReturnValue({ json: jsonFn })
    res = { status: statusFn, json: jsonFn }
    next = vi.fn()
    delete process.env.ADMIN_USER_IDS
  })

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ADMIN_USER_IDS = originalEnv
    } else {
      delete process.env.ADMIN_USER_IDS
    }
  })

  it('returns 403 with FORBIDDEN when ADMIN_USER_IDS is not set', () => {
    requireAdmin(req as Request, res as unknown as Response, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'FORBIDDEN', statusCode: 403 }) }),
    )
    // ADMIN_USER_IDS must never appear in response
    const jsonArg = JSON.stringify(res.json.mock.calls[0])
    expect(jsonArg).not.toContain('ADMIN_USER_IDS')
  })

  it('returns 403 when ADMIN_USER_IDS is an empty string', () => {
    process.env.ADMIN_USER_IDS = ''

    requireAdmin(req as Request, res as unknown as Response, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'FORBIDDEN' }) }),
    )
  })

  it('returns 403 when user is not in the ADMIN_USER_IDS list', () => {
    process.env.ADMIN_USER_IDS = 'user_abc,user_def'
    ;(req as Request).user.userId = 'user_xyz'

    requireAdmin(req as Request, res as unknown as Response, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'FORBIDDEN' }) }),
    )
    // ADMIN_USER_IDS contents must never appear in the response body
    const jsonArg = JSON.stringify(res.json.mock.calls[0])
    expect(jsonArg).not.toContain('user_abc')
    expect(jsonArg).not.toContain('user_def')
  })

  it('calls next() when user is in the ADMIN_USER_IDS list', () => {
    process.env.ADMIN_USER_IDS = 'user_abc,user_def'
    ;(req as Request).user.userId = 'user_abc'

    requireAdmin(req as Request, res as unknown as Response, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('trims whitespace around IDs — user_abc with spaces in env passes', () => {
    process.env.ADMIN_USER_IDS = ' user_abc '
    ;(req as Request).user.userId = 'user_abc'

    requireAdmin(req as Request, res as unknown as Response, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })
})
