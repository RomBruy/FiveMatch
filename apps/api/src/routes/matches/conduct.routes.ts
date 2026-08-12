import {Router} from 'express'
import {asyncHandler} from '../../middleware/async-handler'
import {loadMatch, requireMatchCapability, requireMatchHost, requirePlayer} from '../../middleware/match-context'
import {behaviourReportService, BehaviourReportError} from '../../services/matches/behaviour-report.service'
import {SubmitBehaviourReportSchema, ResolveBehaviourReportSchema, VoidMatchSchema} from './schemas'
import {ErrorCode} from '@fivematch/types'
import {eligibilityService} from '../../services/matches/eligibility.service'

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
 * Integrity and conduct: voiding a match, behaviour reports and their
 * resolution.
 *
 * Split out of a 1255-line `index.ts` that mixed five unrelated concerns
 * (Phase 7D). Route order within this file is preserved from the original.
 */

// POST /v1/matches/:matchId/void
// Strikes a completed match from card counting. Historical OVR is never
// recomputed — the result stood at the time and every rating built on it was
// given in good faith (PR-031, ADR-017).
router.post(
  '/:matchId/void',
  loadMatch,
  requireMatchHost,
  requirePlayer,
  asyncHandler(async (req, res) => {
    const { reason } = VoidMatchSchema.parse(req.body)

    const result = await eligibilityService.voidMatch(
      req.match.id,
      reason,
      req.user.internalId!,
      req.user.playerId!,
    )

    if (!result.voided) {
      return res.status(422).json(errorFor(ErrorCode.WRONG_MATCH_STATUS, 422))
    }

    // Count only. Naming whose cards were affected would hand the host a list of
    // people to explain themselves to for an administrative correction.
    return res.json({ data: { voided: true, affectedPlayers: result.invalidatedPlayerIds.length } })
  }),
)

// ─── Phase 3 — attendance finalization and behaviour reports ──────────────────

// POST /v1/matches/:matchId/finalize-attendance
// Settles who actually turned up. Idempotent: replaying only picks up rows that
// are still unsettled, so a host tapping twice cannot move an outcome.

// POST /v1/matches/:matchId/reports
// One player's account of another's behaviour. Corroboration and validation are
// decided by the service; a single report never moves anyone's standing.
router.post(
  '/:matchId/reports',
  loadMatch,
  requireMatchCapability('canReportAttendance'),
  requirePlayer,
  asyncHandler(async (req, res) => {
    const { subjectPlayerId, category, detail } = SubmitBehaviourReportSchema.parse(req.body)

    try {
      const report = await behaviourReportService.submitReport({
        matchId: req.match.id,
        reporterPlayerId: req.user.playerId!,
        subjectPlayerId,
        category,
        detail,
      })

      // The reporter learns their own report's state and nothing about anyone
      // else's — corroboration must not be observable, or it becomes gameable.
      return res.status(201).json({ data: { reportId: report.id, status: report.status } })
    } catch (err) {
      if (err instanceof BehaviourReportError) {
        return res.status(err.statusCode).json(errorFor(err.code as ErrorCode, err.statusCode))
      }
      throw err
    }
  }),
)

// GET /v1/matches/:matchId/reports/pending
// A validator's queue for this match. Reporter identity is never included.

// GET /v1/matches/:matchId/reports/pending
// A validator's queue for this match. Reporter identity is never included.
router.get(
  '/:matchId/reports/pending',
  loadMatch,
  requireMatchCapability('canResolveDispute'),
  requirePlayer,
  asyncHandler(async (req, res) => {
    const pending = await behaviourReportService.getPendingForMatch(
      req.match.id,
      req.user.playerId!,
    )
    return res.json({ data: pending })
  }),
)

// POST /v1/matches/:matchId/reports/:reportId/resolve
// The capability says the caller has authority on this match; the service still
// applies impartiality, because only it knows who the report is about.

// POST /v1/matches/:matchId/reports/:reportId/resolve
// The capability says the caller has authority on this match; the service still
// applies impartiality, because only it knows who the report is about.
router.post(
  '/:matchId/reports/:reportId/resolve',
  loadMatch,
  requireMatchCapability('canResolveDispute'),
  requirePlayer,
  asyncHandler(async (req, res) => {
    const { decision } = ResolveBehaviourReportSchema.parse(req.body)

    try {
      const resolved = await behaviourReportService.resolveReport(
        req.params['reportId'] as string,
        req.user.playerId!,
        decision,
      )
      return res.json({ data: { reportId: resolved?.id, status: resolved?.status } })
    } catch (err) {
      if (err instanceof BehaviourReportError) {
        return res.status(err.statusCode).json(errorFor(err.code as ErrorCode, err.statusCode))
      }
      throw err
    }
  }),
)

export default router
