import { pgTable, uuid, text, timestamp, integer, pgEnum, numeric } from 'drizzle-orm/pg-core'
import { users } from './users'
import { groups } from './groups'
import { formatPresetEnum, goalkeeperModeEnum, generatorStyleEnum } from './groups'
import { matchVisibilityEnum } from './matches'
import { skillLevelEnum } from './players'

export const seriesFrequencyEnum = pgEnum('series_frequency', ['weekly', 'biweekly'])

/**
 * A recurring match template (Teams-style). Occurrences are materialized
 * lazily one month ahead — `lastOccurrenceAt` marks the latest match created;
 * fetching upcoming matches extends the series when the horizon moves.
 *
 * Occurrences inherit the discovery fields below, so a weekly game that
 * publishes two spots keeps publishing them without the host re-listing it.
 */
export const matchSeries = pgTable('match_series', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').references(() => groups.id),
  hostId: uuid('host_id').notNull().references(() => users.id),
  frequency: seriesFrequencyEnum('frequency').notNull(),
  location: text('location'),
  venueName: text('venue_name'),
  city: text('city'),
  latitude: numeric('latitude', { precision: 9, scale: 6 }),
  longitude: numeric('longitude', { precision: 9, scale: 6 }),
  visibility: matchVisibilityEnum('visibility').notNull().default('private'),
  openSpots: integer('open_spots'),
  skillLevel: skillLevelEnum('skill_level').notNull().default('casual'),
  pricePerPlayer: numeric('price_per_player', { precision: 6, scale: 2 }),
  // Occurrences are materialised from this row, so the series has to carry the
  // currency or every one of them would revert to the matches-table default.
  currency: text('currency').notNull().default('EUR'),
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
