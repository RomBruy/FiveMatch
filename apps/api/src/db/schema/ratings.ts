import { pgTable, uuid, boolean, timestamp, integer } from 'drizzle-orm/pg-core'
import { groups } from './groups'
import { players } from './players'
import { matches } from './matches'

export const ratings = pgTable('ratings', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').notNull().references(() => groups.id),
  matchId: uuid('match_id').references(() => matches.id), // nullable — null for initial ratings; set for post-match ratings
  raterPlayerId: uuid('rater_player_id'), // nullable — GDPR anonymization target, never returned in API responses
  ratedPlayerId: uuid('rated_player_id').notNull().references(() => players.id),
  pace: integer('pace').notNull(),
  technique: integer('technique').notNull(),
  passing: integer('passing').notNull(),
  defending: integer('defending').notNull(),
  physicality: integer('physicality').notNull(),
  effort: integer('effort').notNull(),
  mentality: integer('mentality').notNull(), // personality dimension — stored, NOT included in OVR formula
  isInitial: boolean('is_initial').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Rating = typeof ratings.$inferSelect
export type NewRating = typeof ratings.$inferInsert
