import { pgTable, uuid, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core'
import { DEFAULT_CANCELLATION_DEADLINE_HOURS } from '@fivematch/types'
import { users } from './users'

export const formatPresetEnum = pgEnum('format_preset', ['5v5', '6v6', '7v7', 'custom'])
export const goalkeeperModeEnum = pgEnum('goalkeeper_mode', ['fixed', 'rotating', 'none'])
export const playStyleEnum = pgEnum('play_style', ['fixed', 'flexible', 'rotating', 'hybrid'])
export const generatorStyleEnum = pgEnum('generator_style', ['pure_ovr', 'position_aware', 'mixed'])

/**
 * A crew — a standing group of players who game together. Optional now: a match
 * no longer needs one, and a user can use the whole app without ever joining a crew.
 * What lives here is the stuff that only makes sense for a recurring squad:
 * defaults for new matches, the invite code, the crew's own match tally.
 */
export const groups = pgTable('groups', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizerId: uuid('organizer_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  formatPreset: formatPresetEnum('format_preset').notNull(),
  goalkeeperMode: goalkeeperModeEnum('goalkeeper_mode').notNull(),
  playStyle: playStyleEnum('play_style'),
  generatorStyle: generatorStyleEnum('generator_style').notNull().default('pure_ovr'),
  tier: text('tier').notNull().default('amateur'),
  matchCount: integer('match_count').notNull().default(0),
  /**
   * Hours before kickoff that separate an excused absence from a late
   * cancellation (ADR-028). Crews that play at 7am and crews that play on a
   * Sunday afternoon do not have the same idea of "too late to find someone".
   */
  cancellationDeadlineHours: integer('cancellation_deadline_hours')
    .notNull()
    .default(DEFAULT_CANCELLATION_DEADLINE_HOURS),
  inviteCode: text('invite_code').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Group = typeof groups.$inferSelect
export type NewGroup = typeof groups.$inferInsert
