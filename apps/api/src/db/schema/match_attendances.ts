import { pgTable, uuid, timestamp, integer, boolean, pgEnum, unique } from 'drizzle-orm/pg-core'
import { matches } from './matches'
import { players } from './players'

export const attendanceStatusEnum = pgEnum('attendance_status', ['in', 'out', 'unknown'])

/** How this player came to be on the sheet — drives who counts against `openSpots`. */
export const attendanceSourceEnum = pgEnum('attendance_source', ['crew', 'open'])

/**
 * What actually happened, decided once the match is over (Phase 3, ADR-028).
 * Distinct from `status`, which is only ever an intention: RSVP is what you said,
 * outcome is what you did. Null means unknown and stays that way — no historical
 * row is ever guessed into an outcome.
 */
export const attendanceOutcomeEnum = pgEnum('attendance_outcome', [
  'attended',
  'excused',
  'late_cancel',
  'no_show',
])

/**
 * Why a seat was given up — self-declared, one tap, never typed.
 *
 * Closed on purpose. Someone withdrawing is already late and under pressure;
 * three options they can hit without composing a sentence is the point, and it
 * leaves no free-text moderation surface.
 *
 * `wrong_date` is separated from the other two because it is not really a
 * withdrawal: that player was never coming, so it must never read as a
 * reliability signal.
 */
export const cancellationReasonEnum = pgEnum('cancellation_reason', [
  'unexpected',
  'injured',
  'wrong_date',
])

export const matchAttendances = pgTable('match_attendances', {
  id: uuid('id').defaultRandom().primaryKey(),
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  playerId: uuid('player_id').references(() => players.id), // nullable — soft-delete safe
  status: attendanceStatusEnum('status').notNull().default('unknown'),
  // 'crew' — seeded from the host's group at creation, or a crew member responding late.
  // 'open' — claimed a published spot from discovery. Only these count against openSpots.
  source: attendanceSourceEnum('source').notNull().default('crew'),
  waitlistPosition: integer('waitlist_position'),           // nullable; non-null = on waitlist
  respondedAt: timestamp('responded_at', { withTimezone: true }),

  // ─── Final attendance (Phase 3) ───────────────────────────────────────────
  // Null until the host finalizes the match. Never backfilled: a pre-Phase-3
  // row has no evidence of what happened and must stay unknown.
  outcome: attendanceOutcomeEnum('outcome'),
  /**
   * When this player gave up a confirmed seat. Stored as a fact rather than a
   * verdict — `excused` vs `late_cancel` is derived from it against the crew's
   * deadline at finalization, so retuning the threshold leaves history
   * recomputable instead of frozen at whatever the rule was that week.
   */
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  /**
   * Why, as declared by the player. Null for every cancellation recorded before
   * this existed, and for anyone who backs out without going through the sheet —
   * null means "not stated", never "no reason".
   *
   * Shown to the organiser and never used in the reliability maths: `excused` vs
   * `late_cancel` stays a function of timing against the deadline (ADR-028). A
   * self-declared reason is not evidence, and scoring it would only teach people
   * to pick the softest option.
   */
  cancellationReason: cancellationReasonEnum('cancellation_reason'),
  /** Separate from outcome: you can turn up and still be late. Host-set. */
  arrivedLate: boolean('arrived_late').notNull().default(false),
  finalizedAt: timestamp('finalized_at', { withTimezone: true }),
  finalizedBy: uuid('finalized_by').references(() => players.id),
  mvpReminderSent: boolean('mvp_reminder_sent').notNull().default(false),
  ratingReminderSent: boolean('rating_reminder_sent').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // One sheet row per player per match. The open-join path races against the
  // crew seed, so this constraint is what actually keeps them honest.
  uniquePlayerInMatch: unique('match_attendances_match_player_unique').on(table.matchId, table.playerId),
  /**
   * One player per waitlist position. Positions are assigned behind the
   * per-match lock, so a collision should be impossible — this makes it
   * impossible rather than merely unlikely. NULLs are distinct in Postgres, so
   * confirmed players do not collide with each other (AF-005).
   */
  uniqueWaitlistPosition: unique('match_attendances_match_waitlist_position_unique')
    .on(table.matchId, table.waitlistPosition),
}))

export type MatchAttendance = typeof matchAttendances.$inferSelect
export type NewMatchAttendance = typeof matchAttendances.$inferInsert
