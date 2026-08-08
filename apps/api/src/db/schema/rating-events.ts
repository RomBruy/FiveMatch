import { pgTable, uuid, numeric, text, jsonb, timestamp, unique } from 'drizzle-orm/pg-core'
import { players } from './players'
import { matches } from './matches'

export const ratingEvents = pgTable('rating_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  matchId: uuid('match_id').references(() => matches.id),
  eventType: text('event_type').notNull(),      // 'INITIAL_SEED' | 'MATCH_UPDATE'
  oldOvr: numeric('old_ovr', { precision: 6, scale: 3 }),  // nullable — null for INITIAL_SEED
  newOvr: numeric('new_ovr', { precision: 6, scale: 3 }).notNull(),
  seedStatus: text('seed_status'),  // 'PROVISIONAL' | 'CONFIDENT' | null (null for MATCH_UPDATE)
  breakdown: jsonb('breakdown').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueMatchPlayerType: unique('rating_events_match_player_type_unique')
    .on(table.matchId, table.playerId, table.eventType),
}))
