import { describe, expect, it, vi } from 'vitest'

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
vi.mock('../../services/matches/attendance-finalization.service', () => ({
  attendanceFinalizationService: {},
}))
vi.mock('../../services/matches/behaviour-report.service', () => ({
  behaviourReportService: {},
  BehaviourReportError: class extends Error {},
}))
vi.mock('../../services/matches/eligibility.service', () => ({ eligibilityService: {} }))
vi.mock('../../services/notifications/notification.service', () => ({
  notificationService: { send: vi.fn() },
}))

import router from './index'

/**
 * Every route this router registers, as method + path.
 *
 * This exists to make splitting the file safe. `routes/matches/index.ts` grew to
 * 1255 lines across five unrelated concerns, and most of its routes have no test
 * of their own — so a mechanical move could silently drop one and nothing would
 * notice until a user hit a 404.
 *
 * The list is deliberately exhaustive and deliberately tedious. If a route is
 * added, this fails and the addition has to be stated here; if one disappears
 * during a refactor, this fails too, which is the whole point.
 */
type Layer = {
  route?: { path: string; methods: Record<string, boolean> }
  handle?: { stack?: Layer[] }
}

/**
 * Walk mounted sub-routers as well as direct routes.
 *
 * The router is a thin mounter over five sub-routers, so a one-level read finds
 * nothing at all — which is indistinguishable from having lost every route.
 */
function collect(stack: Layer[]): Layer[] {
  return stack.flatMap((layer) => (
    layer.route ? [layer] : layer.handle?.stack ? collect(layer.handle.stack) : []
  ))
}

function routeLayers(): Layer[] {
  return collect((router as unknown as { stack: Layer[] }).stack)
}

function registeredRoutes(): string[] {
  return routeLayers()
    .flatMap((layer) => {
      const route = layer.route!
      return Object.keys(route.methods)
        .filter((method) => route.methods[method])
        .map((method) => `${method.toUpperCase()} ${route.path}`)
    })
    .sort()
}

const EXPECTED = [
  'GET /discover',
  'GET /mine',
  'POST /',
  'POST /series/:seriesId/end',
  'GET /:matchId',
  'PATCH /:matchId',
  'POST /:matchId/cancel',
  'PATCH /:matchId/visibility',
  'POST /:matchId/join',
  'POST /:matchId/leave',
  'PATCH /:matchId/attendance',
  'GET /:matchId/attendances',
  'POST /:matchId/lock-attendance',
  'POST /:matchId/waitlist',
  'POST /:matchId/waitlist/:playerId/promote',
  'POST /:matchId/finalize-attendance',
  'GET /:matchId/team-generator-status',
  'POST /:matchId/generate-teams',
  'GET /:matchId/generation-result/:jobId',
  'POST /:matchId/lock-teams',
  'PATCH /:matchId/team-adjustment',
  'POST /:matchId/result',
  'GET /:matchId/participants',
  'POST /:matchId/mvp-votes',
  'GET /:matchId/mvp-result',
  'POST /:matchId/ratings',
  'POST /:matchId/void',
  'POST /:matchId/reports',
  'GET /:matchId/reports/pending',
  'POST /:matchId/reports/:reportId/resolve',
].sort()

describe('match router surface', () => {
  it('registers exactly the expected routes', () => {
    // Equality both ways: a dropped route and a smuggled-in one are both
    // failures, and a refactor is exactly when either happens.
    expect(registeredRoutes()).toEqual(EXPECTED)
  })

  it('keeps literal segments ahead of the :matchId parameter', () => {
    const paths = routeLayers().map((layer) => layer.route!.path)

    // `/discover`, `/mine` and `/series/...` would all be swallowed by
    // `/:matchId` if they were registered after it. Express matches in
    // registration order, so this ordering is load-bearing rather than tidy.
    const paramIndex = paths.indexOf('/:matchId')
    for (const literal of ['/discover', '/mine', '/series/:seriesId/end']) {
      expect(paths.indexOf(literal)).toBeLessThan(paramIndex)
    }
  })
})
