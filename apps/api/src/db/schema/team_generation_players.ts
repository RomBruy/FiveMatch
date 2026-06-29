import { pgTable, uuid, timestamp, numeric } from 'drizzle-orm/pg-core'
import { teamGenerationJobs } from './team_generation_jobs'
import { players } from './players'
import { teamSideEnum } from './match_participants'  // reuse existing pgEnum — DO NOT redefine 'team_side'

export const teamGenerationPlayers = pgTable('team_generation_players', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: uuid('job_id').notNull().references(() => teamGenerationJobs.id),
  playerId: uuid('player_id').references(() => players.id),  // nullable — purge safety (Story 5.5)
  teamSide: teamSideEnum('team_side').notNull(),
  ovrAtGeneration: numeric('ovr_at_generation', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type TeamGenerationPlayer = typeof teamGenerationPlayers.$inferSelect
export type NewTeamGenerationPlayer = typeof teamGenerationPlayers.$inferInsert
