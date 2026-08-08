import { pgTable, uuid, text, boolean, timestamp, unique } from 'drizzle-orm/pg-core'
import { users } from './users'

export const NOTIFICATION_TYPES = [
  'JOIN_REQUEST_RECEIVED',
  'JOIN_APPROVED',
  'JOIN_REJECTED',
  'ATTENDANCE_REMINDER',
  'MATCH_FULL',
  'SPOT_CLAIMED',
  'WAITLIST_SPOT_OPEN',
  'TEAMS_LOCKED',
  'SCORE_SUBMITTED',
  'MVP_VOTING_OPEN',
  'MVP_VOTING_REMINDER',
  'CARD_UNLOCKED',
  'CARD_INITIAL_UNLOCKED',
  'PRONOS_WINDOW_OPEN',
  'PRONOS_REVEALED', // legacy, undispatched since Story 11.7 — kept so stored prefs stay valid
  'PLAYER_TIER_CHANGED',
  'GROUP_TIER_CHANGED',
  'RATING_REMINDER',
  'ORGANIZER_TRANSFERRED',
  'MATCH_CREATED',
  'PRONOS_BETS_SETTLED',
] as const

export type NotificationType = typeof NOTIFICATION_TYPES[number]

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  type: text('type').$type<NotificationType>().notNull(),
  enabled: boolean('enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueUserType: unique().on(table.userId, table.type),
}))

export type NotificationPreference = typeof notificationPreferences.$inferSelect
