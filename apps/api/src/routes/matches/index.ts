import { randomUUID } from 'crypto'
import { Router } from 'express'
import { asyncHandler } from '../../middleware/async-handler'
import {
  loadMatch, requireMatchCapability, requireMatchHost, requireMatchParticipant, requirePlayer,
} from '../../middleware/match-context'
import { teamGenRateLimit } from '../../middleware/rate-limit'
import { matchService } from '../../services/matches/match.service'
import { attendanceService } from '../../services/matches/attendance.service'
import { attendanceFinalizationService } from '../../services/matches/attendance-finalization.service'
import { behaviourReportService, BehaviourReportError } from '../../services/matches/behaviour-report.service'
import { teamGeneratorService } from '../../services/matches/team-generator.service'
import type { GeneratorPlayer, GeneratorOptions } from '../../services/matches/team-generator.service'
import {
  CreateMatchSchema,
  DiscoverQuerySchema,
  SetVisibilitySchema,
  AttendanceUpdateSchema,
  TeamAdjustmentSchema,
  RecordResultSchema,
  SubmitMvpVoteSchema,
  SubmitPostMatchRatingSchema,
  FinalizeAttendanceSchema,
  SubmitBehaviourReportSchema,
  ResolveBehaviourReportSchema,
  VoidMatchSchema,
  EditMatchSchema,
  CancelMatchSchema,
} from './schemas'
import { ErrorCode } from '@fivematch/types'
import { TEAM_GEN_MAX_GENERATIONS, TEAM_GEN_OVR_FALLBACK } from '@fivematch/types/algorithm-constants'
import { db } from '../../db'
import {
  matches, teamGenerationJobs, teamGenerationPlayers, matchAttendances,
  players, matchParticipants, groups, groupMemberships, mvpVotes,
} from '../../db/schema'
import { eq, and, isNull, inArray, sql } from 'drizzle-orm'
import { notificationService } from '../../services/notifications/notification.service'
import { tierService } from '../../services/matches/tier.service'
import { betService } from '../../services/pronos/bet.service'
import { logger } from '../../lib/logger'
import { RatingSubmissionError, ratingService } from '../../services/ratings/rating.service'
import { ovrService } from '../../services/players/ovr.service'
import { eligibilityService } from '../../services/matches/eligibility.service'

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
router.get(
  '/:matchId/team-generator-status',
  loadMatch,
  asyncHandler(async (req, res) => {
    const status = await teamGeneratorService.getStatus(req.match.id)
    return res.json({ data: status })
  }),
)

