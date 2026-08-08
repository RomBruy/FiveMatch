import { z } from 'zod'

export const syncUserSchema = z.object({
  name: z.string().nullable().optional(),
  email: z.string().email(),
  profilePhotoUrl: z.string().url().nullable().optional(),
  languagePreference: z.enum(['en', 'fr']).default('en'),
})

/**
 * Only `name`, `preferredPosition` and `skillLevel` are required.
 *
 * Every field below them used to be mandatory, which meant a stranger had to
 * supply a former club and a favourite excuse before they could look at a single
 * match. The flavour fields are what make the card worth sharing, so they stay —
 * as an optional pass the user takes when they want to, not a toll gate.
 */
export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  languagePreference: z.enum(['en', 'fr']),
  preferredPosition: z.enum(['goalkeeper', 'defender', 'midfielder', 'forward', 'utility']),
  skillLevel: z.enum(['casual', 'intermediate', 'competitive']),

  profilePhotoUrl: z.string().url().nullable().optional(),
  currentClub: z.string().trim().max(100).nullable().optional(),
  formerClub: z.string().trim().max(100).nullable().optional(),
  strongFoot: z.enum(['left', 'right', 'both']).nullable().optional(),
  playerStyle: z.enum(['playmaker', 'finisher', 'engine', 'wall', 'wildcard']).nullable().optional(),
  specialSkill: z.string().trim().max(50).nullable().optional(),
  favoriteExcuse: z.string().trim().max(60).nullable().optional(),
  badFaithLevel: z.number().int().min(1).max(5).nullable().optional(),
  lockerRoomStyle: z.string().trim().max(40).nullable().optional(),
  thirdHalfProfile: z.string().trim().max(50).nullable().optional(),
})

export type SyncUserBody = z.infer<typeof syncUserSchema>
