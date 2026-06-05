import type {
  FootballMatch,
  FootballMatchAttendance,
  FootballMatchMvpVote,
  FootballMatchOpponentRating,
  FootballMatchOpponentRatingCompletion,
  TeamGenerationVersion,
} from '@fit-five/shared';
import type {
  InternalFootballMatch,
  InternalFootballMatchAttendance,
  InternalFootballMatchMvpVote,
  InternalFootballMatchOpponentRating,
  InternalFootballMatchOpponentRatingCompletion,
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
    score: match.score
      ? {
          teamAScore: match.score.teamAScore,
          teamBScore: match.score.teamBScore,
          submittedByUserId: match.score.submittedByUserId,
          submittedAt: match.score.submittedAt.toISOString(),
        }
      : null,
    finalization: match.finalization
      ? {
          finalizedByUserId: match.finalization.finalizedByUserId,
          finalizedAt: match.finalization.finalizedAt.toISOString(),
        }
      : null,
    events: match.events.map((event) => ({
      id: event.id,
      matchId: event.matchId,
      playerId: event.playerId,
      kind: event.kind,
      count: event.count,
      recordedByUserId: event.recordedByUserId,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    })),
    mvpVotes: match.mvpVotes.map((vote) => serializeMvpVote(vote)),
    myMvpVote: match.myMvpVote ? serializeMvpVote(match.myMvpVote) : null,
    myOpponentRatingCompletion: match.myOpponentRatingCompletion
      ? serializeOpponentRatingCompletion(match.myOpponentRatingCompletion)
      : null,
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

export function serializeMvpVote(
  vote: InternalFootballMatchMvpVote,
): FootballMatchMvpVote {
  return {
    id: vote.id,
    matchId: vote.matchId,
    voterPlayerId: vote.voterPlayerId,
    votedPlayerId: vote.votedPlayerId,
    createdAt: vote.createdAt.toISOString(),
    updatedAt: vote.updatedAt.toISOString(),
  };
}

export function serializeOpponentRating(
  rating: InternalFootballMatchOpponentRating,
): FootballMatchOpponentRating {
  return {
    id: rating.id,
    matchId: rating.matchId,
    raterPlayerId: rating.raterPlayerId,
    ratedPlayerId: rating.ratedPlayerId,
    rating: rating.rating,
    tags: rating.tags,
    createdAt: rating.createdAt.toISOString(),
    updatedAt: rating.updatedAt.toISOString(),
  };
}

export function serializeOpponentRatingCompletion(
  completion: InternalFootballMatchOpponentRatingCompletion,
): FootballMatchOpponentRatingCompletion {
  return {
    id: completion.id,
    matchId: completion.matchId,
    playerId: completion.playerId,
    status: completion.status,
    createdAt: completion.createdAt.toISOString(),
    updatedAt: completion.updatedAt.toISOString(),
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
    manualAdjustment: generation.manualAdjustment,
    createdAt: generation.createdAt.toISOString(),
    updatedAt: generation.updatedAt.toISOString(),
  };
}
