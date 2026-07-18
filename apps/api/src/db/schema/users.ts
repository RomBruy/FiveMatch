import { integer, pgTable, text, uuid, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkUserId: text('clerk_user_id').unique().notNull(),
  name: text('name'),
  email: text('email').notNull(),
  profilePhotoUrl: text('profile_photo_url'),
  currentClub: text('current_club'),
  formerClub: text('former_club'),
  preferredPosition: text('preferred_position'),
  strongFoot: text('strong_foot'),
  playerStyle: text('player_style'),
  specialSkill: text('special_skill'),
  favoriteExcuse: text('favorite_excuse'),
  badFaithLevel: integer('bad_faith_level'),
  lockerRoomStyle: text('locker_room_style'),
  thirdHalfProfile: text('third_half_profile'),
  onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true }),
  languagePreference: text('language_preference').notNull().default('en'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  purgedAt: timestamp('purged_at', { withTimezone: true }),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