// POST /v1/matches/:matchId/generate-teams — host only
router.post(
  '/:matchId/generate-teams',
  loadMatch,
  requireMatchHost,
  teamGenRateLimit,
  asyncHandler(async (req, res) => {
    const match = req.match
    const matchId = match.id

    if (match.status !== 'attendance_locked' && match.status !== 'teams_generated') {
      return res.status(422).json(errorFor(ErrorCode.WRONG_MATCH_STATUS, 422, {
        current: match.status, required: 'attendance_locked',
      }))
    }

    if (match.generationCount >= TEAM_GEN_MAX_GENERATIONS) {
      return res.status(422).json(errorFor(ErrorCode.GENERATION_LIMIT_REACHED, 422))
    }

    // Confirmed-IN players (waitlistPosition IS NULL = not on waitlist). The
    // generator now reads straight off the sheet — with a global identity there
    // is no group roster to intersect against.
    const playerRows = await db
      .select({
        id: players.id,
        displayName: players.displayName,
        ovrScoreFloat: players.ovrScoreFloat,
        cardState: players.cardState,
        avgPace: players.avgPace,
        avgTechnique: players.avgTechnique,
        avgPassing: players.avgPassing,
        avgDefending: players.avgDefending,
        avgPhysicality: players.avgPhysicality,
        avgEffort: players.avgEffort,
      })
      .from(matchAttendances)
      .innerJoin(players, eq(players.id, matchAttendances.playerId))
      .where(and(
        eq(matchAttendances.matchId, matchId),
        eq(matchAttendances.status, 'in'),
        isNull(matchAttendances.waitlistPosition),
        isNull(players.deletedAt),
      ))

    if (playerRows.length < 2) {
      return res.status(422).json(errorFor(ErrorCode.INSUFFICIENT_PLAYERS, 422, {
        confirmed: playerRows.length, required: 2,
      }))
    }

    const generatorPlayers: GeneratorPlayer[] = playerRows.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      ovrScore: p.ovrScoreFloat !== null ? Math.round(parseFloat(p.ovrScoreFloat)) : null,
      avgPace: p.avgPace !== null ? Number(p.avgPace) : null,
      avgTechnique: p.avgTechnique !== null ? Number(p.avgTechnique) : null,
      avgPassing: p.avgPassing !== null ? Number(p.avgPassing) : null,
      avgDefending: p.avgDefending !== null ? Number(p.avgDefending) : null,
      avgPhysicality: p.avgPhysicality !== null ? Number(p.avgPhysicality) : null,
      avgEffort: p.avgEffort !== null ? Number(p.avgEffort) : null,
    }))

    const options: GeneratorOptions = {
      goalkeeperMode: match.goalkeeperMode as GeneratorOptions['goalkeeperMode'],
      generatorStyle: match.generatorStyle as GeneratorOptions['generatorStyle'],
    }

    const result = teamGeneratorService.generate(generatorPlayers, options)

    const jobId = `gen_${randomUUID().replace(/-/g, '').slice(0, 12)}`
    const newGenerationCount = match.generationCount + 1

    // Snapshot team OVR averages at the moment teams are locked (fix #3 — reproducible outcome term).
    const avgOvr = (ps: GeneratorPlayer[]) => {
      const ovrs = ps.map((p) => p.ovrScore ?? TEAM_GEN_OVR_FALLBACK)
      return ovrs.reduce((s, v) => s + v, 0) / Math.max(1, ovrs.length)
    }
    const teamAOvrAtLock = avgOvr(result.teamA)
    const teamBOvrAtLock = avgOvr(result.teamB)

    try {
      await db.transaction(async (tx) => {
        // Optimistic lock on generationCount prevents a concurrent double-generate.
        const updateResult = await tx
          .update(matches)
          .set({
            generationCount: newGenerationCount,
            status: 'teams_generated',
            teamAOvrAtLock: String(teamAOvrAtLock),
            teamBOvrAtLock: String(teamBOvrAtLock),
            updatedAt: new Date(),
          })
          .where(and(eq(matches.id, matchId), eq(matches.generationCount, match.generationCount)))
          .returning({ id: matches.id })

        if (updateResult.length === 0) {
          throw Object.assign(new Error('Concurrent generation conflict'), { code: 'GENERATION_LIMIT_REACHED' })
        }

        const [job] = await tx.insert(teamGenerationJobs).values({
          jobId,
          matchId,
          groupId: match.groupId,
          status: 'complete',
          generationNumber: newGenerationCount,
          fairnessScore: String(result.fairnessScore),
        }).returning({ id: teamGenerationJobs.id })

        if (job) {
          await tx.insert(teamGenerationPlayers).values([
            ...result.teamA.map((p) => ({
              jobId: job.id,
              playerId: p.id,
              teamSide: 'A' as const,
              ovrAtGeneration: p.ovrScore !== null ? String(p.ovrScore) : null,
            })),
            ...result.teamB.map((p) => ({
              jobId: job.id,
              playerId: p.id,
              teamSide: 'B' as const,
              ovrAtGeneration: p.ovrScore !== null ? String(p.ovrScore) : null,
            })),
          ])
        }
      })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'GENERATION_LIMIT_REACHED') {
        return res.status(422).json(errorFor(ErrorCode.GENERATION_LIMIT_REACHED, 422))
      }
      throw err
    }

    const buildTeam = (ps: GeneratorPlayer[]) =>
      ps.map((p) => {
        const row = playerRows.find((r) => r.id === p.id)
        return {
          playerId: p.id,
          displayName: p.displayName,
          cardState: row?.cardState ?? 'not_started',
          ovrScore: p.ovrScore,
        }
      })

    return res.json({
      data: {
        jobId,
        status: 'complete',
        generationCount: newGenerationCount,
        teams: {
          teamA: buildTeam(result.teamA),
          teamB: buildTeam(result.teamB),
          fairnessScore: result.fairnessScore,
        },
      },
    })
  }),
)

