import { randomUUID } from 'crypto'
import { Router } from 'express'
import { asyncHandler } from '../../middleware/async-handler'
import { requireGroupMember } from '../../middleware/require-group-member'
import { requireOrganizer } from '../../middleware/require-organizer'
import { teamGenRateLimit } from '../../middleware/rate-limit'
import { matchService } from '../../services/matches/match.service'
import { attendanceService } from '../../services/matches/attendance.service'
import { teamGeneratorService } from '../../services/matches/team-generator.service'
import type { GeneratorPlayer, GeneratorOptions } from '../../services/matches/team-generator.service'
import { CreateMatchSchema, AttendanceUpdateSchema, TeamAdjustmentSchema, RecordResultSchema, SubmitMvpVoteSchema, SubmitPostMatchRatingSchema } from './schemas'
import { ErrorCode } from '@fivematch/types'
import { TEAM_GEN_MAX_GENERATIONS, TEAM_GEN_OVR_FALLBACK } from '@fivematch/types/algorithm-constants'
import { db } from '../../db'
import { matches, teamGenerationJobs, teamGenerationPlayers, matchAttendances, players, matchParticipants, groups, mvpVotes, ratings } from '../../db/schema'
import { eq, and, isNull, sql } from 'drizzle-orm'
import { notificationService } from '../../services/notifications/notification.service'
import { tierService } from '../../services/matches/tier.service'
import { pronosService } from '../../services/pronos/prono.service'
import { logger } from '../../lib/logger'
import { ratingService } from '../../services/ratings/rating.service'

// mergeParams: true is required so :groupId from the parent router is visible here
const router = Router({ mergeParams: true })

// POST /v1/groups/:groupId/matches — organizer only
router.post(
  '/',
  requireGroupMember,
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params as { groupId: string }
    const data = CreateMatchSchema.parse(req.body)
    const match = await matchService.createMatch(groupId, req.user.internalId!, data)
    return res.status(201).json({ data: match })
  }),
)

// GET /v1/groups/:groupId/matches?status=completed&limit=10 — any member
router.get(
  '/',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params as { groupId: string }
    const status = req.query['status'] as string | undefined
    const limit = Math.min(parseInt((req.query['limit'] as string) ?? '10', 10), 50)

    // Upcoming list — also lazily extends any live recurring series.
    if (status === 'upcoming') {
      const upcoming = await matchService.getUpcomingMatches(groupId, limit)
      return res.json({ data: { matches: upcoming } })
    }

    if (status !== 'completed') {
      return res.status(400).json({
        error: { code: ErrorCode.VALIDATION_ERROR, statusCode: 400, message: 'status=completed or status=upcoming is required' },
      })
    }

    // 1. Resolve caller's player record for this group (to compute userTeamSide)
    const [callerPlayer] = await db
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.userId, req.user.internalId!), eq(players.groupId, groupId), isNull(players.deletedAt)))

    const callerPlayerId = callerPlayer?.id ?? null

    // 2. Load recent completed matches
    const matchRows = await db
      .select({
        id: matches.id,
        scheduledAt: matches.scheduledAt,
        completedAt: matches.completedAt,
        scoreA: matches.scoreA,
        scoreB: matches.scoreB,
        mvpPlayerId: matches.mvpPlayerId,
      })
      .from(matches)
      .where(and(eq(matches.groupId, groupId), eq(matches.status, 'completed')))
      .orderBy(sql`${matches.completedAt} DESC`)
      .limit(limit)

    if (matchRows.length === 0) {
      return res.json({ data: { matches: [] } })
    }

    // 3. Load MVP display names for all matches in one query
    const mvpPlayerIds = matchRows
      .map((m) => m.mvpPlayerId)
      .filter((id): id is string => id !== null)

    const mvpNames = mvpPlayerIds.length > 0
      ? await db
          .select({ id: players.id, displayName: players.displayName })
          .from(players)
          .where(sql`${players.id} = ANY(${mvpPlayerIds})`)
      : []

    const mvpNameMap = new Map(mvpNames.map((p) => [p.id, p.displayName]))

    // 4. Load caller's participation for these matches
    const matchIds = matchRows.map((m) => m.id)
    const participantRows = callerPlayerId !== null && matchIds.length > 0
      ? await db
          .select({ matchId: matchParticipants.matchId, teamSide: matchParticipants.teamSide })
          .from(matchParticipants)
          .where(and(
            sql`${matchParticipants.matchId} = ANY(${matchIds})`,
            eq(matchParticipants.playerId, callerPlayerId),
          ))
      : []

    const participantMap = new Map(participantRows.map((p) => [p.matchId, p.teamSide]))

    // 5. Compute userResult
    const result = matchRows.map((m) => {
      const userTeamSide = participantMap.get(m.id) ?? null
      let userResult: 'win' | 'loss' | 'draw' | null = null
      if (userTeamSide && m.scoreA !== null && m.scoreB !== null) {
        if (m.scoreA === m.scoreB) userResult = 'draw'
        else if (
          (userTeamSide === 'A' && m.scoreA > m.scoreB) ||
          (userTeamSide === 'B' && m.scoreB > m.scoreA)
        ) {
          userResult = 'win'
        } else {
          userResult = 'loss'
        }
      }
      return {
        matchId: m.id,
        scheduledAt: m.scheduledAt,
        completedAt: m.completedAt,
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        mvpPlayerId: m.mvpPlayerId,
        mvpDisplayName: m.mvpPlayerId ? (mvpNameMap.get(m.mvpPlayerId) ?? null) : null,
        userTeamSide,
        userResult,
      }
    })

    return res.json({ data: { matches: result } })
  }),
)

