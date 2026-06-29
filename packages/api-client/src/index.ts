// Hand-written typed wrappers chosen over OpenAPI-generated — revisit before Epic 3 mobile stories
import type { Player, Group, Match, PaginatedResponse } from '@fivematch/types'

const notImplemented = (): never => {
  throw new Error('not implemented')
}

export const auth = {
  signIn: (_params: { clerkToken: string }): Promise<{ userId: string }> =>
    Promise.resolve(notImplemented()),
  signOut: (): Promise<void> =>
    Promise.resolve(notImplemented()),
}

export const groups = {
  list: (): Promise<PaginatedResponse<Group>> =>
    Promise.resolve(notImplemented()),
  get: (_groupId: string): Promise<Group> =>
    Promise.resolve(notImplemented()),
  create: (_params: { name: string }): Promise<Group> =>
    Promise.resolve(notImplemented()),
  join: (_groupId: string): Promise<void> =>
    Promise.resolve(notImplemented()),
  leave: (_groupId: string): Promise<void> =>
    Promise.resolve(notImplemented()),
}

export const players = {
  list: (_groupId: string): Promise<PaginatedResponse<Player>> =>
    Promise.resolve(notImplemented()),
  get: (_groupId: string, _playerId: string): Promise<Player> =>
    Promise.resolve(notImplemented()),
}

export const matches = {
  list: (_groupId: string): Promise<PaginatedResponse<Match>> =>
    Promise.resolve(notImplemented()),
  get: (_matchId: string): Promise<Match> =>
    Promise.resolve(notImplemented()),
  create: (_params: { groupId: string; scheduledAt: string }): Promise<Match> =>
    Promise.resolve(notImplemented()),
  submitResult: (_matchId: string, _params: { homeScore: number; awayScore: number }): Promise<void> =>
    Promise.resolve(notImplemented()),
  generateTeams: (_matchId: string): Promise<{ jobId: string; status: 'complete' | 'processing'; teams: unknown[] | null }> =>
    Promise.resolve(notImplemented()),
}

export const cards = {
  get: (_groupId: string, _playerId: string): Promise<{ cardState: string; imageUrl: string | null }> =>
    Promise.resolve(notImplemented()),
  generate: (_groupId: string, _playerId: string): Promise<{ jobId: string }> =>
    Promise.resolve(notImplemented()),
}

export const pronos = {
  list: (_matchId: string): Promise<unknown[]> =>
    Promise.resolve(notImplemented()),
  submit: (_matchId: string, _params: unknown): Promise<void> =>
    Promise.resolve(notImplemented()),
}
