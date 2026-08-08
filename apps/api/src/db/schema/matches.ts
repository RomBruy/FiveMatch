import { pgTable, uuid, text, timestamp, integer, boolean, pgEnum, jsonb, numeric, index } from 'drizzle-orm/pg-core'
import { users } from './users'
import { groups } from './groups'
import { formatPresetEnum, goalkeeperModeEnum, generatorStyleEnum } from './groups'
import { skillLevelEnum } from './players'

export const matchStatusEnum = pgEnum('match_status', [
  'planning',
  'attendance_open',
  'attendance_locked',
  'teams_generated',
  'in_progress',
  'completed',
  'cancelled',
])

/**
 * `private` — only the host's crew sees it (the original behaviour).
 * `public`  — listed on discovery; anyone within range can take one of `openSpots`.
 */
export const matchVisibilityEnum = pgEnum('match_visibility', ['private', 'public'])

/**
 * The root entity of the product. A match may belong to a crew (`groupId`) or
 * stand entirely on its own — a host with no group can publish one and fill it
 * from discovery alone. `groupId` is therefore nullable; anything that used to
 * read it off the route must read it off the match.
 */
export const matches = pgTable('matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  // NULL for a standalone match created straight from discovery.
  groupId: uuid('group_id').references(() => groups.id),
  hostId: uuid('host_id').notNull().references(() => users.id),
  // Set when this match is a materialized occurrence of a recurring series.
  seriesId: uuid('series_id'),
  status: matchStatusEnum('status').notNull().default('attendance_open'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(60),
  format: formatPresetEnum('format').notNull(),
  playersPerTeam: integer('players_per_team').notNull(),
  goalkeeperMode: goalkeeperModeEnum('goalkeeper_mode').notNull(),
  generatorStyle: generatorStyleEnum('generator_style').notNull().default('pure_ovr'),

  // --- Where -----------------------------------------------------------
  // `location` is kept as the human-written address line; the structured
  // fields below are what discovery actually queries on. lat/lng are plain
  // numerics — a bounding box plus haversine is ample at this scale and
  // avoids a PostGIS dependency.
  location: text('location'),
  venueName: text('venue_name'),
  city: text('city'),
  latitude: numeric('latitude', { precision: 9, scale: 6 }),
  longitude: numeric('longitude', { precision: 9, scale: 6 }),

  // --- Marketplace ------------------------------------------------------
  visibility: matchVisibilityEnum('visibility').notNull().default('private'),
  // How many of the total capacity the host is offering to strangers.
  // NULL on a private match. Crew members are never counted against it.
  openSpots: integer('open_spots'),
  skillLevel: skillLevelEnum('skill_level').notNull().default('casual'),
  pricePerPlayer: numeric('price_per_player', { precision: 6, scale: 2 }),
  currency: text('currency').notNull().default('EUR'),
  notes: text('notes'),

  generationCount: integer('generation_count').notNull().default(0),
  matchFullNotified: boolean('match_full_notified').notNull().default(false),
  attendanceReminderSent: boolean('attendance_reminder_sent').notNull().default(false),
  teamAdjustments: jsonb('team_adjustments').$type<Array<{ playerId: string; fromTeam: 'A' | 'B'; toTeam: 'A' | 'B' }>>(),
  scoreA: integer('score_a'),
  scoreB: integer('score_b'),
  // OVR averages snapshotted at the moment teams are locked (teams_generated transition).
  // Used by the post-match pipeline for reproducible outcome adjustment (fix #3).
  // NULL until the first team generation for this match.
  teamAOvrAtLock: numeric('team_a_ovr_at_lock', { precision: 5, scale: 2 }),
  teamBOvrAtLock: numeric('team_b_ovr_at_lock', { precision: 5, scale: 2 }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ratingWindowClosedAt: timestamp('rating_window_closed_at', { withTimezone: true }),
  mvpPlayerId: uuid('mvp_player_id'),
  mvpVotingResolvedAt: timestamp('mvp_voting_resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // Discovery's hot path: upcoming public matches, then filtered by bounding box.
  discoveryIdx: index('matches_discovery_idx').on(table.visibility, table.scheduledAt),
  geoIdx: index('matches_geo_idx').on(table.latitude, table.longitude),
  groupIdx: index('matches_group_idx').on(table.groupId, table.scheduledAt),
}))

export type Match = typeof matches.$inferSelect
export type NewMatch = typeof matches.$inferInsert

/** Total seats in a match. Capacity is symmetric — two teams of `playersPerTeam`. */
export function matchCapacity(playersPerTeam: number): number {
  return playersPerTeam * 2
}