// GET /v1/groups/:groupId/matches/active — must be before /:matchId to avoid param capture
router.get(
  '/active',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId } = req.params as { groupId: string }
    const match = await matchService.getActiveMatch(groupId)
    return res.json({ data: match })
  }),
)

// GET /v1/groups/:groupId/matches/:matchId — any member
router.get(
  '/:matchId',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }
    const match = await matchService.getMatch(matchId, groupId)
    if (!match) {
      return res.status(404).json({
        error: { code: ErrorCode.MATCH_NOT_FOUND, message: 'Match not found', statusCode: 404 },
      })
    }

    // Fire-and-forget: send MVP voting reminders at the +12h mark
    void (async () => {
      try {
        const [matchRow] = await db
          .select({ status: matches.status, completedAt: matches.completedAt, mvpVotingResolvedAt: matches.mvpVotingResolvedAt })
          .from(matches)
          .where(and(eq(matches.id, matchId), eq(matches.groupId, groupId)))
        if (!matchRow || matchRow.status !== 'completed') return
        if (matchRow.mvpVotingResolvedAt || !matchRow.completedAt) return
        const elapsed = Date.now() - matchRow.completedAt.getTime()
        const twelveHours = 12 * 60 * 60 * 1000
        const twentyFourHours = 24 * 60 * 60 * 1000
        if (elapsed < twelveHours || elapsed >= twentyFourHours) return

        const pendingAttendees = await db
          .select({ playerId: matchAttendances.playerId })
          .from(matchAttendances)
          .where(and(
            eq(matchAttendances.matchId, matchId),
            eq(matchAttendances.status, 'in'),
            eq(matchAttendances.mvpReminderSent, false),
            isNull(matchAttendances.waitlistPosition),
          ))

        for (const row of pendingAttendees) {
          if (!row.playerId) continue
          const [player] = await db
            .select({ userId: players.userId })
            .from(players)
            .where(eq(players.id, row.playerId))
          if (!player) continue
          const updated = await db
            .update(matchAttendances)
            .set({ mvpReminderSent: true })
            .where(and(
              eq(matchAttendances.matchId, matchId),
              eq(matchAttendances.playerId, row.playerId),
              eq(matchAttendances.mvpReminderSent, false),
            ))
            .returning({ id: matchAttendances.id })
          if (updated.length > 0) {
            notificationService.send({ type: 'MVP_VOTING_REMINDER', matchId, groupId, recipientUserId: player.userId })
          }
        }
      } catch { /* fire-and-forget */ }
    })()

    // Rating reminder check — fires once per participant at completedAt + 24h
    void (async () => {
      try {
        const [matchRow] = await db
          .select({ status: matches.status, completedAt: matches.completedAt, ratingWindowClosedAt: matches.ratingWindowClosedAt })
          .from(matches)
          .where(and(eq(matches.id, matchId), eq(matches.groupId, groupId)))

        if (!matchRow || matchRow.status !== 'completed' || !matchRow.completedAt || matchRow.ratingWindowClosedAt) return

        const REMINDER_TRIGGER_MS = 24 * 60 * 60 * 1000
        const WINDOW_MS = 48 * 60 * 60 * 1000
        const reminderTriggerTime = new Date(matchRow.completedAt.getTime() + REMINDER_TRIGGER_MS)
        const windowDeadline = new Date(matchRow.completedAt.getTime() + WINDOW_MS)
        const now = new Date()

        if (now >= reminderTriggerTime && now < windowDeadline) {
          const participants = await db
            .select({ playerId: matchParticipants.playerId, userId: matchParticipants.userId })
            .from(matchParticipants)
            .where(eq(matchParticipants.matchId, matchId))

          for (const participant of participants) {
            if (!participant.playerId || !participant.userId) continue

            const [attendance] = await db
              .select({ ratingReminderSent: matchAttendances.ratingReminderSent })
              .from(matchAttendances)
              .where(and(eq(matchAttendances.matchId, matchId), eq(matchAttendances.playerId, participant.playerId)))

            if (!attendance || attendance.ratingReminderSent) continue

            // Mark sent BEFORE dispatching — prevents double-send on concurrent requests
            await db
              .update(matchAttendances)
              .set({ ratingReminderSent: true })
              .where(and(eq(matchAttendances.matchId, matchId), eq(matchAttendances.playerId, participant.playerId)))

            notificationService.send({
              type: 'RATING_REMINDER',
              matchId,
              groupId,
              recipientUserId: participant.userId,
            })
          }
        }

        // Lazy close: if window has passed, close it fire-and-forget
        if (now >= windowDeadline) {
          void ratingService.closeWindow(matchId).catch((err: unknown) => {
            logger.error({ err, matchId }, 'closeWindow failed')
          })
        }
      } catch (err: unknown) {
        logger.error({ err, matchId }, 'rating reminder check failed')
      }
    })()

    return res.json({ data: match })
  }),
)

