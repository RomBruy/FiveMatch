import { z } from 'zod'

export const syncUserSchema = z.object({
  name: z.string().nullable().optional(),
  email: z.string().email(),
  profilePhotoUrl: z.string().url().nullable().optional(),
  languagePreference: z.enum(['en', 'fr']).default('en'),
})

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  languagePreference: z.enum(['en', 'fr']),
  profilePhotoUrl: z.string().url().nullable().optional(),
  currentClub: z.string().trim().max(100).nullable(),
  formerClub: z.string().trim().max(100).nullable(),
  preferredPosition: z.enum(['goalkeeper', 'defender', 'midfielder', 'forward', 'utility']),
  strongFoot: z.enum(['left', 'right', 'both']),
  playerStyle: z.enum(['playmaker', 'finisher', 'engine', 'wall', 'wildcard']),
  specialSkill: z.string().trim().max(50).nullable(),
  favoriteExcuse: z.string().trim().max(60).nullable(),
  badFaithLevel: z.number().int().min(1).max(5),
  lockerRoomStyle: z.string().trim().max(40).nullable(),
  thirdHalfProfile: z.string().trim().max(50).nullable(),
})

export type SyncUserBody = z.infer<typeof syncUserSchema>
