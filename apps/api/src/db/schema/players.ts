import { pgTable, uuid, text, timestamp, integer, numeric, pgEnum, boolean } from 'drizzle-orm/pg-core'
import { PRONOS_STARTING_BANKROLL } from '@fivematch/types/algorithm-constants'
import { users } from './users'

export const cardStateEnum = pgEnum('card_state', [
  'not_started', 'in_progress_1', 'in_progress_2', 'in_progress_3', 'unlocked',
])

/** Self-declared level. Shown on open matches so hosts and joiners can size each other up. */
export const skillLevelEnum = pgEnum('skill_level', ['casual', 'intermediate', 'competitive'])

/**
 * The player identity — ONE row per user, global across every match they play.
 *
 * This used to be scoped per group (unique on groupId+userId), which made OVR,
 * the card and the bankroll unreachable to anyone who joined an open match
 * without belonging to a crew. Discovery is the product now, so identity follows
 * the user rather than the group: a crew leaderboard is just this table joined
 * through `group_memberships`.
 */
export const players = pgTable('players', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().unique().references(() => users.id),
  displayName: text('display_name').notNull(),
  matchCount: integer('match_count').notNull().default(0),
  ovrScoreFloat: numeric('ovr_score_float', { precision: 6, scale: 3 }),
  previousOvrScoreFloat: numeric('previous_ovr_score_float', { precision: 6, scale: 3 }),
  playerTier: text('player_tier').notNull().default('rookie'), // evaluated after each EMA update
  cardState: cardStateEnum('card_state').notNull().default('not_started'),
  avgPace: numeric('avg_pace', { precision: 5, scale: 2 }),
  avgTechnique: numeric('avg_technique', { precision: 5, scale: 2 }),
  avgPassing: numeric('avg_passing', { precision: 5, scale: 2 }),
  avgDefending: numeric('avg_defending', { precision: 5, scale: 2 }),
  avgPhysicality: numeric('avg_physicality', { precision: 5, scale: 2 }),
  avgEffort: numeric('avg_effort', { precision: 5, scale: 2 }),
  lastMatchAt: timestamp('last_match_at', { withTimezone: true }),  // nullable — null until first match

  // --- Trust signals -------------------------------------------------------
  // These, not OVR, are what a host and a stranger use to decide about each
  // other. `commitmentCount` counts every confirmed IN; `noShowCount` counts
  // confirmed-IN players who were never locked into a team. Reliability is
  // derived (played / committed) at read time rather than stored, so it cannot drift.
  skillLevel: skillLevelEnum('skill_level').notNull().default('casual'),
  commitmentCount: integer('commitment_count').notNull().default(0),
  noShowCount: integer('no_show_count').notNull().default(0),

  // Pronos betting bankroll (Epic 11) — fictional-points balance, now global.
  // Cached projection of the prono_bets ledger: 1000 + Σpayouts − Σstakes.
  // Mutated ONLY through bankrollService (atomic SQL arithmetic, never read-modify-write).
  pronosBalance: integer('pronos_balance').notNull().default(PRONOS_STARTING_BANKROLL),
  photoConsentGiven: boolean('photo_consent_given').default(false).notNull(),
  /**
   * The player's own photo, used as generation input.
   *
   * Separate from `profilePhotoCardUrl` because the job used to read its input
   * from the same column it wrote its output to: a second generation restyled
   * the already-stylized image instead of the original.
   */
  profilePhotoSourceUrl: text('profile_photo_source_url'),
  /** The generated card portrait. Written by the job, never read by it. */
  profilePhotoCardUrl: text('profile_photo_card_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})

export type Player = typeof players.$inferSelect
export type NewPlayer = typeof players.$inferInsert