// PATCH /v1/groups/:groupId/matches/:matchId/attendance — any group member
router.patch(
  '/:matchId/attendance',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }
    const { status } = AttendanceUpdateSchema.parse(req.body)

    try {
      await attendanceService.markAttendance(matchId, groupId, req.user.internalId!, status)
      void attendanceService.checkAndTriggerReminder(matchId).catch(() => { /* fire-and-forget */ })
      return res.json({ data: { success: true } })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === 'ATTENDANCE_CLOSED') {
        return res.status(422).json({ error: { code: ErrorCode.ATTENDANCE_CLOSED, statusCode: 422 } })
      }
      if (code === 'ALREADY_ON_WAITLIST') {
        return res.status(409).json({ error: { code: ErrorCode.ALREADY_ON_WAITLIST, statusCode: 409 } })
      }
      throw err
    }
  }),
)

// GET /v1/groups/:groupId/matches/:matchId/attendances — any group member
router.get(
  '/:matchId/attendances',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { matchId } = req.params as { matchId: string }
    void attendanceService.checkAndTriggerReminder(matchId).catch(() => { /* fire-and-forget */ })
    const result = await attendanceService.getAttendances(matchId, req.user.internalId)
    return res.json({ data: result })
  }),
)

// POST /v1/groups/:groupId/matches/:matchId/lock-attendance — organizer only
router.post(
  '/:matchId/lock-attendance',
  requireGroupMember,
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const { matchId } = req.params as { matchId: string }
    try {
      await attendanceService.lockAttendance(matchId)
      return res.json({ data: { success: true } })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      const meta = (err as { meta?: { confirmed: number; required: number } }).meta
      if (code === 'INSUFFICIENT_PLAYERS') {
        return res.status(422).json({
          error: { code: ErrorCode.INSUFFICIENT_PLAYERS, statusCode: 422, meta },
        })
      }
      if (code === 'ATTENDANCE_CLOSED') {
        return res.status(422).json({ error: { code: ErrorCode.ATTENDANCE_CLOSED, statusCode: 422 } })
      }
      if (code === 'MATCH_NOT_FOUND') {
        return res.status(404).json({ error: { code: ErrorCode.MATCH_NOT_FOUND, statusCode: 404 } })
      }
      throw err
    }
  }),
)

