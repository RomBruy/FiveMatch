import { z } from 'zod'

export const playerParamsSchema = z.object({
  groupId: z.string().uuid(),
  playerId: z.string().uuid(),
})
