import { pgTable, uuid, text, timestamp, integer, boolean, pgEnum, jsonb } from 'drizzle-orm/pg-core'
import { users } from './users'
import { groups } from './groups'
import { formatPresetEnum, goalkeeperModeEnum, generatorStyleEnum } from './groups'

export const matchStatusEnum = pgEnum('match_status', [
  'planning',
  'attendance_open',
  'attendance_locked',
  'teams_generated',
  'in_progress',
  'completed',
  'cancelled',
])

export const matches = pgTable('matches', {
  id: uuid('id').defaultRandom().primaryKey(),
  groupId: uuid('group_id').notNull().references(() => groups.id),
  organizerId: uuid('organizer_id').notNull().references(() => users.id),
  status: matchStatusEnum('status').notNull().default('attendance_open'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
  location: text('location'),
  format: formatPresetEnum('format').notNull(),
  playersPerTeam: integer('players_per_team').notNull(),
  goalkeeperMode: goalkeeperModeEnum('goalkeeper_mode').notNull(),
  generatorStyle: generatorStyleEnum('generator_style').notNull().default('pure_ovr'),
  generationCount: integer('generation_count').notNull().default(0),
  matchFullNotified: boolean('match_full_notified').notNull().default(false),
  attendanceReminderSent: boolean('attendance_reminder_sent').notNull().default(false),
  teamAdjustments: jsonb('team_adjustments').$type<Array<{ playerId: string; fromTeam: 'A' | 'B'; toTeam: 'A' | 'B' }>>(),
  scoreA: integer('score_a'),
  scoreB: integer('score_b'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ratingWindowClosedAt: timestamp('rating_window_closed_at', { withTimezone: true }),
  mvpPlayerId: uuid('mvp_player_id'),
  mvpVotingResolvedAt: timestamp('mvp_voting_resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Match = typeof matches.$inferSelect
export type NewMatch = typeof matches.$inferInsert
