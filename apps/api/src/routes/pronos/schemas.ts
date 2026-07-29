import { z } from 'zod'

// Story 11.3 — placing a bet.
// NOTE: there is deliberately NO odds field. The cote is recomputed server-side from
// teamOvrAtLock at the moment of the bet and frozen onto the ledger row; anything a
// client sends about pricing is ignored. That is the integrity guarantee of the module.
export const PlaceBetSchema = z.object({
  market: z.enum(['result', 'score', 'mvp']),
  selection: z.string().min(1).max(64),
  stake: z.number().int().min(1),
})

export type PlaceBetInput = z.infer<typeof PlaceBetSchema>
