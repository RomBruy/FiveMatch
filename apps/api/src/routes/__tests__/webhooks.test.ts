import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

// ── Hoisted mocks ──────────────────────────────────────────────────────────────
vi.mock('../../db', () => ({ db: {} }))
vi.mock('../../db/schema', () => ({ users: {} }))
vi.mock('../../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('../../services/gdpr/gdpr.service', () => ({
  gdprService: { softDeleteUser: vi.fn() },
}))

const mockVerify = vi.fn()
vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({ verify: mockVerify })),
}))

import webhooksRouter from '../webhooks'
import { gdprService } from '../../services/gdpr/gdpr.service'

function buildApp() {
  const app = express()
  // Webhooks must be before express.json() — mirrors index.ts
  app.use('/v1/webhooks', webhooksRouter)
  app.use(express.json())
  return app
}

const VALID_HEADERS = {
  'svix-id': 'msg_abc',
  'svix-timestamp': '1700000000',
  'svix-signature': 'v1,abc123',
  'content-type': 'application/json',
}

describe('POST /v1/webhooks/clerk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_test'
  })

  it('returns 401 INVALID_SIGNATURE when svix-id header is missing', async () => {
    const headers = { ...VALID_HEADERS }
    delete (headers as Record<string, string>)['svix-id']

    const res = await request(buildApp())
      .post('/v1/webhooks/clerk')
      .set(headers)
      .send('{}')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_SIGNATURE')
  })

  it('returns 401 INVALID_SIGNATURE when svix-timestamp header is missing', async () => {
    const headers = { ...VALID_HEADERS }
    delete (headers as Record<string, string>)['svix-timestamp']

    const res = await request(buildApp())
      .post('/v1/webhooks/clerk')
      .set(headers)
      .send('{}')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_SIGNATURE')
  })

  it('returns 401 INVALID_SIGNATURE when svix-signature header is missing', async () => {
    const headers = { ...VALID_HEADERS }
    delete (headers as Record<string, string>)['svix-signature']

    const res = await request(buildApp())
      .post('/v1/webhooks/clerk')
      .set(headers)
      .send('{}')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_SIGNATURE')
  })

  it('returns 401 INVALID_SIGNATURE when svix verification throws', async () => {
    mockVerify.mockImplementation(() => { throw new Error('bad signature') })

    const res = await request(buildApp())
      .post('/v1/webhooks/clerk')
      .set(VALID_HEADERS)
      .send('{}')

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_SIGNATURE')
  })

  it('returns 200 and calls softDeleteUser for user.deleted event', async () => {
    mockVerify.mockReturnValue({ type: 'user.deleted', data: { id: 'user_clerk_123' } })
    vi.mocked(gdprService.softDeleteUser).mockResolvedValue(undefined)

    const res = await request(buildApp())
      .post('/v1/webhooks/clerk')
      .set(VALID_HEADERS)
      .send(JSON.stringify({ type: 'user.deleted', data: { id: 'user_clerk_123' } }))

    expect(res.status).toBe(200)
    expect(res.body.received).toBe(true)
    expect(gdprService.softDeleteUser).toHaveBeenCalledWith('user_clerk_123')
  })

  it('returns 200 without side effects for unknown event types', async () => {
    mockVerify.mockReturnValue({ type: 'user.created', data: { id: 'user_clerk_123' } })

    const res = await request(buildApp())
      .post('/v1/webhooks/clerk')
      .set(VALID_HEADERS)
      .send(JSON.stringify({ type: 'user.created', data: { id: 'user_clerk_123' } }))

    expect(res.status).toBe(200)
    expect(gdprService.softDeleteUser).not.toHaveBeenCalled()
  })

  it('returns 200 silently when user.deleted event has no id (idempotent)', async () => {
    mockVerify.mockReturnValue({ type: 'user.deleted', data: {} })

    const res = await request(buildApp())
      .post('/v1/webhooks/clerk')
      .set(VALID_HEADERS)
      .send(JSON.stringify({ type: 'user.deleted', data: {} }))

    expect(res.status).toBe(200)
    expect(gdprService.softDeleteUser).not.toHaveBeenCalled()
  })
})
