export interface PostMatchParticipant {
  playerId: string | null
  displayName: string | null
  teamSide: 'A' | 'B'
}

export function getOpposingParticipants(
  participants: PostMatchParticipant[],
  myPlayerId: string | null | undefined,
): PostMatchParticipant[]

export function mapPostMatchRatingError(
  code: string | undefined,
): 'rated' | 'window_closed' | 'generic_error'
