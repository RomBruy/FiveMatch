import {Router} from 'express'
import {asyncHandler} from '../../middleware/async-handler'
import {loadMatch, requireMatchCapability, requireMatchHost, requirePlayer} from '../../middleware/match-context'
import {attendanceService} from '../../services/matches/attendance.service'
import {attendanceFinalizationService} from '../../services/matches/attendance-finalization.service'
import {AttendanceUpdateSchema, FinalizeAttendanceSchema} from './schemas'
import {ErrorCode} from '@fivematch/types'
import {notificationService} from '../../services/notifications/notification.service'

/**
 * Matches are a top-level resource. They used to hang off /v1/groups/:groupId,
 * which made them unreachable for anyone without a crew — the exact user the
 * product is now built around. Authorization moved from "is a group member" to
 * "what is this caller's relation to this match" (see middleware/match-context).
 */
const router = Router()

const errorFor = (code: string, statusCode: number, meta?: unknown) => ({
  error: { code, statusCode, ...(meta ? { meta } : {}) },
})

// ---------------------------------------------------------------------------
// Discovery + creation
// ---------------------------------------------------------------------------

// GET /v1/matches/discover — public matches near the caller with spots left
/**
 * Who is coming: RSVP, joining, leaving, the waitlist, locking the sheet and
 * settling it afterwards.
 *
 * Split out of a 1255-line `index.ts` that mixed five unrelated concerns
 * (Phase 7D). Route order within this file is preserved from the original.
 */

// POST /v1/matches/:matchId/join — take a published spot
router.post(
  '/:matchId/join',
  loadMatch,
  requirePlayer,
  asyncHandler(async (req, res) => {
    try {
      const spots = await attendanceService.joinOpenMatch(req.match.id, req.user.internalId!)
      return res.status(201).json({ data: spots })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      const statusCode = (err as { statusCode?: number }).statusCode ?? 500
      if (code && code in ErrorCode) return res.status(statusCode).json(errorFor(code, statusCode))
      throw err
    }
  }),
)

// POST /v1/matches/:matchId/leave — give up a seat

// POST /v1/matches/:matchId/leave — give up a seat
router.post(
  '/:matchId/leave',
  loadMatch,
  requireMatchCapability('canLeave'),
  asyncHandler(async (req, res) => {
    try {
      await attendanceService.leaveMatch(req.match.id, req.user.internalId!)
      return res.json({ data: { success: true } })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      const statusCode = (err as { statusCode?: number }).statusCode ?? 500
      if (code && code in ErrorCode) return res.status(statusCode).json(errorFor(code, statusCode))
      throw err
    }
  }),
)

// PATCH /v1/matches/:matchId/attendance — RSVP

// PATCH /v1/matches/:matchId/attendance — RSVP
router.patch(
  '/:matchId/attendance',
  loadMatch,
  requirePlayer,
  asyncHandler(async (req, res) => {
    const { status } = AttendanceUpdateSchema.parse(req.body)

    // A stranger flipping themselves to IN is a join, not an RSVP — route it
    // through the path that actually checks spot availability.
    if (status === 'in' && req.matchRelation === 'viewer') {
      return res.status(403).json(errorFor(ErrorCode.NOT_A_PARTICIPANT, 403))
    }

    try {
      await attendanceService.markAttendance(req.match.id, req.user.internalId!, status)
      void attendanceService.checkAndTriggerReminder(req.match.id).catch(() => { /* fire-and-forget */ })
      return res.json({ data: { success: true } })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'ATTENDANCE_CLOSED') return res.status(422).json(errorFor(ErrorCode.ATTENDANCE_CLOSED, 422))
      if (code === 'ALREADY_ON_WAITLIST') return res.status(409).json(errorFor(ErrorCode.ALREADY_ON_WAITLIST, 409))
      if (code === 'NO_SPOTS_AVAILABLE') return res.status(409).json(errorFor(ErrorCode.NO_SPOTS_AVAILABLE, 409))
      if (code === 'MATCH_NOT_PUBLIC') return res.status(422).json(errorFor(ErrorCode.MATCH_NOT_PUBLIC, 422))
      throw err
    }
  }),
)

// GET /v1/matches/:matchId/attendances — the sheet, with trust signals attached

