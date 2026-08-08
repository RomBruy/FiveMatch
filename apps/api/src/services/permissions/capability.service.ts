import type { MatchCapabilities } from '@fivematch/types'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '../../db'
import { ACTIVE_CREW_ROLES, groupMemberships, matchAttendances, matchParticipants } from '../../db/schema'
import type { Match } from '../../db/schema'
import { isPubliclyOpen } from '../matches/attendance.service'

export type MatchRelation = 'host' | 'participant' | 'crew' | 'viewer'

export interface MatchCapabilityState {
  isHost: boolean
  isActiveGroupOrganizer: boolean
  /** Operational authority without ownership of the crew (ADR-027). */
  isActiveGroupCoHost: boolean
  isActiveGroupMember: boolean
  hasConfirmedSeat: boolean
  isFinalParticipant: boolean
  isWaitlisted: boolean
  attendanceStatus: 'in' | 'out' | 'unknown' | null
  matchVisibility: 'private' | 'public'
  matchStatus: string
  hasPublishedSpots: boolean
  hasAvailableSpot: boolean
}

export interface EvaluatedMatchCapabilities extends MatchCapabilities {
  viewerRelation: MatchRelation
  canViewMatch: boolean
}

export function evaluateMatchCapabilities(state: MatchCapabilityState): EvaluatedMatchCapabilities {
  const crewAuthority = state.isActiveGroupOrganizer || state.isActiveGroupCoHost
  const isManager = state.isHost || crewAuthority
  const isParticipant = state.hasConfirmedSeat || state.isFinalParticipant
  const isGroupMember = state.isActiveGroupMember || crewAuthority
  const viewerRelation: MatchRelation = isManager
    ? 'host'
    : isParticipant
      ? 'participant'
      : isGroupMember
        ? 'crew'
        : 'viewer'
  const attendanceOpen = state.matchStatus === 'attendance_open'
  const canJoin = !isParticipant && !state.isWaitlisted && attendanceOpen
    && state.matchVisibility === 'public' && state.hasPublishedSpots && state.hasAvailableSpot

  return {
    viewerRelation,
    canViewMatch: state.matchVisibility === 'public' || isManager || isParticipant || isGroupMember,
    canViewPrivateMatchDetails: isManager || isParticipant,
    canViewExactLocation: isManager || isParticipant,
    canViewParticipantRoster: isManager || isParticipant,
    canViewWaitlist: isManager,
    canViewPendingGroupAttendance: isManager,
    canManageAttendance: isManager,
    canViewPrivateNotes: isManager,
    canRate: isParticipant && state.matchStatus === 'completed',
    // Reporting needs the final participant snapshot, which is exactly what
    // `behaviourReportService` enforces — a confirmed seat alone is not evidence
    // that you were there to see anything.
    canReportAttendance: state.isFinalParticipant && state.matchStatus === 'completed',
    /**
     * Authority to act as validator on this match. Per-report impartiality —
     * never the reporter, never the subject — cannot be decided here because
     * capabilities are per match, not per report; `behaviourReportService`
     * applies that check and it is the one that actually gates the write.
     * A standalone match has no crew, so this is false for everyone including
     * the host (ADR-027).
     */
    canResolveDispute: crewAuthority,
    // A non-playing host is neither participant nor crew member on their own
    // standalone match, and would otherwise be locked out of betting on it.
    canSubmitProno: isParticipant || isGroupMember || state.isHost,
    canLeave: state.hasConfirmedSeat || state.isWaitlisted,
    canJoin,
    canJoinWaitlist: !isParticipant && !state.isWaitlisted && attendanceOpen
      && state.matchVisibility === 'public' && state.hasPublishedSpots && !state.hasAvailableSpot,
  }
}

export async function resolveMatchCapabilities(
  match: Match,
  internalUserId: string,
  playerId: string | undefined,
): Promise<EvaluatedMatchCapabilities> {
  const [attendanceRows, participantRows, membershipRows, spotRows] = await Promise.all([
    playerId
      ? db.select({ status: matchAttendances.status, waitlistPosition: matchAttendances.waitlistPosition })
          .from(matchAttendances)
          .where(and(eq(matchAttendances.matchId, match.id), eq(matchAttendances.playerId, playerId)))
          .limit(1)
      : Promise.resolve([]),
    playerId
      ? db.select({ playerId: matchParticipants.playerId })
          .from(matchParticipants)
          .where(and(eq(matchParticipants.matchId, match.id), eq(matchParticipants.playerId, playerId)))
          .limit(1)
      : Promise.resolve([]),
    match.groupId
      ? db.select({ role: groupMemberships.role })
          .from(groupMemberships)
          .where(and(
            eq(groupMemberships.groupId, match.groupId),
            eq(groupMemberships.userId, internalUserId),
            inArray(groupMemberships.role, [...ACTIVE_CREW_ROLES]),
            isNull(groupMemberships.deletedAt),
          ))
          .limit(1)
      : Promise.resolve([]),
    db.select({
      confirmed: sql<number>`COUNT(*) FILTER (WHERE ${matchAttendances.status} = 'in' AND ${matchAttendances.waitlistPosition} IS NULL)::int`,
      openConfirmed: sql<number>`COUNT(*) FILTER (WHERE ${matchAttendances.status} = 'in' AND ${matchAttendances.waitlistPosition} IS NULL AND ${matchAttendances.source} = 'open')::int`,
    }).from(matchAttendances).where(eq(matchAttendances.matchId, match.id)),
  ])

  const attendance = attendanceRows[0]
  const membership = membershipRows[0]
  const capacity = match.playersPerTeam * 2
  const confirmed = Number(spotRows[0]?.confirmed ?? 0)
  const openConfirmed = Number(spotRows[0]?.openConfirmed ?? 0)
  // Public visibility alone is not enough — a crew-first match stays private
  // until its opening time passes (ADR-033).
  const hasPublishedSpots = isPubliclyOpen(match)
  const hasAvailableSpot = hasPublishedSpots
    && confirmed < capacity
    && openConfirmed < (match.openSpots ?? 0)

  return evaluateMatchCapabilities({
    isHost: match.hostId === internalUserId,
    isActiveGroupOrganizer: membership?.role === 'organizer',
    isActiveGroupCoHost: membership?.role === 'co_host',
    isActiveGroupMember: membership?.role !== undefined,
    hasConfirmedSeat: attendance?.status === 'in' && attendance.waitlistPosition === null,
    isFinalParticipant: participantRows.length > 0,
    isWaitlisted: attendance?.waitlistPosition !== null && attendance?.waitlistPosition !== undefined,
    attendanceStatus: attendance?.status ?? null,
    matchVisibility: match.visibility,
    matchStatus: match.status,
    hasPublishedSpots,
    hasAvailableSpot,
  })
}
