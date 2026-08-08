import { pgTable, uuid, text, pgEnum, timestamp } from 'drizzle-orm/pg-core'
import { players } from './players'
import { groups } from './groups'

export const cardPhotoJobStateEnum = pgEnum('card_photo_job_state', [
  'idle', 'pending', 'processing', 'complete', 'failed',
])

export const cardPhotoJobs = pgTable('card_photo_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  groupId: uuid('group_id').references(() => groups.id), // nullable — the card is a global identity now
  state: cardPhotoJobStateEnum('state').notNull().default('idle'),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  photoUrl: text('photo_url'),
  errorMessage: text('error_message'),
  generationMonth: text('generation_month').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
