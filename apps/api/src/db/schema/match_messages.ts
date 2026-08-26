import { pgTable, uuid, text, timestamp, jsonb, pgEnum, index, primaryKey } from 'drizzle-orm/pg-core'
import { matches } from './matches'
import { players } from './players'

/**
 * What a row in the thread is.
 *
 * `text` is the only kind a human writes. Everything else is the app narrating
 * the match into the same fil, which is the whole design: a chat that is empty
 * until somebody is brave enough to speak first is a chat nobody uses. By the
 * time a player opens it two days before kickoff there are already half a dozen
 * events in it, so saying something costs nothing.
 *
 * System rows carry no prose — only `meta`. Copy is rendered client-side from
 * kind + meta so it follows the reader's language, and so wording can be fixed
 * later without rewriting history. Storing the rendered French sentence would
 * freeze both.
 */
export const matchMessageKindEnum = pgEnum('match_message_kind', [
  'text',
  'player_joined',
  'player_withdrew',
  'waitlist_promoted',
  'teams_drawn',
  'odds_open',
  'result_recorded',
  'match_cancelled',
])

export const matchMessages = pgTable('match_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  /** Null for system rows — nobody wrote them. Also null once an author is erased. */
  playerId: uuid('player_id').references(() => players.id),
  kind: matchMessageKindEnum('kind').notNull().default('text'),
  /** Only ever set for `text`. System copy is rendered from kind + meta. */
  body: text('body'),
  /** System payload: display names, counts, scores. Never free-form user input. */
  meta: jsonb('meta').$type<Record<string, string | number | null>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  /**
   * Soft delete. A removed message leaves a tombstone rather than vanishing:
   * a thread that silently reflows is how a group ends up arguing about what
   * somebody actually said.
   */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  // The only read pattern: one match's thread, newest last, paginated by time.
  byMatch: index('match_messages_match_created_idx').on(table.matchId, table.createdAt),
}))

/**
 * How far each player has read.
 *
 * A high-water mark, not per-message receipts. The product question is only ever
 * "is there something new for me", and a timestamp answers it with one row per
 * player instead of one row per player per message.
 */
export const matchMessageReads = pgTable('match_message_reads', {
  matchId: uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  playerId: uuid('player_id').notNull().references(() => players.id, { onDelete: 'cascade' }),
  lastReadAt: timestamp('last_read_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.matchId, table.playerId] }),
}))

export type MatchMessage = typeof matchMessages.$inferSelect
export type NewMatchMessage = typeof matchMessages.$inferInsert
export type MatchMessageRead = typeof matchMessageReads.$inferSelect