// POST /v1/groups/:groupId/matches/:matchId/generate-teams — organizer only
router.post(
  '/:matchId/generate-teams',
  requireGroupMember,
  requireOrganizer,
  teamGenRateLimit,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }

    // 1. Load match — verify status = 'attendance_locked'
    const [match] = await db.select({
      id: matches.id,
      status: matches.status,
      generationCount: matches.generationCount,
      goalkeeperMode: matches.goalkeeperMode,
      generatorStyle: matches.generatorStyle,
    }).from(matches).where(and(eq(matches.id, matchId), eq(matches.groupId, groupId)))

    if (!match) {
      return res.status(404).json({ error: { code: ErrorCode.MATCH_NOT_FOUND, statusCode: 404 } })
    }

    if (match.status !== 'attendance_locked' && match.status !== 'teams_generated') {
      return res.status(422).json({ error: { code: ErrorCode.WRONG_MATCH_STATUS, statusCode: 422, meta: { current: match.status, required: 'attendance_locked' } } })
    }

    if (match.generationCount >= TEAM_GEN_MAX_GENERATIONS) {
      return res.status(422).json({ error: { code: ErrorCode.GENERATION_LIMIT_REACHED, statusCode: 422 } })
    }

    // 2. Load confirmed-IN players (waitlistPosition IS NULL = not on waitlist)
    const attendanceRows = await db
      .select({ playerId: matchAttendances.playerId })
      .from(matchAttendances)
      .where(and(
        eq(matchAttendances.matchId, matchId),
        eq(matchAttendances.status, 'in'),
        isNull(matchAttendances.waitlistPosition),
      ))

    const playerIds = attendanceRows.map((r) => r.playerId).filter(Boolean) as string[]

    if (playerIds.length < 2) {
      return res.status(422).json({ error: { code: ErrorCode.INSUFFICIENT_PLAYERS, statusCode: 422, meta: { confirmed: playerIds.length, required: 2 } } })
    }

    // 3. Load player data for all confirmed players
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
      .from(players)
      .where(eq(players.groupId, groupId))

    // Map to GeneratorPlayer[] — use players.id as the identifier
    const generatorPlayers: GeneratorPlayer[] = playerRows
      .filter((p) => playerIds.includes(p.id))
      .map((p) => ({
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

    // 4. Run generator (synchronous pure function — no await)
    const result = teamGeneratorService.generate(generatorPlayers, options)

    // 5. Persist result in transaction
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
        // Increment generationCount and update status (optimistic lock prevents race condition)
        const updateResult = await tx
          .update(matches)
          .set({
            generationCount: newGenerationCount,
            status: 'teams_generated',
            teamAOvrAtLock: String(teamAOvrAtLock),
            teamBOvrAtLock: String(teamBOvrAtLock),
            updatedAt: new Date(),
          })
          .where(and(
            eq(matches.id, matchId),
            eq(matches.generationCount, match.generationCount),
          ))
          .returning({ id: matches.id })

        if (updateResult.length === 0) {
          throw Object.assign(new Error('Concurrent generation conflict'), { code: 'GENERATION_LIMIT_REACHED' })
        }

        // Insert job row
        const [job] = await tx.insert(teamGenerationJobs).values({
          jobId,
          matchId,
          groupId,
          status: 'complete',
          generationNumber: newGenerationCount,
          fairnessScore: String(result.fairnessScore),
        }).returning({ id: teamGenerationJobs.id })

        // Insert player rows
        if (job) {
          const playerInserts = [
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
          ]
          await tx.insert(teamGenerationPlayers).values(playerInserts)
        }
      })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'GENERATION_LIMIT_REACHED') {
        return res.status(422).json({ error: { code: ErrorCode.GENERATION_LIMIT_REACHED, statusCode: 422 } })
      }
      throw err
    }

    // 6. Build response — include cardState for OVR pill visibility decision on client
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

// GET /v1/groups/:groupId/matches/:matchId/generation-result/:jobId — any member
router.get(
  '/:matchId/generation-result/:jobId',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId, matchId, jobId } = req.params as { groupId: string; matchId: string; jobId: string }

    const [job] = await db
      .select()
      .from(teamGenerationJobs)
      .where(and(eq(teamGenerationJobs.jobId, jobId), eq(teamGenerationJobs.matchId, matchId), eq(teamGenerationJobs.groupId, groupId)))

    if (!job) {
      return res.status(404).json({ error: { code: ErrorCode.MATCH_NOT_FOUND, statusCode: 404 } })
    }

    if (job.status === 'processing') {
      return res.json({ data: { jobId, status: 'processing', generationCount: job.generationNumber, teams: null } })
    }

    // status = 'complete' — load player rows
    const genPlayers = await db
      .select({
        playerId: teamGenerationPlayers.playerId,
        teamSide: teamGenerationPlayers.teamSide,
        ovrAtGeneration: teamGenerationPlayers.ovrAtGeneration,
      })
      .from(teamGenerationPlayers)
      .where(eq(teamGenerationPlayers.jobId, job.id))

    // Load cardState for each player to drive OVR pill visibility
    const genPlayerIds = genPlayers.map((p) => p.playerId).filter(Boolean) as string[]
    const playerData = genPlayerIds.length > 0
      ? await db.select({ id: players.id, displayName: players.displayName, cardState: players.cardState })
          .from(players)
          .where(sql`${players.id} = ANY(${genPlayerIds})`)
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

