import { pgTable, uuid, text, integer, timestamp, unique, pgEnum } from 'drizzle-orm/pg-core'
import { matches } from './matches'
import { players } from './players'

export const predictionResultEnum = pgEnum('prediction_result', ['teamA', 'draw', 'teamB'])

export const pronos = pgTable(
  'pronos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id').notNull().references(() => players.id),
    predictionResult: predictionResultEnum('prediction_result').notNull(),
    predictionMvpPlayerId: uuid('prediction_mvp_player_id').references(() => players.id),
    predictionScore: text('prediction_score').notNull(),
    pointsEarned: integer('points_earned'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique('pronos_match_player_unique').on(t.matchId, t.playerId)],
)

export type Prono = typeof pronos.$inferSelect
export type NewProno = typeof pronos.$inferInsert
