/**
 * The match chat.
 *
 * One thread per match, written into by both the players and the app itself.
 */

/**
 * How long the thread stays open after kickoff.
 *
 * 48 h, not the final whistle. The third half, the argument about the score and
 * "who has my jumper" all happen afterwards — cutting the conversation at 90
 * minutes pushes exactly that back into WhatsApp, which is the thing the chat
 * exists to stop. Closing at all matters too: a thread that never ends becomes a
 * group chat, and the app already has crews for that.
 */
export const CHAT_CLOSES_AFTER_HOURS = 48

/**
 * Per-message ceiling. Generous for organising a five-a-side, short enough that
 * the thread stays scannable on a phone in the street.
 */
export const CHAT_MESSAGE_MAX_LENGTH = 600

/**
 * Rows in the thread. `text` is the only kind a human writes; the rest are the
 * app narrating the match into the same fil.
 *
 * They live together on purpose. Teams being drawn, a seat coming free and odds
 * opening ARE the conversation — split into a separate "activity" tab, nobody
 * reads either. It also means the thread is never empty, so the first player to
 * open it is not being asked to break a silence.
 */
export const MATCH_MESSAGE_KINDS = [
  'text',
  'player_joined',
  'player_withdrew',
  'waitlist_promoted',
  'teams_drawn',
  'odds_open',
  'result_recorded',
  'match_cancelled',
] as const

export type MatchMessageKind = (typeof MATCH_MESSAGE_KINDS)[number]

export interface MatchMessageView {
  id: string
  kind: MatchMessageKind
  /** Null for system rows — their copy is rendered from kind + meta. */
  body: string | null
  meta: Record<string, string | number | null> | null
  createdAt: string
  playerId: string | null
  displayName: string | null
  isMine: boolean
}

export interface MatchChatPage {
  messages: MatchMessageView[]
  hasMore: boolean
  isOpen: boolean
  closesAt: string
}
