export type CardState = 'not_started' | 'in_progress_1' | 'in_progress_2' | 'in_progress_3' | 'unlocked'

export type JoinStatus = 'pending' | 'approved' | 'rejected'

export type MatchStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'

export interface Player {
  id: string
  groupId: string
  userId: string
  displayName: string
  ovrScore: number | null // null = hidden (< 4 matches)
  cardState: CardState
  matchCount: number
  createdAt: string
}

export interface Group {
  id: string
  name: string
  tier: string
  matchCount: number
  createdAt: string
}

export interface Match {
  id: string
  groupId: string
  status: MatchStatus
  scheduledAt: string
  createdAt: string
}

export type PaginatedResponse<T> = {
  data: { items: T[]; nextCursor: string | null; hasMore: boolean }
}
