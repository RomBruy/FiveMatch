import { z } from 'zod'

export const CreateMatchSchema = z.object({
  scheduledAt: z.string().datetime(),
  location: z.string().max(200).optional().nullable(),
  format: z.enum(['5v5', '6v6', '7v7', 'custom']),
  playersPerTeam: z.number().int().min(5).max(20),
  goalkeeperMode: z.enum(['fixed', 'rotating', 'none']),
  generatorStyle: z.enum(['pure_ovr', 'position_aware', 'mixed']).optional(),
  recurrence: z.object({ frequency: z.enum(['weekly', 'biweekly']) }).optional().nullable(),
})

export type CreateMatchInput = z.infer<typeof CreateMatchSchema>

export const AttendanceUpdateSchema = z.object({
  status: z.enum(['in', 'out', 'unknown']),
})

export type AttendanceUpdateInput = z.infer<typeof AttendanceUpdateSchema>

export const TeamSwapSchema = z.object({
  playerId: z.string().uuid(),
  fromTeam: z.enum(['A', 'B']),
  toTeam: z.enum(['A', 'B']),
})

export const TeamAdjustmentSchema = z.object({
  swaps: z.array(TeamSwapSchema),
})

export type TeamAdjustmentInput = z.infer<typeof TeamAdjustmentSchema>

export const PlayerStatSchema = z.object({
  playerId: z.string().uuid(),
  goalsScored: z.number().int().min(0).default(0),
  assists: z.number().int().min(0).default(0),
})

export const RecordResultSchema = z.object({
  scoreA: z.number().int().min(0),
  scoreB: z.number().int().min(0),
  playerStats: z.array(PlayerStatSchema).optional().default([]),
})

export type RecordResultInput = z.infer<typeof RecordResultSchema>

export const SubmitMvpVoteSchema = z.object({
  nominatedPlayerId: z.string().uuid(),
})

export type SubmitMvpVoteInput = z.infer<typeof SubmitMvpVoteSchema>

export const SubmitPostMatchRatingSchema = z.object({
  ratedPlayerId: z.string().uuid(),
  pace: z.number().int().min(1).max(10),
  technique: z.number().int().min(1).max(10),
  passing: z.number().int().min(1).max(10),
  defending: z.number().int().min(1).max(10),
  physicality: z.number().int().min(1).max(10),
  effort: z.number().int().min(1).max(10),
})

export type SubmitPostMatchRatingInput = z.infer<typeof SubmitPostMatchRatingSchema>
