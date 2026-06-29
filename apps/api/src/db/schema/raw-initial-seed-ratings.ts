import { pgTable, uuid, integer, text, timestamp } from 'drizzle-orm/pg-core'
import { players } from './players'

export const rawInitialSeedRatings = pgTable('raw_initial_seed_ratings', {
  id: uuid('id').defaultRandom().primaryKey(),
  playerId: uuid('player_id').notNull().references(() => players.id),
  raterUserId: uuid('rater_user_id'),   // NULLABLE — GDPR erasure sets this to null
  rating: integer('rating').notNull(),
  sourceType: text('source_type').notNull(),  // 'ORGANIZER' | 'PEER'
  weight: integer('weight').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
