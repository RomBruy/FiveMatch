import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { requestPushPermission } from '../hooks/use-push-registration'
import { httpClient } from './api-client'
import type { DiscoveryLocation } from '../hooks/use-discovery-location'
import type {
  AttendanceResponse,
  MatchCapabilities,
  MatchDetailResponse,
  PublicMatchPreview,
} from '@fivematch/types'

export type SkillLevel = 'casual' | 'intermediate' | 'competitive'
export type MatchStatus =
  | 'planning' | 'attendance_open' | 'attendance_locked'
  | 'teams_generated' | 'in_progress' | 'completed' | 'cancelled'
export type MatchRelation = 'host' | 'participant' | 'crew' | 'viewer'
export type AttendanceStatus = 'in' | 'out' | 'unknown'

export interface DiscoverMatch {
  matchId: string
  hostDisplayName: string | null
  scheduledAt: string
  durationMinutes: number
  city: string | null
  distanceKm: number | null
  format: string
  skillLevel: SkillLevel
  pricePerPlayer: number | null
  currency: string
  confirmedCount: number
  capacity: number
  spotsRemaining: number
  viewerJoined: boolean
}

export interface MyMatch {
  matchId: string
  status: MatchStatus
  scheduledAt: string
  city: string | null
  format: string
  playersPerTeam: number
  capacity: number
  confirmedCount: number
  visibility: 'private' | 'public'
  openSpots: number | null
  skillLevel: SkillLevel
  scoreA: number | null
  scoreB: number | null
  completedAt: string | null
  isHost: boolean
  myStatus: AttendanceStatus | null
  /**
   * Win / draw / loss from the caller's own side. The API has always computed
   * this (it knows the team side the score alone cannot carry); the client just
   * never read it, so the history could show a score but never a result.
   * Null when the viewer did not play or the score is not in.
   */
  userResult: 'win' | 'draw' | 'loss' | null
}

export interface MatchDetail {
  matchId: string
  groupId: string | null
  hostDisplayName: string | null
  status: MatchStatus
  scheduledAt: string
  durationMinutes: number
  location: string | null
  venueName: string | null
  city: string | null
  latitude: number | null
  longitude: number | null
  visibility: 'private' | 'public'
  skillLevel: SkillLevel
  pricePerPlayer: number | null
  currency: string
  notes: string | null
  format: string
  playersPerTeam: number
  goalkeeperMode: string
  generationCount: number
  seriesId: string | null
  completedAt: string | null
  confirmed: number
  capacity: number
  spotsRemaining: number
  viewerRelation: MatchRelation
  capabilities: MatchCapabilities
  attendanceSummary: { in: number; out: number; unknown: number; waitlist: number }
  result?: { scoreA: number | null; scoreB: number | null }
  participants?: Array<{
    playerId: string | null
    displayName: string
    teamSide: 'A' | 'B'
    goalsScored: number | null
    assists: number | null
  }>
}

export interface AttendanceEntry {
  playerId: string
  displayName: string | null
  status: AttendanceStatus
  source?: 'crew' | 'open'
  skillLevel: SkillLevel | null
  matchCount: number
  /** The earned mark. There is no negative counterpart by design (ADR-019). */
  isReliable: boolean
  waitlistPosition?: number | null
}

export interface AttendanceSheet {
  confirmed: AttendanceEntry[]
  waitlist: AttendanceEntry[]
  pending: AttendanceEntry[]
  myPlayerId: string | null
  myStatus: AttendanceStatus | null
  /** Manager-only; false for every other audience because they are not told. */
  attendanceFinalized: boolean
}

const EMPTY_CAPABILITIES: MatchCapabilities = {
  canViewPrivateMatchDetails: false,
  canViewExactLocation: false,
  canViewParticipantRoster: false,
  canViewWaitlist: false,
  canViewPendingGroupAttendance: false,
  canManageAttendance: false,
  canViewPrivateNotes: false,
  canRate: false,
  canReportAttendance: false,
  canResolveDispute: false,
  canSubmitProno: false,
  canLeave: false,
  canJoin: false,
  canJoinWaitlist: false,
}

function normalizeDiscovery(match: PublicMatchPreview): DiscoverMatch {
  return {
    matchId: match.matchId,
    hostDisplayName: match.host.displayName,
    scheduledAt: match.scheduledAt,
    durationMinutes: match.durationMinutes,
    city: match.city,
    distanceKm: match.distanceKm ?? null,
    format: match.format,
    skillLevel: match.skillLevel as SkillLevel,
    pricePerPlayer: match.pricePerPlayer,
    currency: match.currency,
    confirmedCount: match.availability.confirmedCount,
    capacity: match.availability.capacity,
    spotsRemaining: match.availability.spotsRemaining,
    viewerJoined: match.viewerJoined ?? false,
  }
}