// POST /v1/groups/:groupId/matches/:matchId/lock-teams — organizer only
router.post(
  '/:matchId/lock-teams',
  requireGroupMember,
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }

    // 1. Load match with teamAdjustments
    const [match] = await db
      .select({
        id: matches.id,
        status: matches.status,
        teamAdjustments: matches.teamAdjustments,
      })
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.groupId, groupId)))

    if (!match) {
      return res.status(404).json({ error: { code: ErrorCode.MATCH_NOT_FOUND, statusCode: 404 } })
    }

    if (match.status === 'in_progress' || match.status === 'completed') {
      return res.status(409).json({ error: { code: ErrorCode.TEAMS_ALREADY_LOCKED, statusCode: 409 } })
    }

    if (match.status !== 'teams_generated') {
      return res.status(422).json({ error: { code: ErrorCode.WRONG_MATCH_STATUS, statusCode: 422, meta: { current: match.status, required: 'teams_generated' } } })
    }

    // 2. Load last completed team generation job
    const [lastJob] = await db
      .select({ id: teamGenerationJobs.id, generationNumber: teamGenerationJobs.generationNumber })
      .from(teamGenerationJobs)
      .where(and(eq(teamGenerationJobs.matchId, matchId), eq(teamGenerationJobs.status, 'complete')))
      .orderBy(sql`${teamGenerationJobs.generationNumber} DESC`)
      .limit(1)

    if (!lastJob) {
      return res.status(422).json({ error: { code: ErrorCode.WRONG_MATCH_STATUS, statusCode: 422, meta: { detail: 'No completed team generation found for this match' } } })
    }

    // 3. Load team generation players for this job
    const genPlayers = await db
      .select({
        playerId: teamGenerationPlayers.playerId,
        teamSide: teamGenerationPlayers.teamSide,
      })
      .from(teamGenerationPlayers)
      .where(eq(teamGenerationPlayers.jobId, lastJob.id))

    // 4. Apply staged swaps (if any)
    const swaps = (match.teamAdjustments ?? []) as Array<{ playerId: string; fromTeam: 'A' | 'B'; toTeam: 'A' | 'B' }>
    const finalPlayers = genPlayers.map((gp) => {
      const swap = swaps.find((s) => s.playerId === gp.playerId && s.fromTeam === gp.teamSide)
      return swap ? { ...gp, teamSide: swap.toTeam as 'A' | 'B' } : gp
    }).filter((gp): gp is { playerId: string; teamSide: 'A' | 'B' } => gp.playerId !== null)

    // 5. Load player data (displayName, userId) for match_participants snapshot
    const playerIds = finalPlayers.map((p) => p.playerId)
    const playerData = playerIds.length > 0
      ? await db
          .select({ id: players.id, displayName: players.displayName, userId: players.userId })
          .from(players)
          .where(sql`${players.id} = ANY(${playerIds})`)
      : []

    const playerMap = new Map(playerData.map((p) => [p.id, p]))

    // 6. Build match_participants rows
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

    // 7. Get confirmed players' userIds for notification (outside transaction)
    const confirmedAttendees = await db
      .select({ playerId: matchAttendances.playerId })
      .from(matchAttendances)
      .where(and(
        eq(matchAttendances.matchId, matchId),
        eq(matchAttendances.status, 'in'),
        isNull(matchAttendances.waitlistPosition),
      ))

    const confirmedPlayerIds = confirmedAttendees.map((a) => a.playerId).filter(Boolean) as string[]
    const confirmedPlayerData = confirmedPlayerIds.length > 0
      ? await db
          .select({ userId: players.userId })
          .from(players)
          .where(sql`${players.id} = ANY(${confirmedPlayerIds})`)
      : []
    const recipientUserIds = confirmedPlayerData.map((p) => p.userId).filter(Boolean) as string[]

    // 8. Lock teams in a single transaction
    await db.transaction(async (tx) => {
      await tx
        .update(matches)
        .set({ status: 'in_progress', teamAdjustments: null, updatedAt: new Date() })
        .where(eq(matches.id, matchId))

      if (participantRows.length > 0) {
        await tx.insert(matchParticipants).values(participantRows)
      }
    })

    // 9. Dispatch TEAMS_LOCKED notification (fire-and-forget, outside transaction)
    if (recipientUserIds.length > 0) {
      notificationService.send({
        type: 'TEAMS_LOCKED',
        matchId,
        groupId,
        recipientUserIds,
      })
    }

    return res.json({ data: { success: true } })
  }),
)

// PATCH /v1/groups/:groupId/matches/:matchId/team-adjustment — organizer only
router.patch(
  '/:matchId/team-adjustment',
  requireGroupMember,
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }
    const { swaps } = TeamAdjustmentSchema.parse(req.body)

    const [match] = await db
      .select({ id: matches.id, status: matches.status })
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.groupId, groupId)))

    if (!match) {
      return res.status(404).json({ error: { code: ErrorCode.MATCH_NOT_FOUND, statusCode: 404 } })
    }

    if (match.status === 'in_progress' || match.status === 'completed') {
      return res.status(409).json({ error: { code: ErrorCode.TEAMS_ALREADY_LOCKED, statusCode: 409 } })
    }

    if (match.status !== 'teams_generated') {
      return res.status(422).json({ error: { code: ErrorCode.WRONG_MATCH_STATUS, statusCode: 422, meta: { current: match.status, required: 'teams_generated' } } })
    }

    await db
      .update(matches)
      .set({ teamAdjustments: swaps, updatedAt: new Date() })
      .where(eq(matches.id, matchId))

    return res.json({ data: { success: true } })
  }),
)

