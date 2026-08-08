/**
 * @typedef {{ playerId: string | null, displayName: string | null, teamSide: 'A' | 'B' }} Participant
 */

/**
 * Return only final participants on the other team. Missing viewer snapshots and
 * anonymized participants produce a safe empty list.
 *
 * @param {Participant[]} participants
 * @param {string | null | undefined} myPlayerId
 */
export function getOpposingParticipants(participants, myPlayerId) {
  if (!myPlayerId) return []
  const mine = participants.find((participant) => participant.playerId === myPlayerId)
  if (!mine) return []
  return participants.filter((participant) =>
    participant.playerId !== null
    && participant.playerId !== myPlayerId
    && participant.teamSide !== mine.teamSide,
  )
}

/** @param {string | undefined} code */
export function mapPostMatchRatingError(code) {
  if (code === 'ALREADY_RATED') return 'rated'
  if (code === 'RATING_WINDOW_CLOSED') return 'window_closed'
  return 'generic_error'
}