// GET /v1/matches/:matchId/attendances — the sheet, with trust signals attached
router.get(
  '/:matchId/attendances',
  loadMatch,
  asyncHandler(async (req, res) => {
    void attendanceService.checkAndTriggerReminder(req.match.id).catch(() => { /* fire-and-forget */ })
    const result = await attendanceService.getAttendances(
      req.match.id,
      req.user.internalId,
      req.matchCapabilities,
      req.matchRelation,
    )
    return res.json({ data: result })
  }),
)

// POST /v1/matches/:matchId/lock-attendance — host only

// POST /v1/matches/:matchId/lock-attendance — host only
router.post(
  '/:matchId/lock-attendance',
  loadMatch,
  requireMatchHost,
  asyncHandler(async (req, res) => {
    try {
      await attendanceService.lockAttendance(req.match.id)
      return res.json({ data: { success: true } })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      const meta = (err as { meta?: unknown }).meta
      if (code === 'INSUFFICIENT_PLAYERS') return res.status(422).json(errorFor(ErrorCode.INSUFFICIENT_PLAYERS, 422, meta))
      if (code === 'ATTENDANCE_CLOSED') return res.status(422).json(errorFor(ErrorCode.ATTENDANCE_CLOSED, 422))
      if (code === 'MATCH_NOT_FOUND') return res.status(404).json(errorFor(ErrorCode.MATCH_NOT_FOUND, 404))
      throw err
    }
  }),
)

// ---------------------------------------------------------------------------
// Team generation
// ---------------------------------------------------------------------------

// GET /v1/matches/:matchId/team-generator-status — can this match be balanced yet?

// POST /v1/matches/:matchId/waitlist
// Join the queue for a full published match. Previously an outsider hitting a
// full match got a flat refusal, which is the worst answer available: it is the
// match they want, and places open up constantly (AF-008).
router.post(
  '/:matchId/waitlist',
  loadMatch,
  requireMatchCapability('canJoinWaitlist'),
  requirePlayer,
  asyncHandler(async (req, res) => {
    const result = await attendanceService.joinWaitlist(req.match.id, req.user.internalId!)
    return res.status(201).json({ data: result })
  }),
)

// POST /v1/matches/:matchId/waitlist/:playerId/promote
// Host promotes a specific player rather than the next in line — usually
// solving something the queue cannot see, like needing a goalkeeper.

// POST /v1/matches/:matchId/waitlist/:playerId/promote
// Host promotes a specific player rather than the next in line — usually
// solving something the queue cannot see, like needing a goalkeeper.
router.post(
  '/:matchId/waitlist/:playerId/promote',
  loadMatch,
  requireMatchHost,
  asyncHandler(async (req, res) => {
    const { promotedUserId, groupId } = await attendanceService.promoteFromWaitlist(
      req.match.id,
      req.params['playerId'] as string,
    )

    if (promotedUserId) {
      notificationService.send({
        type: 'WAITLIST_SPOT_OPEN',
        matchId: req.match.id,
        groupId,
        recipientUserId: promotedUserId,
      })
    }

    return res.json({ data: { promoted: true } })
  }),
)

// ─── Phase 4 — card eligibility ───────────────────────────────────────────────

// POST /v1/matches/:matchId/void
// Strikes a completed match from card counting. Historical OVR is never
// recomputed — the result stood at the time and every rating built on it was
// given in good faith (PR-031, ADR-017).

// POST /v1/matches/:matchId/finalize-attendance
// Settles who actually turned up. Idempotent: replaying only picks up rows that
// are still unsettled, so a host tapping twice cannot move an outcome.
router.post(
  '/:matchId/finalize-attendance',
  loadMatch,
  requireMatchHost,
  requirePlayer,
  asyncHandler(async (req, res) => {
    const { arrivedLatePlayerIds } = FinalizeAttendanceSchema.parse(req.body)
    const match = req.match

    if (match.status !== 'completed' || match.scoreA === null || match.scoreB === null) {
      return res.status(422).json(errorFor(ErrorCode.WRONG_MATCH_STATUS, 422))
    }

    // Late flags first — finalization reads them when deriving the outcome.
    for (const playerId of arrivedLatePlayerIds) {
      await attendanceFinalizationService.setArrivedLate(match.id, playerId, true)
    }

    const { finalized } = await attendanceFinalizationService.finalizeMatch(
      match.id,
      req.user.playerId!,
    )

    return res.json({ data: { finalized: finalized.length, outcomes: finalized } })
  }),
)

// POST /v1/matches/:matchId/reports
// One player's account of another's behaviour. Corroboration and validation are
// decided by the service; a single report never moves anyone's standing.

export default router
