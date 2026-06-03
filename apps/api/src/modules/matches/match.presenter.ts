import type {
  FootballMatch,
  FootballMatchAttendance,
  TeamGenerationVersion,
} from '@fit-five/shared';
import type {
  InternalFootballMatch,
  InternalFootballMatchAttendance,
  InternalTeamGenerationVersion,
} from './matches.service';

export function serializeFootballMatch(
  match: InternalFootballMatch,
): FootballMatch {
  return {
    id: match.id,
    groupId: match.groupId,
    organizerUserId: match.organizerUserId,
    title: match.title,
    startsAt: match.startsAt.toISOString(),
    location: match.location,
    playersPerTeam: match.playersPerTeam,
    maxPlayers: match.maxPlayers,
    attendanceDeadlineAt: match.attendanceDeadlineAt.toISOString(),
    generatorStyleOverride: match.generatorStyleOverride,
    goalkeeperModeOverride: match.goalkeeperModeOverride,
    status: match.status,
    confirmedCount: match.confirmedCount,
    waitlistCount: match.waitlistCount,
    attendances: match.attendances.map((attendance) =>
      serializeFootballMatchAttendance(attendance),
    ),
    myAttendance: match.myAttendance
      ? serializeFootballMatchAttendance(match.myAttendance)
      : null,
    createdAt: match.createdAt.toISOString(),
    updatedAt: match.updatedAt.toISOString(),
  };
}

export function serializeFootballMatchAttendance(
  attendance: InternalFootballMatchAttendance,
): FootballMatchAttendance {
  return {
    id: attendance.id,
    matchId: attendance.matchId,
    playerId: attendance.playerId,
    response: attendance.response,
    status: attendance.status,
    waitlistPosition: attendance.waitlistPosition,
    respondedAt: attendance.respondedAt.toISOString(),
    createdAt: attendance.createdAt.toISOString(),
    updatedAt: attendance.updatedAt.toISOString(),
  };
}

export function serializeTeamGenerationVersion(
  generation: InternalTeamGenerationVersion,
): TeamGenerationVersion {
  return {
    id: generation.id,
    matchId: generation.matchId,
    generatedByUserId: generation.generatedByUserId,
    versionNumber: generation.versionNumber,
    seed: generation.seed,
    algorithmVersion: generation.algorithmVersion,
    status: generation.status,
    teamA: generation.teamA,
    teamB: generation.teamB,
    teamATotal: generation.teamATotal,
    teamBTotal: generation.teamBTotal,
    fairnessPercentage: generation.fairnessPercentage,
    inputSnapshot: generation.inputSnapshot,
    scoreComponents: generation.scoreComponents,
    explanation: generation.explanation,
    createdAt: generation.createdAt.toISOString(),
    updatedAt: generation.updatedAt.toISOString(),
  };
}