function normalizeMatchDetail(match: MatchDetailResponse): MatchDetail {
  const exact = 'exactLocation' in match ? match.exactLocation : null
  const config = 'configuration' in match ? match.configuration : null
  const participants = 'participants' in match ? match.participants.map((participant) => ({
    playerId: participant.playerId,
    displayName: participant.displayName,
    teamSide: participant.teamSide as 'A' | 'B',
    goalsScored: participant.goalsScored ?? null,
    assists: participant.assists ?? null,
  })) : undefined
  const group = 'group' in match ? match.group : null

  return {
    matchId: match.matchId,
    groupId: group?.groupId ?? null,
    hostDisplayName: match.host.displayName,
    status: match.status as MatchStatus,
    scheduledAt: match.scheduledAt,
    durationMinutes: match.durationMinutes,
    location: exact?.location ?? null,
    venueName: exact?.venueName ?? null,
    city: match.city,
    latitude: exact?.latitude ?? null,
    longitude: exact?.longitude ?? null,
    visibility: match.publication.isPublic ? 'public' : 'private',
    skillLevel: match.skillLevel as SkillLevel,
    pricePerPlayer: match.pricePerPlayer,
    currency: match.currency,
    notes: 'privateNotes' in match ? match.privateNotes : null,
    format: match.format,
    playersPerTeam: config?.playersPerTeam ?? Math.floor(match.availability.capacity / 2),
    goalkeeperMode: config?.goalkeeperMode ?? 'none',
    generationCount: config?.generationCount ?? 0,
    seriesId: config?.seriesId ?? null,
    completedAt: match.completedAt ?? null,
    confirmed: match.availability.confirmedCount,
    capacity: match.availability.capacity,
    spotsRemaining: match.availability.spotsRemaining,
    viewerRelation: match.viewerRelation ?? 'viewer',
    capabilities: match.capabilities ?? EMPTY_CAPABILITIES,
    attendanceSummary: 'attendanceSummary' in match
      ? match.attendanceSummary
      : { in: match.availability.confirmedCount, out: 0, unknown: 0, waitlist: 0 },
    result: 'result' in match ? match.result : undefined,
    participants,
  }
}

function normalizeAttendances(response: AttendanceResponse): AttendanceSheet {
  const normalize = (entry: {
    playerId: string
    displayName: string | null
    skillLevel: string | null
    matchCount: number
    isReliable: boolean
    source?: 'crew' | 'open'
    waitlistPosition?: number
  }): AttendanceEntry => ({
    ...entry,
    skillLevel: entry.skillLevel as SkillLevel | null,
    status: 'in',
    waitlistPosition: entry.waitlistPosition ?? null,
  })
  return {
    confirmed: 'confirmed' in response ? response.confirmed.map(normalize) : [],
    waitlist: response.audience === 'manager' ? response.waitlist.map(normalize) : [],
    pending: response.audience === 'manager'
      ? response.pending.map((entry) => ({ ...normalize(entry), status: 'unknown' }))
      : [],
    myPlayerId: response.self?.playerId ?? null,
    myStatus: (response.self?.status as AttendanceStatus | undefined) ?? null,
    attendanceFinalized: response.audience === 'manager' ? response.attendanceFinalized : false,
  }
}

export interface DiscoverFilters {
  radiusKm: number
  when: 'any' | 'today' | 'week'
  format: string | null
  skillLevel: SkillLevel | null
}

export const DEFAULT_DISCOVER_FILTERS: DiscoverFilters = {
  radiusKm: 15,
  when: 'any',
  format: null,
  skillLevel: null,
}

function windowFor(when: DiscoverFilters['when']): { from?: string; to?: string } {
  if (when === 'any') return {}
  const to = new Date()
  if (when === 'today') to.setHours(23, 59, 59, 999)
  else to.setDate(to.getDate() + 7)
  return { to: to.toISOString() }
}

export const matchKeys = {
  discover: (location: DiscoveryLocation | null, filters: DiscoverFilters) =>
    ['matches', 'discover', location?.latitude ?? null, location?.longitude ?? null, location?.city ?? null, filters] as const,
  mine: (scope: 'upcoming' | 'past') => ['matches', 'mine', scope] as const,
  detail: (matchId: string | undefined) => ['matches', matchId] as const,
  attendances: (matchId: string | undefined) => ['matches', matchId, 'attendances'] as const,
  participants: (matchId: string | undefined) => ['matches', matchId, 'participants'] as const,
}