// GET /v1/matches/:matchId/generation-result/:jobId
router.get(
  '/:matchId/generation-result/:jobId',
  loadMatch,
  requireMatchParticipant,
  asyncHandler(async (req, res) => {
    const { jobId } = req.params as { jobId: string }

    const [job] = await db
      .select()
      .from(teamGenerationJobs)
      .where(and(eq(teamGenerationJobs.jobId, jobId), eq(teamGenerationJobs.matchId, req.match.id)))

    if (!job) return res.status(404).json(errorFor(ErrorCode.MATCH_NOT_FOUND, 404))

    if (job.status === 'processing') {
      return res.json({ data: { jobId, status: 'processing', generationCount: job.generationNumber, teams: null } })
    }

    const genPlayers = await db
      .select({
        playerId: teamGenerationPlayers.playerId,
        teamSide: teamGenerationPlayers.teamSide,
        ovrAtGeneration: teamGenerationPlayers.ovrAtGeneration,
      })
      .from(teamGenerationPlayers)
      .where(eq(teamGenerationPlayers.jobId, job.id))

    const genPlayerIds = genPlayers.map((p) => p.playerId).filter(Boolean) as string[]
    const playerData = genPlayerIds.length > 0
      ? await db.select({ id: players.id, displayName: players.displayName, cardState: players.cardState })
          .from(players)
          .where(inArray(players.id, genPlayerIds))
      : []

    const buildTeam = (side: 'A' | 'B') =>
      genPlayers
        .filter((p) => p.teamSide === side)
        .map((p) => {
          const info = playerData.find((r) => r.id === p.playerId)
          return {
            playerId: p.playerId,
            displayName: info?.displayName ?? null,
            cardState: info?.cardState ?? 'not_started',
            ovrScore: p.ovrAtGeneration !== null ? Number(p.ovrAtGeneration) : null,
          }
        })

    return res.json({
      data: {
        jobId,
        status: 'complete',
        generationCount: job.generationNumber,
        teams: {
          teamA: buildTeam('A'),
          teamB: buildTeam('B'),
          fairnessScore: job.fairnessScore !== null ? Number(job.fairnessScore) : 0,
        },
      },
    })
  }),
)

// POST /v1/matches/:matchId/lock-teams — host only
router.post(
  '/:matchId/lock-teams',
  loadMatch,
  requireMatchHost,
  asyncHandler(async (req, res) => {
    const match = req.match
    const matchId = match.id

    if (match.status === 'in_progress' || match.status === 'completed') {
      return res.status(409).json(errorFor(ErrorCode.TEAMS_ALREADY_LOCKED, 409))
    }
    if (match.status !== 'teams_generated') {
      return res.status(422).json(errorFor(ErrorCode.WRONG_MATCH_STATUS, 422, {
        current: match.status, required: 'teams_generated',
      }))
    }

    const [lastJob] = await db
      .select({ id: teamGenerationJobs.id, generationNumber: teamGenerationJobs.generationNumber })
      .from(teamGenerationJobs)
      .where(and(eq(teamGenerationJobs.matchId, matchId), eq(teamGenerationJobs.status, 'complete')))
      .orderBy(sql`${teamGenerationJobs.generationNumber} DESC`)
      .limit(1)

    if (!lastJob) {
      return res.status(422).json(errorFor(ErrorCode.WRONG_MATCH_STATUS, 422, {
        detail: 'No completed team generation found for this match',
      }))
    }

    const genPlayers = await db
      .select({ playerId: teamGenerationPlayers.playerId, teamSide: teamGenerationPlayers.teamSide })
      .from(teamGenerationPlayers)
      .where(eq(teamGenerationPlayers.jobId, lastJob.id))

    const swaps = (match.teamAdjustments ?? []) as Array<{ playerId: string; fromTeam: 'A' | 'B'; toTeam: 'A' | 'B' }>
    const finalPlayers = genPlayers
      .map((gp) => {
        const swap = swaps.find((s) => s.playerId === gp.playerId && s.fromTeam === gp.teamSide)
        return swap ? { ...gp, teamSide: swap.toTeam as 'A' | 'B' } : gp
      })
      .filter((gp): gp is { playerId: string; teamSide: 'A' | 'B' } => gp.playerId !== null)

    const playerIds = finalPlayers.map((p) => p.playerId)
    const playerData = playerIds.length > 0
      ? await db
          .select({ id: players.id, displayName: players.displayName, userId: players.userId })
          .from(players)
          .where(inArray(players.id, playerIds))
      : []

    const playerMap = new Map(playerData.map((p) => [p.id, p]))

    const participantRows = finalPlayers.map((gp) => {
      const p = playerMap.get(gp.playerId)
      return {
        matchId,
        playerId: gp.playerId,
        userId: p?.userId ?? null,
        displayName: p?.displayName ?? 'Unknown Player',
        teamSide: gp.teamSide,
        wasGoalkeeper: false,
      }
    })

    const recipientUserIds = playerData.map((p) => p.userId).filter(Boolean) as string[]

    await db.transaction(async (tx) => {
      await tx
        .update(matches)
        .set({ status: 'in_progress', teamAdjustments: null, updatedAt: new Date() })
        .where(eq(matches.id, matchId))

      if (participantRows.length > 0) {
        await tx.insert(matchParticipants).values(participantRows)
      }
    })

    if (recipientUserIds.length > 0) {
      notificationService.send({ type: 'TEAMS_LOCKED', matchId, groupId: match.groupId, recipientUserIds })
    }

    return res.json({ data: { success: true } })
  }),
)

