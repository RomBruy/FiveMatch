import { pgTable, uuid, timestamp, unique } from 'drizzle-orm/pg-core'
import { matches } from './matches'
import { players } from './players'

export const mvpVotes = pgTable('mvp_votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  voterPlayerId: uuid('voter_player_id').notNull().references(() => players.id),
  nominatedPlayerId: uuid('nominated_player_id').notNull().references(() => players.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueVote: unique('mvp_votes_match_voter_unique').on(table.matchId, table.voterPlayerId),
}))

export type MvpVote = typeof mvpVotes.$inferSelect
export type NewMvpVote = typeof mvpVotes.$inferInsert
