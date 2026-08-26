import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import { db } from '../../db'
import { matches, matchAttendances, matchMessages, matchMessageReads, players } from '../../db/schema'
import { CHAT_CLOSES_AFTER_HOURS, CHAT_MESSAGE_MAX_LENGTH } from '@fivematch/types'
import type { MatchMessageKind } from '@fivematch/types'

function fail(code: string, statusCode: number) {
  return Object.assign(new Error(code), { code, statusCode })
}

/** Newest-first page size. One screenful plus room to scroll before refetching. */
const PAGE_SIZE = 40

/**
 * Is the thread still open?
 *
 * It closes 48 h after kickoff rather than at the final whistle: the third half,
 * the score argument and "who's got my jumper" all happen after the match, and
 * cutting the conversation at 90 minutes throws that back to WhatsApp — which is
 * the exact thing the chat exists to stop.
 *
 * Cancelled matches close immediately. There is nothing left to organise, and
 * leaving it open invites a post-mortem nobody benefits from.
 */
function isOpen(match: { scheduledAt: Date; status: string }): boolean {
  if (match.status === 'cancelled') return false
  return Date.now() <= match.scheduledAt.getTime() + CHAT_CLOSES_AFTER_HOURS * 3_600_000
}

async function loadMatchOrFail(matchId: string) {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1)
  if (!match) throw fail('MATCH_NOT_FOUND', 404)
  return match
}

/**
 * Who may read and write.
 *
 * Anyone on the sheet, including people who marked themselves out or are sitting
 * on the waitlist. Deliberate: someone who just withdrew is exactly the person
 * who needs to explain themselves and help find cover, and locking them out the
 * instant they release a seat punishes the behaviour the app is trying to
 * encourage. The host is always in.
 */
async function assertParticipant(matchId: string, internalUserId: string, hostId: string) {
  const [player] = await db
    .select({ id: players.id })
    .from(players)
    .where(and(eq(players.userId, internalUserId), isNull(players.deletedAt)))
    .limit(1)

  if (!player) throw fail('PLAYER_NOT_FOUND', 403)
  if (hostId === internalUserId) return player.id

  const [row] = await db
    .select({ id: matchAttendances.id })
    .from(matchAttendances)
    .where(and(eq(matchAttendances.matchId, matchId), eq(matchAttendances.playerId, player.id)))
    .limit(1)

  if (!row) throw fail('NOT_A_PARTICIPANT', 403)
  return player.id
}

/**
 * Append a system row.
 *
 * Called from the flows that already own these facts — a seat claimed, teams
 * drawn, a result recorded — and always with the caller's transaction when there
 * is one, so the narration cannot survive a rolled-back action or go missing
 * after a committed one.
 *
 * Never throws into the caller. A chat line is worth strictly less than the
 * thing it describes: failing a join because its announcement could not be
 * written would be an absurd trade.
 */
async function recordEvent(
  matchId: string,
  kind: Exclude<MatchMessageKind, 'text'>,
  meta: Record<string, string | number | null> = {},
  options: { tx?: typeof db } = {},
): Promise<void> {
  const conn = options.tx ?? db
  try {
    await conn.insert(matchMessages).values({ matchId, kind, meta })
  } catch {
    // Swallowed on purpose — see above.
  }
}

async function postMessage(matchId: string, internalUserId: string, body: string) {
  const match = await loadMatchOrFail(matchId)
  if (!isOpen(match)) throw fail('CHAT_CLOSED', 422)

  const playerId = await assertParticipant(matchId, internalUserId, match.hostId)

  const trimmed = body.trim()
  if (!trimmed) throw fail('EMPTY_MESSAGE', 422)
  if (trimmed.length > CHAT_MESSAGE_MAX_LENGTH) throw fail('MESSAGE_TOO_LONG', 422)

  const [row] = await db
    .insert(matchMessages)
    .values({ matchId, playerId, kind: 'text', body: trimmed })
    .returning()

  // Posting is reading: nobody should return to their own message as unread.
  await markRead(matchId, playerId)

  return row
}

/**
 * One page of the thread, oldest-first for rendering.
 *
 * Queried newest-first so "the latest 40" is an index scan rather than a full
 * sort, then reversed — a chat is read bottom-up but drawn top-down.
 */
async function listMessages(matchId: string, internalUserId: string, before?: string) {
  const match = await loadMatchOrFail(matchId)
  const playerId = await assertParticipant(matchId, internalUserId, match.hostId)

  const cursor = before ? new Date(before) : null
  const rows = await db
    .select({
      id: matchMessages.id,
      kind: matchMessages.kind,
      body: matchMessages.body,
      meta: matchMessages.meta,
      createdAt: matchMessages.createdAt,
      playerId: matchMessages.playerId,
      displayName: players.displayName,
    })
    .from(matchMessages)
    .leftJoin(players, eq(players.id, matchMessages.playerId))
    .where(and(
      eq(matchMessages.matchId, matchId),
      isNull(matchMessages.deletedAt),
      ...(cursor ? [sql`${matchMessages.createdAt} < ${cursor}`] : []),
    ))
    .orderBy(desc(matchMessages.createdAt))
    .limit(PAGE_SIZE + 1)

  const hasMore = rows.length > PAGE_SIZE
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows

  return {
    messages: page.reverse().map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      // Mine, so the client never has to know its own player id to align bubbles.
      isMine: row.playerId !== null && row.playerId === playerId,
    })),
    hasMore,
    isOpen: isOpen(match),
    closesAt: new Date(match.scheduledAt.getTime() + CHAT_CLOSES_AFTER_HOURS * 3_600_000).toISOString(),
  }
}

async function markRead(matchId: string, playerId: string) {
  await db
    .insert(matchMessageReads)
    .values({ matchId, playerId, lastReadAt: new Date() })
    .onConflictDoUpdate({
      target: [matchMessageReads.matchId, matchMessageReads.playerId],
      set: { lastReadAt: new Date() },
    })
}

async function markReadForUser(matchId: string, internalUserId: string) {
  const match = await loadMatchOrFail(matchId)
  const playerId = await assertParticipant(matchId, internalUserId, match.hostId)
  await markRead(matchId, playerId)
}

/**
 * Unread count for one match.
 *
 * A player who has never opened the thread has no read row, and counting every
 * message for them would badge a brand-new match with everything the app has
 * ever narrated. So no row means "unread starts now": they get the badge for
 * what arrives from here, not for history they were never shown.
 */
async function unreadCount(matchId: string, playerId: string): Promise<number> {
  const [read] = await db
    .select({ lastReadAt: matchMessageReads.lastReadAt })
    .from(matchMessageReads)
    .where(and(eq(matchMessageReads.matchId, matchId), eq(matchMessageReads.playerId, playerId)))
    .limit(1)

  if (!read) {
    await markRead(matchId, playerId)
    return 0
  }

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matchMessages)
    .where(and(
      eq(matchMessages.matchId, matchId),
      isNull(matchMessages.deletedAt),
      gt(matchMessages.createdAt, read.lastReadAt),
      // Your own messages are never unread to you. IS DISTINCT FROM rather than
      // `<>` so system rows, whose playerId is NULL, still count — they are the
      // announcements people most need to see.
      sql`${matchMessages.playerId} IS DISTINCT FROM ${playerId}`,
    ))

  return Number(row?.count ?? 0)
}

export const chatService = {
  listMessages,
  postMessage,
  markReadForUser,
  recordEvent,
  unreadCount,
  isOpen,
  PAGE_SIZE,
}