// PATCH /v1/matches/:matchId/team-adjustment — host only
router.patch(
  '/:matchId/team-adjustment',
  loadMatch,
  requireMatchHost,
  asyncHandler(async (req, res) => {
    const { swaps } = TeamAdjustmentSchema.parse(req.body)
    const match = req.match

    if (match.status === 'in_progress' || match.status === 'completed') {
      return res.status(409).json(errorFor(ErrorCode.TEAMS_ALREADY_LOCKED, 409))
    }
    if (match.status !== 'teams_generated') {
      return res.status(422).json(errorFor(ErrorCode.WRONG_MATCH_STATUS, 422, {
        current: match.status, required: 'teams_generated',
      }))
    }

    await db
      .update(matches)
      .set({ teamAdjustments: swaps, updatedAt: new Date() })
      .where(eq(matches.id, match.id))

    return res.json({ data: { success: true } })
  }),
)

// ---------------------------------------------------------------------------
// Result, MVP, ratings
// ---------------------------------------------------------------------------

// POST /v1/matches/:matchId/result — host only
router.post(
  '/:matchId/result',
  loadMatch,
  requireMatchHost,
  asyncHandler(async (req, res) => {
    const { scoreA, scoreB, playerStats } = RecordResultSchema.parse(req.body)
    const match = req.match
    const matchId = match.id

    if (match.status === 'completed') return res.status(409).json(errorFor(ErrorCode.RESULT_ALREADY_SUBMITTED, 409))
    if (match.status !== 'in_progress') {
      return res.status(422).json(errorFor(ErrorCode.WRONG_MATCH_STATUS, 422, {
        current: match.status, required: 'in_progress',
      }))
    }

    const participants = await db
      .select({ playerId: matchParticipants.playerId, userId: matchParticipants.userId })
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, matchId))

    const completedAt = new Date()

    const resultRecord = await db.transaction(async (tx) => {
      // Concurrency boundary: only one request can transition this match. All
      // downstream counters/evidence are conditional on winning this update.
      const transitioned = await tx
        .update(matches)
        .set({ status: 'completed', completedAt, scoreA, scoreB, updatedAt: new Date() })
        .where(and(eq(matches.id, matchId), eq(matches.status, 'in_progress')))
        .returning({ id: matches.id })

      if (transitioned.length === 0) return null

      for (const stat of playerStats) {
        if (stat.goalsScored > 0 || stat.assists > 0) {
          await tx
            .update(matchParticipants)
            .set({ goalsScored: stat.goalsScored, assists: stat.assists })
            .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.playerId, stat.playerId)))
        }
      }

      if (match.groupId) {
        await tx
          .update(groups)
          .set({ matchCount: sql`${groups.matchCount} + 1`, updatedAt: new Date() })
          .where(eq(groups.id, match.groupId))
      }

      // Card eligibility is NOT recorded here any more. Phase 4 requires a
      // finalized `attended` outcome, which does not exist until the sheet is
      // settled — by the host, or by the automatic sweep 48h later (ADR-029).
      // Recording a result no longer unlocks anything on its own.
      return { newlyUnlocked: [] as Array<{ playerId: string; userId: string }> }
    })

    if (!resultRecord) {
      return res.status(409).json(errorFor(ErrorCode.RESULT_ALREADY_SUBMITTED, 409))
    }

    for (const unlocked of resultRecord.newlyUnlocked) {
      notificationService.send({
        type: 'CARD_UNLOCKED',
        groupId: match.groupId,
        playerId: unlocked.playerId,
        recipientUserId: unlocked.userId,
      })
    }

    // Crew tiering only means something for a crew.
    if (match.groupId) {
      try {
        const [group] = await db
          .select({ matchCount: groups.matchCount })
          .from(groups)
          .where(eq(groups.id, match.groupId))
        const newGroupMatchCount = group?.matchCount ?? 0
        await tierService.evaluateTier(match.groupId, newGroupMatchCount)
      } catch (err) {
        logger.error({ err, groupId: match.groupId }, 'tierService.evaluateTier failed')
      }
    }

    // Settle the betting ledger (Epic 11). Result and correct-score bets settle
    // now; MVP bets stay pending until the vote resolves, which re-runs this.
    betService.settleMatchBets(matchId).catch((err: unknown) => {
      logger.error({ err, matchId }, 'betService.settleMatchBets failed')
    })

    const recipientUserIds = participants.map((p) => p.userId).filter(Boolean) as string[]
    if (recipientUserIds.length > 0) {
      notificationService.send({ type: 'SCORE_SUBMITTED', matchId, groupId: match.groupId, recipientUserIds })
      notificationService.send({ type: 'MVP_VOTING_OPEN', matchId, groupId: match.groupId, recipientUserIds })
    }

    return res.json({ data: { success: true, completedAt: completedAt.toISOString() } })
  }),
)

