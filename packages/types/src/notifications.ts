import type { CancellationReason } from './trust-constants'

/**
 * `groupId` is nullable on every match-scoped notification: a match no longer
 * needs a crew behind it, so anything triggered by a match may have none.
 * Group-scoped notifications (join requests, tier changes) still require one.
 */
export type NotificationPayload =
  | { type: 'JOIN_REQUEST_RECEIVED'; groupId: string; recipientUserId: string }
  | { type: 'JOIN_APPROVED'; groupId: string; groupName: string; recipientUserId: string }
  | { type: 'JOIN_REJECTED'; groupId: string; recipientUserId: string }
  | { type: 'ATTENDANCE_REMINDER'; matchId: string; groupId: string | null; recipientUserId: string }
  | { type: 'MATCH_FULL'; matchId: string; groupId: string | null; recipientUserId: string }
  | { type: 'WAITLIST_SPOT_OPEN'; matchId: string; groupId: string | null; recipientUserId: string }
  // A stranger took a published spot — the host's cue to look at who turned up.
  | { type: 'SPOT_CLAIMED'; matchId: string; groupId: string | null; playerDisplayName: string; spotsRemaining: number; recipientUserId: string }
  // The mirror of SPOT_CLAIMED: someone gave a confirmed seat back. Host-only,
  // and it carries `spotsRemaining` so the push says how short the match now is
  // rather than only who dropped — that is the number a host acts on. `reason`
  // is null when the player withdrew without going through the sheet.
  | { type: 'PLAYER_WITHDREW'; matchId: string; groupId: string | null; playerDisplayName: string; spotsRemaining: number; reason: CancellationReason | null; recipientUserId: string }
  | { type: 'TEAMS_LOCKED'; matchId: string; groupId: string | null; recipientUserIds: string[] }
  | { type: 'SCORE_SUBMITTED'; matchId: string; groupId: string | null; recipientUserIds: string[] }
  | { type: 'MVP_VOTING_OPEN'; matchId: string; groupId: string | null; recipientUserIds: string[] }
  | { type: 'MVP_VOTING_REMINDER'; matchId: string; groupId: string | null; recipientUserId: string }
  | { type: 'CARD_UNLOCKED'; groupId: string | null; playerId: string; recipientUserId: string }
  | { type: 'PRONOS_WINDOW_OPEN'; matchId: string; groupId: string | null; recipientUserIds: string[] }
  // LEGACY (Story 11.7): no longer dispatched — the flat scoreAndReveal path that sent it is
  // gone, and PRONOS_BETS_SETTLED replaces it. Kept declared because notification_preferences
  // rows may already store this value; removing it would orphan them. Retiring the value needs
  // a data migration.
  | { type: 'PRONOS_REVEALED'; matchId: string; groupId: string | null; recipientUserIds: string[] }
  | { type: 'PLAYER_TIER_CHANGED'; groupId: string | null; playerId: string; previousTier: string; newTier: string; recipientUserId: string }
  | { type: 'RATING_REMINDER'; matchId: string; groupId: string | null; recipientUserId: string }
  | { type: 'ORGANIZER_TRANSFERRED'; groupId: string; recipientUserId: string }
  | { type: 'CARD_INITIAL_UNLOCKED'; groupId: string; ratedPlayerId: string; recipientUserId: string }
  | { type: 'GROUP_TIER_CHANGED'; groupId: string; groupName: string; newTier: string; previousTier: string; recipientUserIds: string[] }
  | { type: 'MATCH_CANCELLED'; matchId: string; groupId: string | null; scheduledAt: string; recipientUserIds: string[] }
  | { type: 'MATCH_UPDATED'; matchId: string; groupId: string | null; scheduledAt: string; recipientUserIds: string[] }
  | { type: 'MATCH_CREATED'; groupId: string | null; groupName: string | null; matchId: string; scheduledAt: string; recipientUserIds: string[] }
  | { type: 'PRONOS_BETS_SETTLED'; matchId: string; groupId: string | null; netPayout: number; recipientUserId: string }
