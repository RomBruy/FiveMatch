import {Router} from 'express'
 import {sendPostMatchReminders} from './post-match-reminders'
import {asyncHandler} from '../../middleware/async-handler'
import {loadMatch, requireMatchHost, requirePlayer} from '../../middleware/match-context'
import {matchService} from '../../services/matches/match.service'
import {CreateMatchSchema, DiscoverQuerySchema, SetVisibilitySchema, EditMatchSchema, CancelMatchSchema} from './schemas'
import {ErrorCode} from '@fivematch/types'
import {db} from '../../db'
import {groupMemberships} from '../../db/schema'
import {eq, and, isNull} from 'drizzle-orm'

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
 * Creating, reading, editing, publishing and calling off a match.
 *
 * `/discover`, `/mine` and `/series/...` are registered before `/:matchId`
 * because Express matches in registration order and the parameter would
 * otherwise swallow all three.
 *
 * Split out of a 1255-line `index.ts` that mixed five unrelated concerns
 * (Phase 7D). Route order within this file is preserved from the original.
 */

// GET /v1/matches/discover — public matches near the caller with spots left
router.get(
  '/discover',
  asyncHandler(async (req, res) => {
    const query = DiscoverQuerySchema.parse(req.query)

    const results = await matchService.discoverMatches(
      {
        latitude: query.latitude,
        longitude: query.longitude,
        radiusKm: query.radiusKm,
        city: query.city,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        format: query.format,
        skillLevel: query.skillLevel,
        limit: query.limit,
      },
      req.user.playerId,
    )

    return res.json({ data: { matches: results } })
  }),
)

// GET /v1/matches/mine?scope=upcoming|past — everything the caller has a stake in

// GET /v1/matches/mine?scope=upcoming|past — everything the caller has a stake in
router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const scope = req.query['scope'] === 'past' ? 'past' : 'upcoming'
    const limit = Math.min(parseInt((req.query['limit'] as string) ?? '20', 10), 50)

    const results = await matchService.getMyMatches(req.user.internalId!, req.user.playerId, scope, limit)
    return res.json({ data: { matches: results } })
  }),
)

// POST /v1/matches — anyone with a profile can host. A crew match additionally
// requires the caller to be that crew's organizer.

// POST /v1/matches — anyone with a profile can host. A crew match additionally
// requires the caller to be that crew's organizer.
router.post(
  '/',
  requirePlayer,
  asyncHandler(async (req, res) => {
    const data = CreateMatchSchema.parse(req.body)

    if (data.groupId) {
      const [membership] = await db
        .select({ role: groupMemberships.role })
        .from(groupMemberships)
        .where(and(
          eq(groupMemberships.groupId, data.groupId),
          eq(groupMemberships.userId, req.user.internalId!),
          isNull(groupMemberships.deletedAt),
        ))
        .limit(1)

      if (!membership) return res.status(403).json(errorFor(ErrorCode.NOT_A_MEMBER, 403))
      if (membership.role !== 'organizer') return res.status(403).json(errorFor(ErrorCode.ORGANIZER_ONLY, 403))
    }

    const match = await matchService.createMatch(req.user.internalId!, data)
    return res.status(201).json({ data: match })
  }),
)

// POST /v1/matches/series/:seriesId/end — host only.
// Registered before /:matchId so 'series' isn't captured as a match id.

// POST /v1/matches/series/:seriesId/end — host only.
// Registered before /:matchId so 'series' isn't captured as a match id.
router.post(
  '/series/:seriesId/end',
  asyncHandler(async (req, res) => {
    const { seriesId } = req.params as { seriesId: string }
    const result = await matchService.endSeries(req.user.internalId!, seriesId)
    if (!result) return res.status(404).json(errorFor(ErrorCode.MATCH_NOT_FOUND, 404))
    return res.json({ data: result })
  }),
)

// ---------------------------------------------------------------------------
// Single match
// ---------------------------------------------------------------------------

// GET /v1/matches/:matchId — participants, crew, or anyone if the match is public

// GET /v1/matches/:matchId — participants, crew, or anyone if the match is public
router.get(
  '/:matchId',
  loadMatch,
  asyncHandler(async (req, res) => {
    const matchId = req.match.id
    const match = await matchService.getMatch(matchId, req.matchCapabilities, req.matchRelation)
    if (!match) return res.status(404).json(errorFor(ErrorCode.MATCH_NOT_FOUND, 404))

    void sendPostMatchReminders(matchId, req.match.groupId)

    return res.json({ data: match })
  }),
)

// PATCH /v1/matches/:matchId/visibility — publish or withdraw the open spots

// PATCH /v1/matches/:matchId/visibility — publish or withdraw the open spots
router.patch(
  '/:matchId/visibility',
  loadMatch,
  requireMatchHost,
  asyncHandler(async (req, res) => {
    const { visibility, openSpots } = SetVisibilitySchema.parse(req.body)

    if (visibility === 'public' && req.match.latitude === null && !req.match.city) {
      return res.status(422).json(errorFor(ErrorCode.VALIDATION_ERROR, 422, {
        detail: 'Add a location before publishing this match',
      }))
    }

    const updated = await matchService.setVisibility(req.match.id, visibility, openSpots ?? null)
    return res.json({ data: updated })
  }),
)

// POST /v1/matches/:matchId/join — take a published spot

// PATCH /v1/matches/:matchId
// Edit a match that has not happened yet. Format and team shape are not
// editable: they decide capacity, and changing them after people commit
// silently invalidates the sheet they said yes to.
router.patch(
  '/:matchId',
  loadMatch,
  requireMatchHost,
  asyncHandler(async (req, res) => {
    const input = EditMatchSchema.parse(req.body)
    const result = await matchService.editMatch(req.match.id, input)

    if (!result) return res.status(404).json(errorFor(ErrorCode.MATCH_NOT_FOUND, 404))
    if ('conflict' in result) return res.status(422).json(errorFor(ErrorCode.WRONG_MATCH_STATUS, 422))

    return res.json({ data: { matchId: result.match.id } })
  }),
)

// POST /v1/matches/:matchId/cancel
// Distinct from voiding: cancelled means it never happened, voided means it
// happened but stops counting toward cards.

// POST /v1/matches/:matchId/cancel
// Distinct from voiding: cancelled means it never happened, voided means it
// happened but stops counting toward cards.
router.post(
  '/:matchId/cancel',
  loadMatch,
  requireMatchHost,
  asyncHandler(async (req, res) => {
    const { reason } = CancelMatchSchema.parse(req.body)
    const result = await matchService.cancelMatch(req.match.id, reason)

    if (!result) return res.status(404).json(errorFor(ErrorCode.MATCH_NOT_FOUND, 404))
    if ('conflict' in result) return res.status(422).json(errorFor(ErrorCode.WRONG_MATCH_STATUS, 422))

    return res.json({ data: { cancelled: true } })
  }),
)

// ─── Phase 6 — waitlist ───────────────────────────────────────────────────────

// POST /v1/matches/:matchId/waitlist
// Join the queue for a full published match. Previously an outsider hitting a
// full match got a flat refusal, which is the worst answer available: it is the
// match they want, and places open up constantly (AF-008).

export default router