// GET /v1/matches/:matchId/participants
router.get(
  '/:matchId/participants',
  loadMatch,
  asyncHandler(async (req, res) => {
    const matchId = req.match.id

    // cardState/ovrScore ride along so the pitch board renders from one call —
    // it used to fetch the whole group roster just to colour eleven names.
    const participants = await db
      .select({
        playerId: matchParticipants.playerId,
        displayName: matchParticipants.displayName,
        teamSide: matchParticipants.teamSide,
        userId: matchParticipants.userId,
        cardState: players.cardState,
        ovrScoreFloat: players.ovrScoreFloat,
        matchCount: players.matchCount,
      })
      .from(matchParticipants)
      .leftJoin(players, eq(players.id, matchParticipants.playerId))
      .where(eq(matchParticipants.matchId, matchId))

    const toEntry = (p: (typeof participants)[number]) => ({
      playerId: p.playerId,
      displayName: p.displayName,
      cardState: p.cardState ?? 'not_started',
      ovrScore: ovrService.getOvrForDisplay(
        p.ovrScoreFloat !== null ? Number(p.ovrScoreFloat) : null,
        p.matchCount ?? 0,
      ),
    })

    // Fairness score of the split that was locked — the same last-completed-job
    // rule as lock-teams. Manual swaps don't recompute it (matches the pre-lock display).
    const [lastJob] = await db
      .select({ fairnessScore: teamGenerationJobs.fairnessScore })
      .from(teamGenerationJobs)
      .where(and(eq(teamGenerationJobs.matchId, matchId), eq(teamGenerationJobs.status, 'complete')))
      .orderBy(sql`${teamGenerationJobs.generationNumber} DESC`)
      .limit(1)

    const myPlayerId = req.user.playerId ?? null
    const myTeamSide = participants.find((p) => p.playerId === myPlayerId)?.teamSide ?? null

    return res.json({
      data: {
        myPlayerId,
        myTeamSide,
        fairnessScore: lastJob?.fairnessScore != null ? Number(lastJob.fairnessScore) : null,
        teamA: participants.filter((p) => p.teamSide === 'A').map(toEntry),
        teamB: participants.filter((p) => p.teamSide === 'B').map(toEntry),
      },
    })
  }),
)

