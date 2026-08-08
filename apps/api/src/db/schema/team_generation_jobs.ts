import { pgTable, uuid, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core'
import { matches } from './matches'
import { groups } from './groups'

export const teamGenJobStatusEnum = pgEnum('team_gen_job_status', [
  'processing', 'complete', 'failed',
])

export const teamGenerationJobs = pgTable('team_generation_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobId: text('job_id').notNull().unique(),
  matchId: uuid('match_id').notNull().references(() => matches.id),
  groupId: uuid('group_id').references(() => groups.id), // nullable — standalone matches have no crew
  status: teamGenJobStatusEnum('status').notNull().default('processing'),
  generationNumber: integer('generation_number').notNull(),
  fairnessScore: text('fairness_score'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type TeamGenerationJob = typeof teamGenerationJobs.$inferSelect
export type NewTeamGenerationJob = typeof teamGenerationJobs.$inferInsert
