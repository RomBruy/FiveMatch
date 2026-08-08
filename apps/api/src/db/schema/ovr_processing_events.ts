import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { matches } from './matches'
import { players } from './players'

/** A committed row means the matching OVR operation completed atomically. */
export const ovrProcessingEvents = pgTable('ovr_processing_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  matchId: uuid('match_id').notNull().references(() => matches.id),
  playerId: uuid('player_id').notNull().references(() => players.id),
  processingType: text('processing_type').notNull().default('MATCH_UPDATE'),
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueMatchPlayerType: unique('ovr_processing_events_match_player_type_unique')
    .on(table.matchId, table.playerId, table.processingType),
  playerIndex: index('ovr_processing_events_player_idx').on(table.playerId),
}))

export type OvrProcessingEvent = typeof ovrProcessingEvents.$inferSelect
export type NewOvrProcessingEvent = typeof ovrProcessingEvents.$inferInsert