// POST /v1/matches/:matchId/mvp-votes — participants only
router.post(
  '/:matchId/mvp-votes',
  loadMatch,
  requireMatchCapability('canRate'),
  requirePlayer,
  asyncHandler(async (req, res) => {
    const { nominatedPlayerId } = SubmitMvpVoteSchema.parse(req.body)
    const match = req.match
    const matchId = match.id

    if (match.status !== 'completed' || !match.completedAt) {
      return res.status(422).json(errorFor(ErrorCode.MVP_VOTING_CLOSED, 422))
    }

    const elapsed = Date.now() - match.completedAt.getTime()
    if (elapsed > 24 * 60 * 60 * 1000 || match.mvpVotingResolvedAt !== null) {
      return res.status(422).json(errorFor(ErrorCode.MVP_VOTING_CLOSED, 422))
    }

    const voterPlayerId = req.user.playerId!

    const [voterParticipant] = await db
      .select({ teamSide: matchParticipants.teamSide })
      .from(matchParticipants)
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.playerId, voterPlayerId)))

    if (!voterParticipant) return res.status(403).json(errorFor(ErrorCode.NOT_A_PARTICIPANT, 403))

    const [nominatedParticipant] = await db
      .select({ teamSide: matchParticipants.teamSide })
      .from(matchParticipants)
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.playerId, nominatedPlayerId)))

    if (!nominatedParticipant) return res.status(403).json(errorFor(ErrorCode.NOT_A_PARTICIPANT, 403))
    if (voterParticipant.teamSide === nominatedParticipant.teamSide) {
      return res.status(422).json(errorFor(ErrorCode.CANNOT_VOTE_OWN_TEAM, 422))
    }

    try {
      await db.insert(mvpVotes).values({ matchId, voterPlayerId, nominatedPlayerId })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        return res.status(409).json(errorFor(ErrorCode.ALREADY_VOTED, 409))
      }
      throw err
    }

    return res.json({ data: { success: true } })
  }),
)

// GET /v1/matches/:matchId/mvp-result
router.get(
  '/:matchId/mvp-result',
  loadMatch,
  asyncHandler(async (req, res) => {
    const match = req.match
    const matchId = match.id

    if (match.status !== 'completed') return res.status(422).json(errorFor(ErrorCode.WRONG_MATCH_STATUS, 422))

    const nameOf = async (playerId: string | null) => {
      if (!playerId) return null
      const [player] = await db.select({ displayName: players.displayName }).from(players).where(eq(players.id, playerId))
      return player?.displayName ?? null
    }

    if (match.mvpVotingResolvedAt) {
      return res.json({
        data: { resolved: true, mvpPlayerId: match.mvpPlayerId, mvpDisplayName: await nameOf(match.mvpPlayerId) },
      })
    }

    const windowClosed = !match.completedAt || Date.now() - match.completedAt.getTime() > 24 * 60 * 60 * 1000
    if (!windowClosed) {
      return res.json({ data: { resolved: false, mvpPlayerId: null, mvpDisplayName: null } })
    }

    const voteTallies = await db
      .select({ nominatedPlayerId: mvpVotes.nominatedPlayerId, voteCount: sql<number>`count(*)::int` })
      .from(mvpVotes)
      .where(eq(mvpVotes.matchId, matchId))
      .groupBy(mvpVotes.nominatedPlayerId)

    let winnerId: string | null = null
    if (voteTallies.length > 0) {
      const maxVotes = Math.max(...voteTallies.map((t) => t.voteCount))
      const topCandidates = voteTallies.filter((t) => t.voteCount === maxVotes)
      winnerId = topCandidates[Math.floor(Math.random() * topCandidates.length)]!.nominatedPlayerId
    }

    // Race-condition guard: only the request that finds it unresolved persists.
    const persisted = await db
      .update(matches)
      .set({ mvpPlayerId: winnerId, mvpVotingResolvedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(matches.id, matchId), isNull(matches.mvpVotingResolvedAt)))
      .returning({ mvpPlayerId: matches.mvpPlayerId })

    const resolvedWinnerId = persisted.length > 0 ? (persisted[0]!.mvpPlayerId ?? null) : winnerId

    // The MVP is now known — settle the bets left pending at result time.
    // Idempotent, so the race-loser above cannot double-credit anything.
    betService.settleMatchBets(matchId).catch((err: unknown) => {
      logger.error({ err, matchId }, 'betService.settleMatchBets failed')
    })

    return res.json({
      data: { resolved: true, mvpPlayerId: resolvedWinnerId, mvpDisplayName: await nameOf(resolvedWinnerId) },
    })
  }),
)

