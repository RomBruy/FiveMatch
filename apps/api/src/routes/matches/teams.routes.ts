import {randomUUID} from 'crypto'
import {Router} from 'express'
import {asyncHandler} from '../../middleware/async-handler'
import {loadMatch, requireMatchHost, requireMatchParticipant} from '../../middleware/match-context'
import {teamGenRateLimit} from '../../middleware/rate-limit'
import {teamGeneratorService} from '../../services/matches/team-generator.service'
import type { GeneratorPlayer, GeneratorOptions } from '../../services/matches/team-generator.service'
import {TeamAdjustmentSchema} from './schemas'
import {ErrorCode} from '@fivematch/types'
import {TEAM_GEN_MAX_GENERATIONS, TEAM_GEN_OVR_FALLBACK} from '@fivematch/types/algorithm-constants'
import {db} from '../../db'
import {matches, teamGenerationJobs, teamGenerationPlayers, matchAttendances, players, matchParticipants} from '../../db/schema'
import {eq, and, isNull, inArray, sql} from 'drizzle-orm'
import {notificationService} from '../../services/notifications/notification.service'
import {chatService} from '../../services/matches/chat.service'

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
 * Team generation, its job polling, locking and manual adjustment.
 *
 * Split out of a 1255-line `index.ts` that mixed five unrelated concerns
 * (Phase 7D). Route order within this file is preserved from the original.
 */

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

    // The single most-awaited moment before kickoff, so it belongs in the thread
    // rather than only in a push somebody may have muted.
    await chatService.recordEvent(matchId, 'teams_drawn')

    return res.json({ data: { success: true } })
  }),
)

// PATCH /v1/matches/:matchId/team-adjustment — host only

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

export default router
