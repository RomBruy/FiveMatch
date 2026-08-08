import { index, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
import { matches } from './matches'
import { players } from './players'

/**
 * Canonical Phase 1 evidence that one global player completed one eligible match.
 *
 * `evidenceVersion` is intentionally explicit: Phase 1 can prove only completed
 * result + final participant snapshot. A later attendance-outcome phase can add
 * its finalized evidence to this record without replacing the identity table.
 */
export const playerMatchEligibilities = pgTable('player_match_eligibilities', {
  id: uuid('id').defaultRandom().primaryKey(),
  matchId: uuid('match_id').notNull().references(() => matches.id),
  playerId: uuid('player_id').notNull().references(() => players.id),
  evidenceVersion: text('evidence_version').notNull().default('phase1_final_participant_v1'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  invalidatedAt: timestamp('invalidated_at', { withTimezone: true }),
  invalidationReason: text('invalidation_reason'),
  /** Null when the system invalidated it (a voided match), set when a person did. */
  invalidatedBy: uuid('invalidated_by').references(() => players.id),
}, (table) => ({
  uniqueMatchPlayer: unique('player_match_eligibilities_match_player_unique').on(table.matchId, table.playerId),
  playerIndex: index('player_match_eligibilities_player_idx').on(table.playerId),
}))

export type PlayerMatchEligibility = typeof playerMatchEligibilities.$inferSelect
export type NewPlayerMatchEligibility = typeof playerMatchEligibilities.$inferInsert
