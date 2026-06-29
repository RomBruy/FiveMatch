export type NotificationPayload =
  | { type: 'JOIN_REQUEST_RECEIVED'; groupId: string; recipientUserId: string }
  | { type: 'JOIN_APPROVED'; groupId: string; groupName: string; recipientUserId: string }
  | { type: 'JOIN_REJECTED'; groupId: string; recipientUserId: string }
  | { type: 'ATTENDANCE_REMINDER'; matchId: string; groupId: string; recipientUserId: string }
  | { type: 'MATCH_FULL'; matchId: string; groupId: string; recipientUserId: string }
  | { type: 'WAITLIST_SPOT_OPEN'; matchId: string; groupId: string; recipientUserId: string }
  | { type: 'TEAMS_LOCKED'; matchId: string; groupId: string; recipientUserIds: string[] }
  | { type: 'SCORE_SUBMITTED'; matchId: string; groupId: string; recipientUserIds: string[] }
  | { type: 'MVP_VOTING_OPEN'; matchId: string; groupId: string; recipientUserIds: string[] }
  | { type: 'MVP_VOTING_REMINDER'; matchId: string; groupId: string; recipientUserId: string }
  | { type: 'CARD_UNLOCKED'; groupId: string; playerId: string; recipientUserId: string }
  | { type: 'PRONOS_WINDOW_OPEN'; matchId: string; groupId: string; recipientUserIds: string[] }
  | { type: 'PRONOS_REVEALED'; matchId: string; groupId: string; recipientUserIds: string[] }
  | { type: 'PLAYER_TIER_CHANGED'; groupId: string; playerId: string; previousTier: string; newTier: string; recipientUserId: string }
  | { type: 'RATING_REMINDER'; matchId: string; groupId: string; recipientUserId: string }
  | { type: 'ORGANIZER_TRANSFERRED'; groupId: string; recipientUserId: string }
  | { type: 'CARD_INITIAL_UNLOCKED'; groupId: string; ratedPlayerId: string; recipientUserId: string }
  | { type: 'GROUP_TIER_CHANGED'; groupId: string; groupName: string; newTier: string; previousTier: string; recipientUserIds: string[] }
  | { type: 'MATCH_CREATED'; groupId: string; groupName: string; matchId: string; scheduledAt: string; recipientUserIds: string[] }