// POST /v1/groups/:groupId/matches/:matchId/result — organizer only
router.post(
  '/:matchId/result',
  requireGroupMember,
  requireOrganizer,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }
    const { scoreA, scoreB, playerStats } = RecordResultSchema.parse(req.body)

    // 1. Load match — verify it's in_progress
    const [match] = await db
      .select({ id: matches.id, status: matches.status })
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.groupId, groupId)))

    if (!match) {
      return res.status(404).json({ error: { code: ErrorCode.MATCH_NOT_FOUND, statusCode: 404 } })
    }

    if (match.status === 'completed') {
      return res.status(409).json({ error: { code: ErrorCode.RESULT_ALREADY_SUBMITTED, statusCode: 409 } })
    }

    if (match.status !== 'in_progress') {
      return res.status(422).json({ error: { code: ErrorCode.WRONG_MATCH_STATUS, statusCode: 422, meta: { current: match.status, required: 'in_progress' } } })
    }

    // 2. Load all match_participants for this match
    const participants = await db
      .select({ playerId: matchParticipants.playerId })
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, matchId))

    const participantPlayerIds = participants.map((p) => p.playerId).filter(Boolean) as string[]

    // 3. Load current groups.matchCount for tier evaluation after transaction
    const [group] = await db
      .select({ matchCount: groups.matchCount })
      .from(groups)
      .where(eq(groups.id, groupId))

    const newMatchCount = (group?.matchCount ?? 0) + 1

    // 4. Run result-save transaction
    const completedAt = new Date()

    await db.transaction(async (tx) => {
      // (a) Update match_participants goals/assists for named players
      for (const stat of playerStats) {
        if (stat.goalsScored > 0 || stat.assists > 0) {
          await tx
            .update(matchParticipants)
            .set({ goalsScored: stat.goalsScored, assists: stat.assists })
            .where(and(
              eq(matchParticipants.matchId, matchId),
              eq(matchParticipants.playerId, stat.playerId),
            ))
        }
      }

      // (b) & (c) Transition match to completed, set completedAt and scores
      await tx
        .update(matches)
        .set({
          status: 'completed',
          completedAt,
          scoreA,
          scoreB,
          updatedAt: new Date(),
        })
        .where(eq(matches.id, matchId))

      // (d) Increment groups.matchCount (atomic SQL expression)
      await tx
        .update(groups)
        .set({
          matchCount: sql`${groups.matchCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(groups.id, groupId))

      // (e) Increment players.matchCount for every confirmed participant (atomic SQL expression)
      for (const playerId of participantPlayerIds) {
        await tx
          .update(players)
          .set({ matchCount: sql`${players.matchCount} + 1` })
          .where(eq(players.id, playerId))
      }
    })

    // 5. Post-transaction: tier evaluation (own db operations — not in transaction)
    try {
      await tierService.evaluateTier(groupId, newMatchCount)
    } catch (err) {
      console.error('[result] tierService.evaluateTier failed:', err)
    }

    // 6. Post-transaction: pronos scoring (stub in Epic 4; real in Epic 6)
    pronosService.scoreAndReveal(matchId).catch((err) => {
      console.error('[result] pronosService.scoreAndReveal failed:', err)
    })

    // 7. Load IN player userIds for notification dispatch
    const inAttendees = await db
      .select({ playerId: matchAttendances.playerId })
      .from(matchAttendances)
      .where(and(
        eq(matchAttendances.matchId, matchId),
        eq(matchAttendances.status, 'in'),
        isNull(matchAttendances.waitlistPosition),
      ))

    const inPlayerIds = inAttendees.map((a) => a.playerId).filter(Boolean) as string[]
    const inPlayerData = inPlayerIds.length > 0
      ? await db
          .select({ userId: players.userId })
          .from(players)
          .where(sql`${players.id} = ANY(${inPlayerIds})`)
      : []

    const recipientUserIds = inPlayerData.map((p) => p.userId).filter(Boolean) as string[]

    // 8. Fire-and-forget notifications (outside transaction)
    if (recipientUserIds.length > 0) {
      notificationService.send({
        type: 'SCORE_SUBMITTED',
        matchId,
        groupId,
        recipientUserIds,
      })
      notificationService.send({
        type: 'MVP_VOTING_OPEN',
        matchId,
        groupId,
        recipientUserIds,
      })
    }

    return res.json({ data: { success: true, completedAt: completedAt.toISOString() } })
  }),
)

// GET /v1/groups/:groupId/matches/:matchId/participants — any group member
router.get(
  '/:matchId/participants',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }

    const [match] = await db
      .select({ id: matches.id })
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.groupId, groupId)))

    if (!match) {
      return res.status(404).json({ error: { code: ErrorCode.MATCH_NOT_FOUND, statusCode: 404 } })
    }

    const participants = await db
      .select({
        playerId: matchParticipants.playerId,
        displayName: matchParticipants.displayName,
        teamSide: matchParticipants.teamSide,
        userId: matchParticipants.userId,
      })
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, matchId))

    // Fairness score of the split that was locked — the same last-completed-job
    // rule as lock-teams. Manual swaps don't recompute it (matches the pre-lock display).
    const [lastJob] = await db
      .select({ fairnessScore: teamGenerationJobs.fairnessScore })
      .from(teamGenerationJobs)
      .where(and(eq(teamGenerationJobs.matchId, matchId), eq(teamGenerationJobs.status, 'complete')))
      .orderBy(sql`${teamGenerationJobs.generationNumber} DESC`)
      .limit(1)

    const fairnessScore = lastJob?.fairnessScore != null ? Number(lastJob.fairnessScore) : null

    // Determine current user's team side (null if not a participant)
    const [myPlayer] = await db
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.userId, req.user.internalId!), eq(players.groupId, groupId)))

    const myPlayerId = myPlayer?.id ?? null
    const myParticipant = participants.find((p) => p.playerId === myPlayerId)
    const myTeamSide = myParticipant?.teamSide ?? null

    return res.json({
      data: {
        myPlayerId,
        myTeamSide,
        fairnessScore,
        teamA: participants.filter((p) => p.teamSide === 'A').map((p) => ({ playerId: p.playerId, displayName: p.displayName })),
        teamB: participants.filter((p) => p.teamSide === 'B').map((p) => ({ playerId: p.playerId, displayName: p.displayName })),
      },
    })
  }),
)

// POST /v1/groups/:groupId/matches/:matchId/mvp-votes — any group member who participated
router.post(
  '/:matchId/mvp-votes',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }
    const { nominatedPlayerId } = SubmitMvpVoteSchema.parse(req.body)

    // 1. Load match — verify completed + window open + not yet resolved
    const [match] = await db
      .select({ id: matches.id, status: matches.status, completedAt: matches.completedAt, mvpVotingResolvedAt: matches.mvpVotingResolvedAt })
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.groupId, groupId)))

    if (!match) {
      return res.status(404).json({ error: { code: ErrorCode.MATCH_NOT_FOUND, statusCode: 404 } })
    }

    if (match.status !== 'completed' || !match.completedAt) {
      return res.status(422).json({ error: { code: ErrorCode.MVP_VOTING_CLOSED, statusCode: 422 } })
    }

    const elapsed = Date.now() - match.completedAt.getTime()
    if (elapsed > 24 * 60 * 60 * 1000 || match.mvpVotingResolvedAt !== null) {
      return res.status(422).json({ error: { code: ErrorCode.MVP_VOTING_CLOSED, statusCode: 422 } })
    }

    // 2. Resolve voter's player record for this group (internalId = users.id = players.userId)
    const [voterPlayer] = await db
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.userId, req.user.internalId!), eq(players.groupId, groupId)))

    if (!voterPlayer) {
      return res.status(403).json({ error: { code: ErrorCode.NOT_A_PARTICIPANT, statusCode: 403 } })
    }

    // 3. Verify voter participated in the match
    const [voterParticipant] = await db
      .select({ teamSide: matchParticipants.teamSide })
      .from(matchParticipants)
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.playerId, voterPlayer.id)))

    if (!voterParticipant) {
      return res.status(403).json({ error: { code: ErrorCode.NOT_A_PARTICIPANT, statusCode: 403 } })
    }

    // 4. Verify nominated player participated in the match
    const [nominatedParticipant] = await db
      .select({ teamSide: matchParticipants.teamSide })
      .from(matchParticipants)
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.playerId, nominatedPlayerId)))

    if (!nominatedParticipant) {
      return res.status(403).json({ error: { code: ErrorCode.NOT_A_PARTICIPANT, statusCode: 403 } })
    }

    // 5. Must vote for opposing team
    if (voterParticipant.teamSide === nominatedParticipant.teamSide) {
      return res.status(422).json({ error: { code: ErrorCode.CANNOT_VOTE_OWN_TEAM, statusCode: 422 } })
    }

    // 6. Insert vote — unique constraint prevents duplicate votes
    try {
      await db.insert(mvpVotes).values({ matchId, voterPlayerId: voterPlayer.id, nominatedPlayerId })
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        return res.status(409).json({ error: { code: ErrorCode.ALREADY_VOTED, statusCode: 409 } })
      }
      throw err
    }

    return res.json({ data: { success: true } })
  }),
)

// GET /v1/groups/:groupId/matches/:matchId/mvp-result — any group member
router.get(
  '/:matchId/mvp-result',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }

    const [match] = await db
      .select({ id: matches.id, status: matches.status, completedAt: matches.completedAt, mvpPlayerId: matches.mvpPlayerId, mvpVotingResolvedAt: matches.mvpVotingResolvedAt })
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.groupId, groupId)))

    if (!match) {
      return res.status(404).json({ error: { code: ErrorCode.MATCH_NOT_FOUND, statusCode: 404 } })
    }

    if (match.status !== 'completed') {
      return res.status(422).json({ error: { code: ErrorCode.WRONG_MATCH_STATUS, statusCode: 422 } })
    }

    // Already resolved — return persisted result
    if (match.mvpVotingResolvedAt) {
      let mvpDisplayName: string | null = null
      if (match.mvpPlayerId) {
        const [player] = await db
          .select({ displayName: players.displayName })
          .from(players)
          .where(eq(players.id, match.mvpPlayerId))
        mvpDisplayName = player?.displayName ?? null
      }
      return res.json({ data: { resolved: true, mvpPlayerId: match.mvpPlayerId, mvpDisplayName } })
    }

    // Check if window is still open
    const windowClosed = !match.completedAt || Date.now() - match.completedAt.getTime() > 24 * 60 * 60 * 1000
    if (!windowClosed) {
      return res.json({ data: { resolved: false, mvpPlayerId: null, mvpDisplayName: null } })
    }

    // Window closed — resolve now
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

    // Persist with race-condition guard (only update if still unresolved)
    const persisted = await db
      .update(matches)
      .set({ mvpPlayerId: winnerId, mvpVotingResolvedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(matches.id, matchId), isNull(matches.mvpVotingResolvedAt)))
      .returning({ mvpPlayerId: matches.mvpPlayerId })

    const resolvedWinnerId = persisted.length > 0
      ? (persisted[0]!.mvpPlayerId ?? null)
      : winnerId // another request won the race — result is the same anyway

    let mvpDisplayName: string | null = null
    if (resolvedWinnerId) {
      const [player] = await db
        .select({ displayName: players.displayName })
        .from(players)
        .where(eq(players.id, resolvedWinnerId))
      mvpDisplayName = player?.displayName ?? null
    }

    return res.json({ data: { resolved: true, mvpPlayerId: resolvedWinnerId, mvpDisplayName } })
  }),
)

// POST /v1/groups/:groupId/matches/:matchId/ratings — confirmed participant only, within 48h window
router.post(
  '/:matchId/ratings',
  requireGroupMember,
  asyncHandler(async (req, res) => {
    const { groupId, matchId } = req.params as { groupId: string; matchId: string }
    const body = SubmitPostMatchRatingSchema.parse(req.body)
    const userId = req.user.internalId!

    // 1. Load match — must be completed
    const [match] = await db
      .select({
        id: matches.id,
        status: matches.status,
        completedAt: matches.completedAt,
        ratingWindowClosedAt: matches.ratingWindowClosedAt,
        groupId: matches.groupId,
      })
      .from(matches)
      .where(and(eq(matches.id, matchId), eq(matches.groupId, groupId)))

    if (!match) {
      return res.status(404).json({ error: { code: ErrorCode.MATCH_NOT_FOUND, statusCode: 404 } })
    }

    if (match.status !== 'completed') {
      return res.status(422).json({ error: { code: ErrorCode.WRONG_MATCH_STATUS, statusCode: 422, meta: { current: match.status, required: 'completed' } } })
    }

    // 2. Check rating window — lazy close if window has expired
    if (!ratingService.isWindowOpen(match)) {
      if (!match.ratingWindowClosedAt) {
        void ratingService.closeWindow(matchId).catch((err: unknown) => {
          logger.error({ err, matchId }, 'closeWindow failed')
        })
      }
      return res.status(422).json({ error: { code: ErrorCode.RATING_WINDOW_CLOSED, statusCode: 422 } })
    }

    // 3. Resolve rater's playerId for this group
    const [raterPlayer] = await db
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.userId, userId), eq(players.groupId, groupId), isNull(players.deletedAt)))

    if (!raterPlayer) {
      return res.status(403).json({ error: { code: ErrorCode.NOT_A_MEMBER, statusCode: 403 } })
    }
    const raterPlayerId = raterPlayer.id

    // 4. Verify rater was a participant in this match
    const [raterParticipant] = await db
      .select({ id: matchParticipants.id })
      .from(matchParticipants)
      .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.playerId, raterPlayerId)))

    if (!raterParticipant) {
      return res.status(403).json({ error: { code: ErrorCode.NOT_A_PARTICIPANT, statusCode: 403 } })
    }

    // 5. Check for duplicate rating in this match
    const [existingRating] = await db
      .select({ id: ratings.id })
      .from(ratings)
      .where(and(
        eq(ratings.matchId, matchId),
        eq(ratings.raterPlayerId, raterPlayerId),
        eq(ratings.ratedPlayerId, body.ratedPlayerId),
        eq(ratings.isInitial, false),
      ))

    if (existingRating) {
      return res.status(409).json({ error: { code: ErrorCode.ALREADY_RATED, statusCode: 409 } })
    }

    // 6. Persist rating — raterPlayerId stored server-side, NEVER in response
    await db.insert(ratings).values({
      groupId,
      matchId,
      raterPlayerId,
      ratedPlayerId: body.ratedPlayerId,
      pace: body.pace,
      technique: body.technique,
      passing: body.passing,
      defending: body.defending,
      physicality: body.physicality,
      effort: body.effort,
      mentality: 5, // post-match ratings do not collect mentality — store neutral default per NOT NULL constraint
      isInitial: false,
    })

    return res.status(201).json({ data: { rated: true } })
  }),
)

export default router
