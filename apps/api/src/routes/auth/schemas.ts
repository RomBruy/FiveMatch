import { z } from 'zod'

export const syncUserSchema = z.object({
  name: z.string().nullable().optional(),
  email: z.string().email(),
  profilePhotoUrl: z.string().url().nullable().optional(),
  languagePreference: z.enum(['en', 'fr']).default('en'),
})

export type SyncUserBody = z.infer<typeof syncUserSchema>
