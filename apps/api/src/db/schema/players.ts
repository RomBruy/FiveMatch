import { pgTable, uuid, text, timestamp, integer, numeric, pgEnum, unique, boolean } from 'drizzle-orm/pg-core'
import { users } from './users'
import { groups } from './groups'

export const cardStateEnum = pgEnum('card_state', [
  'not_started', 'in_progress_1', 'in_progress_2', 'in_progress_3', 'unlocked',
])

export const players = pgTable('players', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').notNull().references(() => groups.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  displayName: text('display_name').notNull(),
  matchCount: integer('match_count').notNull().default(0),
  ovrScoreFloat: numeric('ovr_score_float', { precision: 6, scale: 3 }),
  previousOvrScoreFloat: numeric('previous_ovr_score_float', { precision: 6, scale: 3 }),
  playerTier: text('player_tier').notNull().default('rookie'), // evaluated after each EMA update
  cardState: cardStateEnum('card_state').notNull().default('not_started'),
  avgPace: numeric('avg_pace', { precision: 5, scale: 2 }),
  avgTechnique: numeric('avg_technique', { precision: 5, scale: 2 }),
  avgPassing: numeric('avg_passing', { precision: 5, scale: 2 }),
  avgDefending: numeric('avg_defending', { precision: 5, scale: 2 }),
  avgPhysicality: numeric('avg_physicality', { precision: 5, scale: 2 }),
  avgEffort: numeric('avg_effort', { precision: 5, scale: 2 }),
  lastMatchAt: timestamp('last_match_at', { withTimezone: true }),  // nullable — null until first match
  photoConsentGiven: boolean('photo_consent_given').default(false).notNull(),
  profilePhotoCardUrl: text('profile_photo_card_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  uniquePlayerInGroup: unique().on(table.groupId, table.userId),
}))

export type Player = typeof players.$inferSelect
export type NewPlayer = typeof players.$inferInsert
