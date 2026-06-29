import { pgTable, uuid, timestamp, pgEnum, unique } from 'drizzle-orm/pg-core'
import { users } from './users'
import { groups } from './groups'

export const memberRoleEnum = pgEnum('member_role', ['organizer', 'member', 'pending_member'])

export const groupMemberships = pgTable(
  'group_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id').notNull().references(() => groups.id),
    userId: uuid('user_id').notNull().references(() => users.id),
    role: memberRoleEnum('role').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    uniqueMembership: unique().on(table.groupId, table.userId),
  }),
)

export type GroupMembership = typeof groupMemberships.$inferSelect
export type NewGroupMembership = typeof groupMemberships.$inferInsert
