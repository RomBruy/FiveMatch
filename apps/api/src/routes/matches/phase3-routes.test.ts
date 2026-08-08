import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import type { EvaluatedMatchCapabilities } from '../../services/permissions/capability.service'

vi.mock('../../db', () => ({ db: { select: vi.fn(), insert: vi.fn(), transaction: vi.fn() } }))
vi.mock('../../db/schema', () => ({
  ACTIVE_CREW_ROLES: ['organizer', 'co_host', 'member'],
  matches: {}, teamGenerationJobs: {}, teamGenerationPlayers: {}, matchAttendances: {},
  players: {}, matchParticipants: {}, groups: {}, groupMemberships: {}, mvpVotes: {},
  matchCapacity: (n: number) => n * 2,
}))
vi.mock('../../services/matches/match.service', () => ({ matchService: {} }))
vi.mock('../../services/matches/attendance.service', () => ({ attendanceService: {} }))
vi.mock('../../services/matches/team-generator.service', () => ({ teamGeneratorService: {} }))
vi.mock('../../services/notifications/notification.service', () => ({
  notificationService: { send: vi.fn() },
}))
vi.mock('../../services/matches/attendance-finalization.service', () => ({
  attendanceFinalizationService: {
    finalizeMatch: vi.fn().mockResolvedValue({ finalized: [{ playerId: 'p1', outcome: 'attended' }] }),
    setArrivedLate: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('../../services/matches/behaviour-report.service', () => {
  class BehaviourReportError extends Error {
    constructor(public code: string, public statusCode: number) {
      super(code)
    }
  }
  return {
    BehaviourReportError,
    behaviourReportService: {
      submitReport: vi.fn().mockResolvedValue({ id: 'report-1', status: 'pending' }),
      resolveReport: vi.fn().mockResolvedValue({ id: 'report-1', status: 'finalized' }),
      getPendingForMatch: vi.fn().mockResolvedValue([
        { id: 'report-1', subjectPlayerId: 'subject', category: 'aggression', detail: 'x' },
      ]),
    },
  }
})

// `loadMatch` is where authorization is resolved; the tests drive it directly so
// each case states exactly which capabilities the caller has.
const matchState = {
  match: { id: 'match-1', status: 'completed', scoreA: 3, scoreB: 2 },
  capabilities: {} as EvaluatedMatchCapabilities,
}

vi.mock('../../middleware/match-context', async () => {
  const actual = await vi.importActual<typeof import('../../middleware/match-context')>(
    '../../middleware/match-context',
  )
  return {
    ...actual,
    loadMatch: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.match = matchState.match as never
      req.matchCapabilities = matchState.capabilities
      req.matchRelation = 'participant'
      next()
    },
  }
})

import { attendanceFinalizationService } from '../../services/matches/attendance-finalization.service'
import { behaviourReportService } from '../../services/matches/behaviour-report.service'
import { errorHandler } from '../../middleware/error-handler'
import router from './index'

const ALL_FALSE: EvaluatedMatchCapabilities = {
  viewerRelation: 'viewer', canViewMatch: true,
  canViewPrivateMatchDetails: false, canViewExactLocation: false,
  canViewParticipantRoster: false, canViewWaitlist: false,
  canViewPendingGroupAttendance: false, canManageAttendance: false,
  canViewPrivateNotes: false, canRate: false, canReportAttendance: false,
  canResolveDispute: false, canSubmitProno: false, canLeave: false,
  canJoin: false, canJoinWaitlist: false,
}

function app(capabilities: Partial<EvaluatedMatchCapabilities>) {
  matchState.capabilities = { ...ALL_FALSE, ...capabilities }
  const instance = express()
  instance.use(express.json())
  instance.use((req, _res, next) => {
    req.user = { userId: 'clerk-1', internalId: 'internal-1', playerId: 'player-1' } as never
    next()
  })
  instance.use('/matches', router)
  // The real app mounts this; without it a schema rejection surfaces as a 500
  // and the tests would be asserting against a harness that is not the product.
  instance.use(errorHandler)
  return instance
}

beforeEach(() => {
  vi.clearAllMocks()
  matchState.match = { id: 'match-1', status: 'completed', scoreA: 3, scoreB: 2 }
})

describe('Phase 3 route authorization', () => {
  it('lets a manager finalize a completed match', async () => {
    const response = await request(app({ canManageAttendance: true }))
      .post('/matches/match-1/finalize-attendance')
      .send({ arrivedLatePlayerIds: ['22222222-2222-4222-8222-222222222222'] })

    expect(response.status).toBe(200)
    expect(attendanceFinalizationService.setArrivedLate)
      .toHaveBeenCalledWith('match-1', '22222222-2222-4222-8222-222222222222', true)
    expect(attendanceFinalizationService.finalizeMatch).toHaveBeenCalledWith('match-1', 'player-1')
  })

  it('refuses finalization to a non-manager', async () => {
    const response = await request(app({ canReportAttendance: true }))
      .post('/matches/match-1/finalize-attendance')
      .send({})

    expect(response.status).toBe(403)
    expect(attendanceFinalizationService.finalizeMatch).not.toHaveBeenCalled()
  })

  it('refuses finalization before a result exists', async () => {
    matchState.match = { id: 'match-1', status: 'in_progress', scoreA: null, scoreB: null } as never
    const response = await request(app({ canManageAttendance: true }))
      .post('/matches/match-1/finalize-attendance')
      .send({})

    expect(response.status).toBe(422)
    expect(attendanceFinalizationService.finalizeMatch).not.toHaveBeenCalled()
  })

  it('accepts a report from someone who played', async () => {
    const response = await request(app({ canReportAttendance: true }))
      .post('/matches/match-1/reports')
      .send({ subjectPlayerId: '11111111-1111-4111-8111-111111111111', category: 'aggression' })

    expect(response.status).toBe(201)
    // The reporter learns their own report's state and nothing more —
    // corroboration progress must not be observable.
    expect(response.body.data).toEqual({ reportId: 'report-1', status: 'pending' })
  })

  it('refuses a report from a non-participant', async () => {
    const response = await request(app({}))
      .post('/matches/match-1/reports')
      .send({ subjectPlayerId: '11111111-1111-4111-8111-111111111111', category: 'aggression' })

    expect(response.status).toBe(403)
    expect(behaviourReportService.submitReport).not.toHaveBeenCalled()
  })

  it('rejects an unknown report category', async () => {
    const response = await request(app({ canReportAttendance: true }))
      .post('/matches/match-1/reports')
      .send({ subjectPlayerId: '11111111-1111-4111-8111-111111111111', category: 'being_rubbish' })

    expect(response.status).toBe(400)
    expect(behaviourReportService.submitReport).not.toHaveBeenCalled()
  })

  it('maps a service refusal to its own status rather than a 500', async () => {
    const { BehaviourReportError } = await import('../../services/matches/behaviour-report.service')
    vi.mocked(behaviourReportService.submitReport)
      .mockRejectedValueOnce(new BehaviourReportError('ALREADY_REPORTED', 409))

    const response = await request(app({ canReportAttendance: true }))
      .post('/matches/match-1/reports')
      .send({ subjectPlayerId: '11111111-1111-4111-8111-111111111111', category: 'aggression' })

    expect(response.status).toBe(409)
    expect(response.body.error.code).toBe('ALREADY_REPORTED')
  })

  it('gives the pending queue only to a validator', async () => {
    const denied = await request(app({ canReportAttendance: true }))
      .get('/matches/match-1/reports/pending')
    expect(denied.status).toBe(403)

    const allowed = await request(app({ canResolveDispute: true }))
      .get('/matches/match-1/reports/pending')
    expect(allowed.status).toBe(200)
    expect(behaviourReportService.getPendingForMatch).toHaveBeenCalledWith('match-1', 'player-1')
    // Whatever the service returns, the route adds no identity of its own.
    expect(JSON.stringify(allowed.body)).not.toContain('reporterPlayerId')
  })

  it('refuses resolution without dispute authority', async () => {
    const response = await request(app({ canManageAttendance: true, canResolveDispute: false }))
      .post('/matches/match-1/reports/report-1/resolve')
      .send({ decision: 'finalized' })

    // Managing a match is not the same as settling a dispute on it — a
    // standalone host manages but never validates.
    expect(response.status).toBe(403)
    expect(behaviourReportService.resolveReport).not.toHaveBeenCalled()
  })

  it('accepts a validator decision', async () => {
    const response = await request(app({ canResolveDispute: true }))
      .post('/matches/match-1/reports/report-1/resolve')
      .send({ decision: 'dismissed' })

    expect(response.status).toBe(200)
    expect(behaviourReportService.resolveReport)
      .toHaveBeenCalledWith('report-1', 'player-1', 'dismissed')
  })

  it('rejects a decision value outside the allowed set', async () => {
    const response = await request(app({ canResolveDispute: true }))
      .post('/matches/match-1/reports/report-1/resolve')
      .send({ decision: 'expired' })

    expect(response.status).toBe(400)
    expect(behaviourReportService.resolveReport).not.toHaveBeenCalled()
  })
})
