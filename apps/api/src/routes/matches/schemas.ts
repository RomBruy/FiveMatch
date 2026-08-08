import { z } from 'zod'

const SkillLevelSchema = z.enum(['casual', 'intermediate', 'competitive'])

export const CreateMatchSchema = z.object({
  // Optional — omit for a standalone match created straight from discovery.
  groupId: z.string().uuid().optional().nullable(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(30).max(180).optional(),
  location: z.string().max(200).optional().nullable(),
  venueName: z.string().max(120).optional().nullable(),
  city: z.string().max(120).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  format: z.enum(['5v5', '6v6', '7v7', 'custom']),
  playersPerTeam: z.number().int().min(4).max(20),
  goalkeeperMode: z.enum(['fixed', 'rotating', 'none']),
  generatorStyle: z.enum(['pure_ovr', 'position_aware', 'mixed']).optional(),
  visibility: z.enum(['private', 'public']).optional(),
  openSpots: z.number().int().min(1).max(40).optional().nullable(),
  skillLevel: SkillLevelSchema.optional(),
  pricePerPlayer: z.number().min(0).max(999).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  recurrence: z.object({ frequency: z.enum(['weekly', 'biweekly']) }).optional().nullable(),
}).refine(
  // Publishing with no coordinates makes a match undiscoverable — reject it at
  // the edge rather than silently creating a listing nobody can find.
  (v) => v.visibility !== 'public' || (v.latitude != null && v.longitude != null) || !!v.city,
  { message: 'A public match needs coordinates or a city', path: ['latitude'] },
)

export type CreateMatchInput = z.infer<typeof CreateMatchSchema>

export const DiscoverQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(200).optional(),
  city: z.string().max(120).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  format: z.enum(['5v5', '6v6', '7v7', 'custom']).optional(),
  skillLevel: SkillLevelSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type DiscoverQuery = z.infer<typeof DiscoverQuerySchema>

export const SetVisibilitySchema = z.object({
  visibility: z.enum(['private', 'public']),
  openSpots: z.number().int().min(1).max(40).optional().nullable(),
})

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

// ─── Phase 3 — attendance finalization and behaviour reports ──────────────────

export const FinalizeAttendanceSchema = z.object({
  /** Players the host marks as having turned up late. Applied before deriving. */
  arrivedLatePlayerIds: z.array(z.string().uuid()).optional().default([]),
})

export type FinalizeAttendanceInput = z.infer<typeof FinalizeAttendanceSchema>

export const BEHAVIOUR_CATEGORIES = [
  'dangerous_play',
  'aggression',
  'abusive_language',
  'unsporting',
  'good_spirit',
  'helped_organize',
] as const

export const SubmitBehaviourReportSchema = z.object({
  subjectPlayerId: z.string().uuid(),
  category: z.enum(BEHAVIOUR_CATEGORIES),
  detail: z.string().trim().max(500).optional(),
})

export type SubmitBehaviourReportInput = z.infer<typeof SubmitBehaviourReportSchema>

export const ResolveBehaviourReportSchema = z.object({
  decision: z.enum(['finalized', 'dismissed']),
})

export type ResolveBehaviourReportInput = z.infer<typeof ResolveBehaviourReportSchema>
