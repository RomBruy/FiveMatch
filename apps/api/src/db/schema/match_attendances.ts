import { pgTable, uuid, timestamp, integer, boolean, pgEnum } from 'drizzle-orm/pg-core'
import { matches } from './matches'
import { players } from './players'

export const attendanceStatusEnum = pgEnum('attendance_status', ['in', 'out', 'unknown'])

export const matchAttendances = pgTable('match_attendances', {
  id: uuid('id').defaultRandom().primaryKey(),
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  playerId: uuid('player_id').references(() => players.id), // nullable — soft-delete safe
  status: attendanceStatusEnum('status').notNull().default('unknown'),
  waitlistPosition: integer('waitlist_position'),           // nullable; non-null = on waitlist
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  mvpReminderSent: boolean('mvp_reminder_sent').notNull().default(false),
  ratingReminderSent: boolean('rating_reminder_sent').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type MatchAttendance = typeof matchAttendances.$inferSelect
export type NewMatchAttendance = typeof matchAttendances.$inferInsert
