import { pgTable, uuid, text, timestamp, integer, pgEnum, boolean } from 'drizzle-orm/pg-core'
import { users } from './users'

export const formatPresetEnum = pgEnum('format_preset', ['5v5', '6v6', '7v7', 'custom'])
export const goalkeeperModeEnum = pgEnum('goalkeeper_mode', ['fixed', 'rotating', 'none'])
export const playStyleEnum = pgEnum('play_style', ['fixed', 'flexible', 'rotating', 'hybrid'])
export const generatorStyleEnum = pgEnum('generator_style', ['pure_ovr', 'position_aware', 'mixed'])

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
  inviteCode: text('invite_code').unique(),
  searchable: boolean('searchable').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type Group = typeof groups.$inferSelect
export type NewGroup = typeof groups.$inferInsert
