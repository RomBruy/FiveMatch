import { pgTable, uuid, timestamp, pgEnum, unique } from 'drizzle-orm/pg-core'
import { users } from './users'
import { groups } from './groups'

/**
 * `co_host` carries the organizer's operational authority — managing matches and
 * resolving disputes — without ownership of the crew. It exists so a dispute
 * involving the organizer still has somebody impartial to settle it (ADR-027).
 */
export const memberRoleEnum = pgEnum('member_role', [
  'organizer',
  'co_host',
  'member',
  'pending_member',
])

/**
 * Everyone actually in the crew. `pending_member` is the only exclusion.
 *
 * Always prefer this over an inline allowlist: when `co_host` was added, every
 * hand-written `['member', 'organizer']` filter silently dropped co-hosts from
 * rosters, seeded attendance and notifications. The next role added will do the
 * same to anything that does not use this.
 */
export const ACTIVE_CREW_ROLES = ['organizer', 'co_host', 'member'] as const

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
