import { pgTable, uuid, text, timestamp, integer, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users'
import { players } from './players'
import { matches } from './matches'

export const teamSideEnum = pgEnum('team_side', ['A', 'B'])

export const matchParticipants = pgTable('match_participants', {
  id: uuid('id').defaultRandom().primaryKey(),
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  playerId: uuid('player_id').references(() => players.id),    // nullable — GDPR anonymization target
  userId: uuid('user_id').references(() => users.id),          // nullable — GDPR anonymization target
  displayName: text('display_name').notNull(),                 // denormalized name snapshot; randomized on GDPR, NOT nulled
  teamSide: teamSideEnum('team_side').notNull(),
  position: text('position'),
  wasGoalkeeper: boolean('was_goalkeeper').notNull().default(false),
  goalsScored: integer('goals_scored').notNull().default(0),
  assists: integer('assists').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type MatchParticipant = typeof matchParticipants.$inferSelect
export type NewMatchParticipant = typeof matchParticipants.$inferInsert