export function useDiscoverMatches(location: DiscoveryLocation | null, filters: DiscoverFilters) {
  return useQuery({
    queryKey: matchKeys.discover(location, filters),
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: 30, ...windowFor(filters.when) }
      // A geocoded position gives real distances; a bare city name still filters.
      if (location && (location.latitude !== 0 || location.longitude !== 0)) {
        params['latitude'] = location.latitude
        params['longitude'] = location.longitude
        params['radiusKm'] = filters.radiusKm
      } else if (location?.city) {
        params['city'] = location.city
      }
      if (filters.format) params['format'] = filters.format
      if (filters.skillLevel) params['skillLevel'] = filters.skillLevel

      const { data } = await httpClient.get<{ data: { matches: PublicMatchPreview[] } }>(
        '/v1/matches/discover',
        { params },
      )
      return data.data.matches.map(normalizeDiscovery)
    },
  })
}

export function useMyMatches(scope: 'upcoming' | 'past') {
  return useQuery({
    queryKey: matchKeys.mine(scope),
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { matches: MyMatch[] } }>(
        `/v1/matches/mine?scope=${scope}`,
      )
      return data.data.matches
    },
  })
}

export function useMatch(matchId: string | undefined) {
  return useQuery({
    queryKey: matchKeys.detail(matchId),
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: MatchDetailResponse }>(`/v1/matches/${matchId}`)
      return normalizeMatchDetail(data.data)
    },
    enabled: !!matchId,
  })
}

export function useAttendances(matchId: string | undefined) {
  return useQuery({
    queryKey: matchKeys.attendances(matchId),
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: AttendanceResponse }>(`/v1/matches/${matchId}/attendances`)
      return normalizeAttendances(data.data)
    },
    enabled: !!matchId,
  })
}

/** Everything that changes a seat invalidates the same three surfaces. */
function useSeatInvalidation(matchId: string | undefined) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: matchKeys.detail(matchId) })
    void queryClient.invalidateQueries({ queryKey: matchKeys.attendances(matchId) })
    void queryClient.invalidateQueries({ queryKey: ['matches', 'mine'] })
    void queryClient.invalidateQueries({ queryKey: ['matches', 'discover'] })
  }
}

export function useJoinMatch(matchId: string | undefined) {
  const invalidate = useSeatInvalidation(matchId)
  return useMutation({
    mutationFn: () => httpClient.post(`/v1/matches/${matchId}/join`),
    onSuccess: () => {
      // Now notifications mean something: this person has a place in a real
      // fixture that can move, fill or be called off (AF-003).
      void requestPushPermission()
    },
    onSettled: invalidate,
  })
}

/**
 * Queue for a full published match.
 *
 * A full match used to offer nothing but a note saying it was full, which is
 * the worst answer available — it is the match they want, and places open up
 * constantly as people cancel.
 */
export function useJoinWaitlist(matchId: string | undefined) {
  const invalidate = useSeatInvalidation(matchId)
  return useMutation({
    onSuccess: () => {
      // The whole value of a waitlist place is being told when it comes up.
      void requestPushPermission()
    },
    mutationFn: async () => {
      const { data } = await httpClient.post<{ data: { waitlistPosition: number } }>(
        `/v1/matches/${matchId}/waitlist`,
      )
      return data.data
    },
    onSettled: invalidate,
  })
}

export function useLeaveMatch(matchId: string | undefined) {
  const invalidate = useSeatInvalidation(matchId)
  return useMutation({
    mutationFn: () => httpClient.post(`/v1/matches/${matchId}/leave`),
    onSettled: invalidate,
  })
}

export function useSetAttendance(matchId: string | undefined) {
  const invalidate = useSeatInvalidation(matchId)
  return useMutation({
    mutationFn: (status: AttendanceStatus) =>
      httpClient.patch(`/v1/matches/${matchId}/attendance`, { status }),
    onSettled: invalidate,
  })
}

export function useSetVisibility(matchId: string | undefined) {
  const invalidate = useSeatInvalidation(matchId)
  return useMutation({
    mutationFn: (input: { visibility: 'private' | 'public'; openSpots?: number }) =>
      httpClient.patch(`/v1/matches/${matchId}/visibility`, input),
    onSettled: invalidate,
  })
}

/** Server error code out of an axios failure, for mapping to a translated message. */
export function errorCodeOf(error: unknown): string | null {
  return (error as { response?: { data?: { error?: { code?: string } } } })
    ?.response?.data?.error?.code ?? null
}
