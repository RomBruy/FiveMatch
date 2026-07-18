import { pgTable, uuid, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core'
import { users } from './users'
import { groups } from './groups'
import { formatPresetEnum, goalkeeperModeEnum, generatorStyleEnum } from './groups'

export const seriesFrequencyEnum = pgEnum('series_frequency', ['weekly', 'biweekly'])

/**
 * A recurring match template (Teams-style). Occurrences are materialized
 * lazily one month ahead — `lastOccurrenceAt` marks the latest match created;
 * fetching upcoming matches extends the series when the horizon moves.
 */
export const matchSeries = pgTable('match_series', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').notNull().references(() => groups.id),
  organizerId: uuid('organizer_id').notNull().references(() => users.id),
  frequency: seriesFrequencyEnum('frequency').notNull(),
  location: text('location'),
  format: formatPresetEnum('format').notNull(),
  playersPerTeam: integer('players_per_team').notNull(),
  goalkeeperMode: goalkeeperModeEnum('goalkeeper_mode').notNull(),
  generatorStyle: generatorStyleEnum('generator_style').notNull().default('pure_ovr'),
  lastOccurrenceAt: timestamp('last_occurrence_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type MatchSeries = typeof matchSeries.$inferSelect
export type NewMatchSeries = typeof matchSeries.$inferInsert
