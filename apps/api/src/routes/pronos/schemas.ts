import { z } from 'zod'

export const SubmitPronosSchema = z.object({
  predictionResult: z.enum(['teamA', 'draw', 'teamB']),
  predictionMvpPlayerId: z.string().uuid().nullable(),
  predictionScoreA: z.number().int().min(0).max(99),
  predictionScoreB: z.number().int().min(0).max(99),
})

export type SubmitPronosInput = z.infer<typeof SubmitPronosSchema>
