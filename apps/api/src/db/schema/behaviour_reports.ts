import { pgTable, uuid, text, timestamp, pgEnum, unique, index } from 'drizzle-orm/pg-core'
import { matches } from './matches'
import { players } from './players'

/**
 * Negative categories count against fair play; positive ones credit it.
 * Kept deliberately small — a long taxonomy invites reporters to reach for
 * whichever label sounds worst rather than the one that fits.
 */
export const behaviourReportCategoryEnum = pgEnum('behaviour_report_category', [
  'dangerous_play',
  'aggression',
  'abusive_language',
  'unsporting',
  'good_spirit',
  'helped_organize',
])

/**
 * `pending`   — submitted, counts for nothing yet.
 * `finalized` — validated, or corroborated by enough independent reporters.
 * `dismissed` — a validator rejected it.
 * `expired`   — nobody resolved it inside the window. Permanently inert.
 *
 * Only `finalized` reaches a fair-play projection (ADR-019).
 */
export const behaviourReportStatusEnum = pgEnum('behaviour_report_status', [
  'pending',
  'finalized',
  'dismissed',
  'expired',
])

/**
 * One player's account of another's behaviour at one match.
 *
 * Reporter identity is stored because disputes cannot be adjudicated without it,
 * and is never serialized to the subject or to any public surface — not in
 * responses, not in notifications, not in logs (ADR-019, ADR-027).
 */
export const behaviourReports = pgTable(
  'behaviour_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
    reporterPlayerId: uuid('reporter_player_id').references(() => players.id),
    subjectPlayerId: uuid('subject_player_id').notNull().references(() => players.id),
    category: behaviourReportCategoryEnum('category').notNull(),
    status: behaviourReportStatusEnum('status').notNull().default('pending'),
    /** Optional free text from the reporter. Never shown to the subject. */
    detail: text('detail'),
    /** Who finalized or dismissed it. Null for corroboration and expiry. */
    validatorPlayerId: uuid('validator_player_id').references(() => players.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    /** Pending past this instant is expired, whether or not a sweep has run. */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // One reporter gets one voice per subject per category per match. Without
    // this, corroboration could be manufactured by a single person filing twice.
    uniqueReport: unique('behaviour_reports_reporter_subject_category_unique').on(
      table.matchId,
      table.reporterPlayerId,
      table.subjectPlayerId,
      table.category,
    ),
    // Corroboration counts peers on the same match/subject/category.
    corroborationIdx: index('behaviour_reports_corroboration_idx').on(
      table.matchId,
      table.subjectPlayerId,
      table.category,
    ),
    // Fair play reads finalized reports for one subject.
    subjectStatusIdx: index('behaviour_reports_subject_status_idx').on(
      table.subjectPlayerId,
      table.status,
    ),
  }),
)

export type BehaviourReport = typeof behaviourReports.$inferSelect
export type NewBehaviourReport = typeof behaviourReports.$inferInsert
