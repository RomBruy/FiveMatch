import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

vi.mock('../db', () => ({
  db: {
    select: vi.fn(),
  },
}))

import { db } from '../db'
import { requireGroupMember } from './require-group-member'

describe('requireGroupMember middleware', () => {
  let req: Partial<Request>
  let res: Partial<Response>
  let next: NextFunction

  beforeEach(() => {
    req = {
      params: { groupId: 'group-uuid-123' },
      user: { userId: 'clerk_user_abc' },
    }
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    }
    next = vi.fn()
    vi.clearAllMocks()
  })

  it('calls next() and attaches groupRole=member for a valid member', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue({
        then: (fn: (rows: { internalId: string; role: string }[]) => void) =>
          Promise.resolve(fn([{ internalId: 'internal-uuid-1', role: 'member' }])),
        catch: vi.fn().mockReturnThis(),
      }),
    } as unknown as ReturnType<typeof db.select>)

    requireGroupMember(req as Request, res as Response, next)
    await new Promise((r) => setTimeout(r, 0))

    expect(next).toHaveBeenCalled()
    expect((req as Request).user.groupRole).toBe('member')
    expect((req as Request).user.internalId).toBe('internal-uuid-1')
  })

  it('calls next() and attaches groupRole=organizer for a valid organizer', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue({
        then: (fn: (rows: { internalId: string; role: string }[]) => void) =>
          Promise.resolve(fn([{ internalId: 'internal-uuid-2', role: 'organizer' }])),
        catch: vi.fn().mockReturnThis(),
      }),
    } as unknown as ReturnType<typeof db.select>)

    requireGroupMember(req as Request, res as Response, next)
    await new Promise((r) => setTimeout(r, 0))

    expect(next).toHaveBeenCalled()
    expect((req as Request).user.groupRole).toBe('organizer')
  })

  it('returns 403 when no membership row found (non-member or pending_member filtered out)', async () => {
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue({
        then: (fn: (rows: { internalId: string; role: string }[]) => void) =>
          Promise.resolve(fn([])),
        catch: vi.fn().mockReturnThis(),
      }),
    } as unknown as ReturnType<typeof db.select>)

    requireGroupMember(req as Request, res as Response, next)
    await new Promise((r) => setTimeout(r, 0))

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'NOT_A_MEMBER', statusCode: 403 }) }),
    )
  })

  it('calls next(err) when db throws', async () => {
    const dbError = new Error('DB connection failed')
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue({
        then: (_fn: unknown) => ({ catch: (onRejected: (err: unknown) => void) => onRejected(dbError) }),
      }),
    } as unknown as ReturnType<typeof db.select>)

    requireGroupMember(req as Request, res as Response, next)
    await new Promise((r) => setTimeout(r, 0))

    expect(next).toHaveBeenCalledWith(dbError)
  })
})
