import { z } from 'zod'

export const ratingParamsSchema = z.object({
  groupId: z.string().uuid(),
  playerId: z.string().uuid(),
})

export const submitInitialRatingSchema = z.object({
  ratedPlayerId: z.string().uuid(),
  pace: z.number().int().min(1).max(10),
  technique: z.number().int().min(1).max(10),
  passing: z.number().int().min(1).max(10),
  defending: z.number().int().min(1).max(10),
  physicality: z.number().int().min(1).max(10),
  effort: z.number().int().min(1).max(10),
  mentality: z.number().int().min(1).max(10),
})
