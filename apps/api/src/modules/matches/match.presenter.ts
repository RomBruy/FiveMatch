import type { FootballMatch } from '@fit-five/shared';
import type { InternalFootballMatch } from './matches.service';

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
    createdAt: match.createdAt.toISOString(),
    updatedAt: match.updatedAt.toISOString(),
  };
}
