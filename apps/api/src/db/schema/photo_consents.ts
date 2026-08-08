import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core'
import { players } from './players'

/**
 * What a player agreed to, when, and under which policy text (rule 36).
 *
 * A row per grant rather than a flag on `players`, because consent is an event
 * with a history: withdrawing and granting again are two separate facts, and a
 * later policy version invalidates an earlier agreement without erasing that it
 * was given. The boolean it replaces could express none of that — it could not
 * even say when consent was obtained, which is the first thing anyone asks.
 *
 * Consent is *current* only when the row is not withdrawn and its policy version
 * matches today's. Generation checks both (rule 35).
 */
export const photoConsents = pgTable('photo_consents', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  /** The policy text version the player actually saw. Never back-dated. */
  policyVersion: text('policy_version').notNull(),
  /** Why the data is processed, stored verbatim rather than inferred later. */
  purpose: text('purpose').notNull(),
  /** Days a generated photo is kept after withdrawal. */
  retentionDays: integer('retention_days').notNull(),
  grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull(),
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
}, (table) => ({
  playerIdx: index('photo_consents_player_idx').on(table.playerId, table.grantedAt),
}))

export type PhotoConsent = typeof photoConsents.$inferSelect
export type NewPhotoConsent = typeof photoConsents.$inferInsert