// POST /v1/matches/:matchId/ratings — participants only, within the 48h window
router.post(
  '/:matchId/ratings',
  loadMatch,
  requireMatchCapability('canRate'),
  requirePlayer,
  asyncHandler(async (req, res) => {
    const body = SubmitPostMatchRatingSchema.parse(req.body)
    const match = req.match
    const matchId = match.id
    const raterPlayerId = req.user.playerId!

    try {
      const result = await ratingService.submitPostMatchRating({
        matchId,
        raterPlayerId,
        ratedPlayerId: body.ratedPlayerId,
        values: {
          pace: body.pace,
          technique: body.technique,
          passing: body.passing,
          defending: body.defending,
          physicality: body.physicality,
          effort: body.effort,
        },
      })
      return res.status(201).json({ data: result })
    } catch (error: unknown) {
      if (!(error instanceof RatingSubmissionError)) throw error
      if (error.code === 'RATING_WINDOW_CLOSED' && !match.ratingWindowClosedAt) {
        void ratingService.closeWindow(matchId).catch((err: unknown) => {
          logger.error({ err, matchId }, 'closeWindow failed')
        })
      }
      return res.status(error.statusCode).json(errorFor(ErrorCode[error.code], error.statusCode))
    }
  }),
)

/**
 * Fire-and-forget nudges that used to live inline in GET /:matchId. Both are
 * lazily triggered by reads because there is no scheduler: MVP voting reminders
 * at +12h, rating reminders at +24h, and a lazy close of the rating window.
 */
function sendPostMatchReminders(matchId: string, groupId: string | null): void {
  void (async () => {
    try {
      const [matchRow] = await db
        .select({
          status: matches.status,
          completedAt: matches.completedAt,
          mvpVotingResolvedAt: matches.mvpVotingResolvedAt,
          ratingWindowClosedAt: matches.ratingWindowClosedAt,
        })
        .from(matches)
        .where(eq(matches.id, matchId))

      if (!matchRow || matchRow.status !== 'completed' || !matchRow.completedAt) return
      const elapsed = Date.now() - matchRow.completedAt.getTime()
      const HOURS = 60 * 60 * 1000

      // MVP voting reminder — once per confirmed attendee, in the 12–24h band.
      if (!matchRow.mvpVotingResolvedAt && elapsed >= 12 * HOURS && elapsed < 24 * HOURS) {
        const pending = await db
          .select({ playerId: matchAttendances.playerId, userId: players.userId })
          .from(matchAttendances)
          .innerJoin(players, eq(players.id, matchAttendances.playerId))
          .where(and(
            eq(matchAttendances.matchId, matchId),
            eq(matchAttendances.status, 'in'),
            eq(matchAttendances.mvpReminderSent, false),
            isNull(matchAttendances.waitlistPosition),
          ))

        for (const row of pending) {
          // Mark sent BEFORE dispatching — prevents a double-send under concurrency.
          const updated = await db
            .update(matchAttendances)
            .set({ mvpReminderSent: true })
            .where(and(
              eq(matchAttendances.matchId, matchId),
              eq(matchAttendances.playerId, row.playerId!),
              eq(matchAttendances.mvpReminderSent, false),
            ))
            .returning({ id: matchAttendances.id })

          if (updated.length > 0) {
            notificationService.send({ type: 'MVP_VOTING_REMINDER', matchId, groupId, recipientUserId: row.userId })
          }
        }
      }

      // Rating reminder at +24h, then a lazy close of the window at +48h.
      if (matchRow.ratingWindowClosedAt) return
      const WINDOW_MS = 48 * HOURS

      if (elapsed >= 24 * HOURS && elapsed < WINDOW_MS) {
        const participants = await db
          .select({ playerId: matchParticipants.playerId, userId: matchParticipants.userId })
          .from(matchParticipants)
          .where(eq(matchParticipants.matchId, matchId))

        for (const participant of participants) {
          if (!participant.playerId || !participant.userId) continue

          const updated = await db
            .update(matchAttendances)
            .set({ ratingReminderSent: true })
            .where(and(
              eq(matchAttendances.matchId, matchId),
              eq(matchAttendances.playerId, participant.playerId),
              eq(matchAttendances.ratingReminderSent, false),
            ))
            .returning({ id: matchAttendances.id })

          if (updated.length > 0) {
            notificationService.send({ type: 'RATING_REMINDER', matchId, groupId, recipientUserId: participant.userId })
          }
        }
      }

      if (elapsed >= WINDOW_MS) {
        void ratingService.closeWindow(matchId).catch((err: unknown) => {
          logger.error({ err, matchId }, 'closeWindow failed')
        })
      }
    } catch (err: unknown) {
      logger.error({ err, matchId }, 'post-match reminder check failed')
    }
  })()
}

export default router

// ─── Phase 6C — match lifecycle ───────────────────────────────────────────────

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
