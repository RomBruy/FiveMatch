import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { generateBalancedTeams } from '@fit-five/algorithm';
import {
  type InitialPeerRating as PrismaInitialPeerRating,
  type Match as PrismaMatch,
  type MatchAttendance as PrismaMatchAttendance,
  type MatchEvent as PrismaMatchEvent,
  type MatchMvpVote as PrismaMatchMvpVote,
  type MatchOpponentRating as PrismaMatchOpponentRating,
  type MatchOpponentRatingCompletion as PrismaMatchOpponentRatingCompletion,
  type MatchPlayerStat as PrismaMatchPlayerStat,
  type PlayerRatingHistory as PrismaPlayerRatingHistory,
  type PlayerRatingState as PrismaPlayerRatingState,
  type Prisma,
  type TeamGenerationVersion as PrismaTeamGenerationVersion,
} from '@prisma/client';
import type {
  CreateFootballMatchInput,
  FootballMatchAttendanceResponse,
  FootballMatchAttendanceStatus,
  FootballMatchStatus,
  GroupGeneratorStyle,
  GroupGoalkeeperMode,
  GroupMemberRole,
  ManualTeamAdjustmentInput,
  OpponentRatingCompletionStatus,
  OpponentRatingTag,
  SubmitFinalScoreInput,
  SubmitMvpVoteInput,
  SubmitOpponentRatingsInput,
  SubmitMatchAttendanceInput,
  TeamGenerationExplanation,
  TeamGenerationInputSnapshot,
  TeamGenerationPlayer,
  TeamGenerationScoreComponents,
  TeamGenerationTeam,
  TeamManualAdjustment,
  UpsertMatchPlayerEventsInput,
} from '@fit-five/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  canUpdateGroupSettings,
  normalizeGroupGeneratorStyle,
  normalizeGroupGoalkeeperMode,
  normalizeGroupMemberRole,
} from '../groups/group-options';
import {
  normalizeGeneratorStyleOverride,
  normalizeGoalkeeperModeOverride,
  normalizeAttendanceResponse,
  normalizeAttendanceStatus,
  normalizeMatchStatus,
  isSupportedOpponentRatingTag,
} from './match-options';

const INITIAL_PEER_RATING_READINESS_THRESHOLD = 3;
const DEFAULT_PLAYER_RATING = 50;
const OVERALL_RATING_EVOLUTION_WEIGHT = 0.12;
const FORM_RATING_EVOLUTION_WEIGHT = 0.35;
const EXTREME_OPPONENT_RATING_DISTANCE = 35;
export const TEAM_GENERATION_VERSION_LIMIT = 5;
const MANUAL_ADJUSTMENT_SCORE_WEIGHTS = {
  fair_fresh: {
    rating: 10,
    position: 1.75,
    goalkeeper: 8,
  },
  max_fairness: {
    rating: 14,
    position: 1.25,
    goalkeeper: 9,
  },
  more_variety: {
    rating: 8,
    position: 1.5,
    goalkeeper: 7,
  },
} as const satisfies Record<
  GroupGeneratorStyle,
  {
    rating: number;
    position: number;
    goalkeeper: number;
  }
>;

export type InternalFootballMatchAttendance = {
  id: string;
  matchId: string;
  playerId: string;
  response: FootballMatchAttendanceResponse;
  status: FootballMatchAttendanceStatus;
  waitlistPosition: number | null;
  respondedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type InternalFootballMatchEvent = {
  id: string;
  matchId: string;
  playerId: string;
  kind: 'goal' | 'assist';
  count: number;
  recordedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InternalFootballMatchMvpVote = {
  id: string;
  matchId: string;
  voterPlayerId: string;
  votedPlayerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InternalFootballMatchOpponentRating = {
  id: string;
  matchId: string;
  raterPlayerId: string;
  ratedPlayerId: string;
  rating: number;
  tags: OpponentRatingTag[];
  createdAt: Date;
  updatedAt: Date;
};

export type InternalFootballMatchOpponentRatingCompletion = {
  id: string;
  matchId: string;
  playerId: string;
  status: OpponentRatingCompletionStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type InternalFootballMatch = {
  id: string;
  groupId: string;
  organizerUserId: string;
  title: string;
  startsAt: Date;
  location: string;
  playersPerTeam: number;
  maxPlayers: number;
  attendanceDeadlineAt: Date;
  generatorStyleOverride: GroupGeneratorStyle | null;
  goalkeeperModeOverride: GroupGoalkeeperMode | null;
  status: FootballMatchStatus;
  confirmedCount: number;
  waitlistCount: number;
  score: {
    teamAScore: number;
    teamBScore: number;
    submittedByUserId: string;
    submittedAt: Date;
  } | null;
  finalization: {
    finalizedByUserId: string;
    finalizedAt: Date;
  } | null;
  voiding: {
    voidedByUserId: string;
    voidedAt: Date;
  } | null;
  events: InternalFootballMatchEvent[];
  mvpVotes: InternalFootballMatchMvpVote[];
  myMvpVote: InternalFootballMatchMvpVote | null;
  myOpponentRatingCompletion: InternalFootballMatchOpponentRatingCompletion | null;
  attendances: InternalFootballMatchAttendance[];
  myAttendance: InternalFootballMatchAttendance | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InternalTeamGenerationVersion = {
  id: string;
  matchId: string;
  generatedByUserId: string;
  versionNumber: number;
  seed: string;
  algorithmVersion: string;
  status: 'draft' | 'locked';
  teamA: TeamGenerationTeam;
  teamB: TeamGenerationTeam;
  teamATotal: number;
  teamBTotal: number;
  fairnessPercentage: number;
  inputSnapshot: TeamGenerationInputSnapshot;
  scoreComponents: TeamGenerationScoreComponents;
  explanation: TeamGenerationExplanation;
  manualAdjustment: TeamManualAdjustment | null;
  createdAt: Date;
  updatedAt: Date;
};

type FinalizationTeamPlayer = {
  playerId: string;
  teamLabel: 'A' | 'B';
  generationRating: number;
};

type OpponentRatingSignal = {
  average: number | null;
  rawRatings: number[];
  ignoredExtremeRatings: number;
};

type FinalizedPlayerRatingUpdate = {
  playerId: string;
  teamLabel: 'A' | 'B';
  result: 'win' | 'loss' | 'draw';
  goals: number;
  assists: number;
  mvpVotes: number;
  mvpAwarded: boolean;
  opponentAverageRating: number | null;
  performanceScore: number;
  overallBefore: number;
  overallAfter: number;
  formBefore: number;
  formAfter: number;
  overallDelta: number;
  formDelta: number;
  initialRating: number | null;
  ignoredExtremeRatings: number;
  rawOpponentRatings: number[];
};

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async createMatch(
    clerkUserId: string,
    groupId: string,
    input: CreateFootballMatchInput,
  ): Promise<InternalFootballMatch> {
    const actorMembership = await this.requireGroupMembership(
      clerkUserId,
      groupId,
    );

    if (!canUpdateGroupSettings(actorMembership.role)) {
      throw new ForbiddenException('Owner or admin role required.');
    }

    const match = await this.prisma.match.create({
      data: {
        groupId,
        organizerUserId: actorMembership.userId,
        title: input.title.trim(),
        startsAt: new Date(input.startsAt),
        location: input.location.trim(),
        playersPerTeam: input.playersPerTeam,
        maxPlayers: input.playersPerTeam * 2,
        attendanceDeadlineAt: new Date(input.attendanceDeadlineAt),
        generatorStyleOverride: input.generatorStyleOverride ?? null,
        goalkeeperModeOverride: input.goalkeeperModeOverride ?? null,
      },
    });

    return this.toInternalMatch(match);
  }

  async getNextMatch(
    clerkUserId: string,
    groupId: string,
  ): Promise<InternalFootballMatch | null> {
    const membership = await this.requireGroupMembership(clerkUserId, groupId);
    const currentPlayer = await this.findGroupPlayer(
      membership.userId,
      groupId,
    );

    const match = await this.prisma.match.findFirst({
      where: {
        groupId,
        status: {
          in: ['open', 'locked'],
        },
        startsAt: {
          gte: new Date(),
        },
      },
      orderBy: {
        startsAt: 'asc',
      },
    });

    return match ? this.toInternalMatch(match, currentPlayer?.id) : null;
  }

  async submitAttendance(
    clerkUserId: string,
    groupId: string,
    matchId: string,
    input: SubmitMatchAttendanceInput,
  ): Promise<InternalFootballMatch> {
    const actor = await this.requireGroupPlayer(clerkUserId, groupId);
    const match = await this.prisma.match.findFirst({
      where: {
        id: matchId,
        groupId,
        status: 'open',
      },
    });

    if (!match) {
      throw new ForbiddenException('Open match required.');
    }

    const existingAttendance = await this.prisma.matchAttendance.findUnique({
      where: {
        matchId_playerId: {
          matchId,
          playerId: actor.playerId,
        },
      },
    });
    const response = normalizeAttendanceResponse(input.response);
    const nextStatus = await this.getNextAttendanceStatus(
      match,
      actor.playerId,
      response,
    );
    const waitlistPosition =
      nextStatus === 'waitlisted'
        ? await this.getNextWaitlistPosition(matchId, actor.playerId)
        : null;

    await this.prisma.matchAttendance.upsert({
      where: {
        matchId_playerId: {
          matchId,
          playerId: actor.playerId,
        },
      },
      create: {
        matchId,
        playerId: actor.playerId,
        response,
        status: nextStatus,
        waitlistPosition,
      },
      update: {
        response,
        status: nextStatus,
        waitlistPosition:
          nextStatus === 'waitlisted'
            ? (existingAttendance?.waitlistPosition ?? waitlistPosition)
            : null,
        respondedAt: new Date(),
      },
    });
    await this.reconcileWaitlist(match);

    return this.toInternalMatch(match, actor.playerId);
  }

  async submitFinalScore(
    clerkUserId: string,
    groupId: string,
    matchId: string,
    input: SubmitFinalScoreInput,
  ): Promise<InternalFootballMatch> {
    const actorMembership = await this.requireGroupMembership(
      clerkUserId,
      groupId,
    );
    const match = await this.prisma.match.findFirst({
      where: {
        id: matchId,
        groupId,
      },
    });

    if (!match) {
      throw new ForbiddenException('Match required.');
    }

    if (
      !canUpdateGroupSettings(actorMembership.role) &&
      match.organizerUserId !== actorMembership.userId
    ) {
      throw new ForbiddenException('Organizer role required.');
    }

    if (normalizeMatchStatus(match.status) !== 'locked') {
      throw new ConflictException('Locked teams required before scoring.');
    }

    const lockedGeneration = await this.prisma.teamGenerationVersion.findFirst({
      where: {
        matchId: match.id,
        status: 'locked',
      },
      select: {
        id: true,
      },
    });

    if (!lockedGeneration) {
      throw new ConflictException('Locked team generation required.');
    }

    if (
      match.teamAScore === input.teamAScore &&
      match.teamBScore === input.teamBScore &&
      match.scoreSubmittedByUserId &&
      match.scoreSubmittedAt
    ) {
      const actorPlayer = await this.findGroupPlayer(
        actorMembership.userId,
        groupId,
      );

      return this.toInternalMatch(match, actorPlayer?.id);
    }

    const updatedMatch = await this.prisma.match.update({
      where: {
        id: match.id,
      },
      data: {
        teamAScore: input.teamAScore,
        teamBScore: input.teamBScore,
        scoreSubmittedByUserId: actorMembership.userId,
        scoreSubmittedAt: new Date(),
      },
    });

    const actorPlayer = await this.findGroupPlayer(
      actorMembership.userId,
      groupId,
    );

    return this.toInternalMatch(updatedMatch, actorPlayer?.id);
  }

  async upsertMatchPlayerEvents(
    clerkUserId: string,
    groupId: string,
    matchId: string,
    input: UpsertMatchPlayerEventsInput,
  ): Promise<InternalFootballMatch> {
    const actorMembership = await this.requireGroupMembership(
      clerkUserId,
      groupId,
    );
    const match = await this.prisma.match.findFirst({
      where: {
        id: matchId,
        groupId,
      },
    });

    if (!match) {
      throw new ForbiddenException('Match required.');
    }

    if (
      !canUpdateGroupSettings(actorMembership.role) &&
      match.organizerUserId !== actorMembership.userId
    ) {
      throw new ForbiddenException('Organizer role required.');
    }

    if (
      normalizeMatchStatus(match.status) !== 'locked' ||
      match.teamAScore === null ||
      match.teamBScore === null
    ) {
      throw new ConflictException(
        'Locked teams and submitted score required before match events.',
      );
    }

    const lockedGeneration = await this.prisma.teamGenerationVersion.findFirst({
      where: {
        matchId: match.id,
        status: 'locked',
      },
    });

    if (!lockedGeneration) {
      throw new ConflictException('Locked team generation required.');
    }

    const lockedPlayerIds = getLockedGenerationPlayerIds(lockedGeneration);
    const requestedPlayerIds = new Set<string>();

    for (const statLine of input.players) {
      if (!lockedPlayerIds.has(statLine.playerId)) {
        throw new ConflictException(
          'Match events can only use locked team players.',
        );
      }

      if (requestedPlayerIds.has(statLine.playerId)) {
        throw new ConflictException('Duplicate player event row.');
      }

      requestedPlayerIds.add(statLine.playerId);
    }

    const statLineByPlayerId = new Map(
      input.players.map((statLine) => [statLine.playerId, statLine]),
    );
    const operations = [...lockedPlayerIds].flatMap((playerId) => {
      const statLine = statLineByPlayerId.get(playerId) ?? {
        playerId,
        goals: 0,
        assists: 0,
      };

      return [
        this.buildMatchEventWriteOperation(
          match.id,
          playerId,
          'goal',
          statLine.goals,
          actorMembership.userId,
        ),
        this.buildMatchEventWriteOperation(
          match.id,
          playerId,
          'assist',
          statLine.assists,
          actorMembership.userId,
        ),
      ];
    });

    await this.prisma.$transaction(operations);

    const actorPlayer = await this.findGroupPlayer(
      actorMembership.userId,
      groupId,
    );

    return this.toInternalMatch(match, actorPlayer?.id);
  }

  async submitMvpVote(
    clerkUserId: string,
    groupId: string,
    matchId: string,
    input: SubmitMvpVoteInput,
  ): Promise<{
    vote: InternalFootballMatchMvpVote;
    match: InternalFootballMatch;
  }> {
    const actor = await this.requireGroupPlayer(clerkUserId, groupId);
    const match = await this.prisma.match.findFirst({
      where: {
        id: matchId,
        groupId,
      },
    });

    if (!match || normalizeMatchStatus(match.status) !== 'locked') {
      throw new ConflictException('Locked match required for MVP voting.');
    }

    const attendance = await this.prisma.matchAttendance.findUnique({
      where: {
        matchId_playerId: {
          matchId,
          playerId: actor.playerId,
        },
      },
    });

    if (
      !attendance ||
      normalizeAttendanceStatus(attendance.status) !== 'confirmed'
    ) {
      throw new ForbiddenException('Confirmed match player required.');
    }

    const lockedGeneration = await this.prisma.teamGenerationVersion.findFirst({
      where: {
        matchId: match.id,
        status: 'locked',
      },
    });

    if (!lockedGeneration) {
      throw new ConflictException('Locked team generation required.');
    }

    const lockedPlayerIds = getLockedGenerationPlayerIds(lockedGeneration);

    if (!lockedPlayerIds.has(actor.playerId)) {
      throw new ForbiddenException('Voter must be a locked team player.');
    }

    if (!lockedPlayerIds.has(input.votedPlayerId)) {
      throw new ConflictException(
        'MVP candidate must be a locked team player.',
      );
    }

    if (input.votedPlayerId === actor.playerId) {
      throw new ConflictException('Self MVP votes are not allowed.');
    }

    const existingVote = await this.prisma.matchMvpVote.findUnique({
      where: {
        matchId_voterPlayerId: {
          matchId: match.id,
          voterPlayerId: actor.playerId,
        },
      },
    });

    if (existingVote) {
      throw new ConflictException('MVP vote already submitted.');
    }

    const vote = await this.prisma.matchMvpVote.create({
      data: {
        matchId: match.id,
        voterPlayerId: actor.playerId,
        votedPlayerId: input.votedPlayerId,
      },
    });

    return {
      vote: this.toInternalMvpVote(vote),
      match: await this.toInternalMatch(match, actor.playerId),
    };
  }

  async submitOpponentRatings(
    clerkUserId: string,
    groupId: string,
    matchId: string,
    input: SubmitOpponentRatingsInput,
  ): Promise<{
    ratings: InternalFootballMatchOpponentRating[];
    completion: InternalFootballMatchOpponentRatingCompletion;
    match: InternalFootballMatch;
  }> {
    const actor = await this.requireGroupPlayer(clerkUserId, groupId);
    const { match, opponentPlayerIds } = await this.getOpponentRatingContext(
      groupId,
      matchId,
      actor.playerId,
    );
    const requestedPlayerIds = new Set<string>();

    if (input.ratings.length !== opponentPlayerIds.size) {
      throw new ConflictException('Every opponent must be rated or skipped.');
    }

    for (const rating of input.ratings) {
      if (!opponentPlayerIds.has(rating.ratedPlayerId)) {
        throw new ConflictException('Only opponents can be rated.');
      }

      if (requestedPlayerIds.has(rating.ratedPlayerId)) {
        throw new ConflictException('Duplicate opponent rating row.');
      }

      if (rating.tags?.some((tag) => !isSupportedOpponentRatingTag(tag))) {
        throw new ConflictException('Unsupported opponent rating tag.');
      }

      requestedPlayerIds.add(rating.ratedPlayerId);
    }

    const operations = [
      ...input.ratings.map((rating) =>
        this.prisma.matchOpponentRating.upsert({
          where: {
            matchId_raterPlayerId_ratedPlayerId: {
              matchId: match.id,
              raterPlayerId: actor.playerId,
              ratedPlayerId: rating.ratedPlayerId,
            },
          },
          create: {
            matchId: match.id,
            raterPlayerId: actor.playerId,
            ratedPlayerId: rating.ratedPlayerId,
            rating: rating.rating,
            tags: [...new Set(rating.tags ?? [])],
          },
          update: {
            rating: rating.rating,
            tags: [...new Set(rating.tags ?? [])],
          },
        }),
      ),
      this.prisma.matchOpponentRatingCompletion.upsert({
        where: {
          matchId_playerId: {
            matchId: match.id,
            playerId: actor.playerId,
          },
        },
        create: {
          matchId: match.id,
          playerId: actor.playerId,
          status: 'submitted',
        },
        update: {
          status: 'submitted',
        },
      }),
    ];
    const results = await this.prisma.$transaction(operations);
    const savedRatings = results.slice(
      0,
      input.ratings.length,
    ) as PrismaMatchOpponentRating[];
    const completion = results[
      results.length - 1
    ] as PrismaMatchOpponentRatingCompletion;

    return {
      ratings: savedRatings.map((rating) =>
        this.toInternalOpponentRating(rating),
      ),
      completion: this.toInternalOpponentRatingCompletion(completion),
      match: await this.toInternalMatch(match, actor.playerId),
    };
  }

  async skipOpponentRatings(
    clerkUserId: string,
    groupId: string,
    matchId: string,
  ): Promise<{
    completion: InternalFootballMatchOpponentRatingCompletion;
    match: InternalFootballMatch;
  }> {
    const actor = await this.requireGroupPlayer(clerkUserId, groupId);
    const { match } = await this.getOpponentRatingContext(
      groupId,
      matchId,
      actor.playerId,
    );
    const completion = await this.prisma.matchOpponentRatingCompletion.upsert({
      where: {
        matchId_playerId: {
          matchId: match.id,
          playerId: actor.playerId,
        },
      },
      create: {
        matchId: match.id,
        playerId: actor.playerId,
        status: 'skipped',
      },
      update: {
        status: 'skipped',
      },
    });

    return {
      completion: this.toInternalOpponentRatingCompletion(completion),
      match: await this.toInternalMatch(match, actor.playerId),
    };
  }

  async finalizeMatch(
    clerkUserId: string,
    groupId: string,
    matchId: string,
  ): Promise<InternalFootballMatch> {
    const actorMembership = await this.requireGroupMembership(
      clerkUserId,
      groupId,
    );
    const match = await this.prisma.match.findFirst({
      where: {
        id: matchId,
        groupId,
      },
    });

    if (!match) {
      throw new ForbiddenException('Match required.');
    }

    if (
      !canUpdateGroupSettings(actorMembership.role) &&
      match.organizerUserId !== actorMembership.userId
    ) {
      throw new ForbiddenException('Organizer role required.');
    }

    const actorPlayer = await this.findGroupPlayer(
      actorMembership.userId,
      groupId,
    );

    if (normalizeMatchStatus(match.status) === 'completed') {
      return this.toInternalMatch(match, actorPlayer?.id);
    }

    if (normalizeMatchStatus(match.status) !== 'locked') {
      throw new ConflictException('Locked match required for finalization.');
    }

    if (
      match.teamAScore === null ||
      match.teamBScore === null ||
      !match.scoreSubmittedByUserId ||
      !match.scoreSubmittedAt
    ) {
      throw new ConflictException('Final score required before finalization.');
    }

    const lockedGeneration = await this.prisma.teamGenerationVersion.findFirst({
      where: {
        matchId: match.id,
        status: 'locked',
      },
    });

    if (!lockedGeneration) {
      throw new ConflictException('Locked team generation required.');
    }

    const finalizedAt = new Date();
    const playerUpdates = await this.buildFinalizedPlayerRatingUpdates(
      groupId,
      match,
      lockedGeneration,
    );
    const operations = playerUpdates.flatMap((update) => [
      this.prisma.playerRatingState.upsert({
        where: {
          playerId: update.playerId,
        },
        create: {
          playerId: update.playerId,
          overallRating: update.overallAfter,
          formRating: update.formAfter,
          gamesPlayed: 1,
          wins: update.result === 'win' ? 1 : 0,
          losses: update.result === 'loss' ? 1 : 0,
          draws: update.result === 'draw' ? 1 : 0,
          goals: update.goals,
          assists: update.assists,
          mvpAwards: update.mvpAwarded ? 1 : 0,
          mvpVotes: update.mvpVotes,
        },
        update: {
          overallRating: update.overallAfter,
          formRating: update.formAfter,
          gamesPlayed: {
            increment: 1,
          },
          wins: {
            increment: update.result === 'win' ? 1 : 0,
          },
          losses: {
            increment: update.result === 'loss' ? 1 : 0,
          },
          draws: {
            increment: update.result === 'draw' ? 1 : 0,
          },
          goals: {
            increment: update.goals,
          },
          assists: {
            increment: update.assists,
          },
          mvpAwards: {
            increment: update.mvpAwarded ? 1 : 0,
          },
          mvpVotes: {
            increment: update.mvpVotes,
          },
        },
      }),
      this.prisma.matchPlayerStat.upsert({
        where: {
          matchId_playerId: {
            matchId: match.id,
            playerId: update.playerId,
          },
        },
        create: {
          matchId: match.id,
          playerId: update.playerId,
          teamLabel: update.teamLabel,
          result: update.result,
          goals: update.goals,
          assists: update.assists,
          mvpVotes: update.mvpVotes,
          mvpAwarded: update.mvpAwarded,
          opponentAverageRating: update.opponentAverageRating,
          performanceScore: update.performanceScore,
          overallBefore: update.overallBefore,
          overallAfter: update.overallAfter,
          formBefore: update.formBefore,
          formAfter: update.formAfter,
        },
        update: {
          teamLabel: update.teamLabel,
          result: update.result,
          goals: update.goals,
          assists: update.assists,
          mvpVotes: update.mvpVotes,
          mvpAwarded: update.mvpAwarded,
          opponentAverageRating: update.opponentAverageRating,
          performanceScore: update.performanceScore,
          overallBefore: update.overallBefore,
          overallAfter: update.overallAfter,
          formBefore: update.formBefore,
          formAfter: update.formAfter,
        },
      }),
      this.prisma.playerRatingHistory.upsert({
        where: {
          matchId_playerId: {
            matchId: match.id,
            playerId: update.playerId,
          },
        },
        create: {
          playerId: update.playerId,
          matchId: match.id,
          overallBefore: update.overallBefore,
          overallAfter: update.overallAfter,
          formBefore: update.formBefore,
          formAfter: update.formAfter,
          overallDelta: update.overallDelta,
          formDelta: update.formDelta,
          reason: this.buildRatingHistoryReason(update, match),
        },
        update: {
          overallBefore: update.overallBefore,
          overallAfter: update.overallAfter,
          formBefore: update.formBefore,
          formAfter: update.formAfter,
          overallDelta: update.overallDelta,
          formDelta: update.formDelta,
          reason: this.buildRatingHistoryReason(update, match),
        },
      }),
    ]);
    const transactionResults = await this.prisma.$transaction([
      ...operations,
      this.prisma.match.update({
        where: {
          id: match.id,
        },
        data: {
          status: 'completed',
          finalizedByUserId: actorMembership.userId,
          finalizedAt,
        },
      }),
    ]);
    const updatedMatch = transactionResults[
      transactionResults.length - 1
    ] as PrismaMatch;

    return this.toInternalMatch(updatedMatch, actorPlayer?.id);
  }

  async voidFinalizedMatch(
    clerkUserId: string,
    groupId: string,
    matchId: string,
  ): Promise<InternalFootballMatch> {
    const actorMembership = await this.requireGroupMembership(
      clerkUserId,
      groupId,
    );

    if (!canUpdateGroupSettings(actorMembership.role)) {
      throw new ForbiddenException('Owner or admin role required.');
    }

    const match = await this.prisma.match.findFirst({
      where: {
        id: matchId,
        groupId,
      },
    });

    if (!match) {
      throw new ForbiddenException('Match required.');
    }

    const actorPlayer = await this.findGroupPlayer(
      actorMembership.userId,
      groupId,
    );

    if (normalizeMatchStatus(match.status) === 'voided') {
      return this.toInternalMatch(match, actorPlayer?.id);
    }

    if (
      normalizeMatchStatus(match.status) !== 'completed' ||
      !match.finalizedAt
    ) {
      throw new ConflictException('Finalized match required for voiding.');
    }

    const matchPlayerStats = await this.prisma.matchPlayerStat.findMany({
      where: {
        matchId: match.id,
      },
    });
    const affectedPlayerIds = [
      ...new Set(matchPlayerStats.map((stat) => stat.playerId)),
    ];
    const recomputeOperations =
      await this.buildPlayerRatingStateRecomputeOperations(
        affectedPlayerIds,
        match.id,
      );
    const voidedAt = new Date();
    const transactionResults = await this.prisma.$transaction([
      this.prisma.matchPlayerStat.updateMany({
        where: {
          matchId: match.id,
        },
        data: {
          voidedAt,
        },
      }),
      this.prisma.playerRatingHistory.updateMany({
        where: {
          matchId: match.id,
        },
        data: {
          voidedAt,
        },
      }),
      ...recomputeOperations,
      this.prisma.match.update({
        where: {
          id: match.id,
        },
        data: {
          status: 'voided',
          voidedByUserId: actorMembership.userId,
          voidedAt,
        },
      }),
    ]);
    const updatedMatch = transactionResults[
      transactionResults.length - 1
    ] as PrismaMatch;

    return this.toInternalMatch(updatedMatch, actorPlayer?.id);
  }

  async generateTeamVersion(
    clerkUserId: string,
    groupId: string,
    matchId: string,
  ): Promise<InternalTeamGenerationVersion> {
    const actorMembership = await this.requireGroupMembership(
      clerkUserId,
      groupId,
    );
    const match = await this.prisma.match.findFirst({
      where: {
        id: matchId,
        groupId,
        status: 'open',
      },
      include: {
        group: {
          include: {
            settings: true,
          },
        },
      },
    });

    if (!match) {
      throw new ForbiddenException('Open match required.');
    }

    if (
      !canUpdateGroupSettings(actorMembership.role) &&
      match.organizerUserId !== actorMembership.userId
    ) {
      throw new ForbiddenException('Organizer role required.');
    }

    const lockedGeneration = await this.prisma.teamGenerationVersion.findFirst({
      where: {
        matchId: match.id,
        status: 'locked',
      },
      select: {
        id: true,
      },
    });

    if (lockedGeneration) {
      throw new ConflictException('Locked team generation cannot regenerate.');
    }

    const existingGenerationCount =
      await this.prisma.teamGenerationVersion.count({
        where: {
          matchId: match.id,
        },
      });

    if (existingGenerationCount >= TEAM_GENERATION_VERSION_LIMIT) {
      throw new ConflictException('Team generation version limit reached.');
    }

    const confirmedAttendances = await this.prisma.matchAttendance.findMany({
      where: {
        matchId: match.id,
        status: 'confirmed',
      },
      include: {
        player: {
          select: {
            id: true,
            preferredStyle: true,
          },
        },
      },
      orderBy: {
        respondedAt: 'asc',
      },
    });

    if (confirmedAttendances.length !== match.maxPlayers) {
      throw new ConflictException(
        'Confirmed player pool must be full before generation.',
      );
    }

    const playerIds = confirmedAttendances.map(
      (attendance) => attendance.playerId,
    );
    const playerRatings = await this.getGenerationPlayerRatings(
      groupId,
      playerIds,
    );
    const ratingByPlayerId = new Map(
      playerRatings.map((rating) => [rating.playerId, rating]),
    );
    const missingReadyPlayers = playerIds.filter((playerId) => {
      const rating = ratingByPlayerId.get(playerId);

      return (
        !rating ||
        rating.ratingsReceived < INITIAL_PEER_RATING_READINESS_THRESHOLD
      );
    });

    if (missingReadyPlayers.length > 0) {
      throw new ConflictException(
        'Confirmed players need more ratings before generation.',
      );
    }

    const generatorStyle =
      normalizeGeneratorStyleOverride(match.generatorStyleOverride) ??
      normalizeGroupGeneratorStyle(match.group.settings?.generatorStyle);
    const goalkeeperMode =
      normalizeGoalkeeperModeOverride(match.goalkeeperModeOverride) ??
      normalizeGroupGoalkeeperMode(match.group.settings?.goalkeeperMode);
    const versionNumber = existingGenerationCount + 1;
    const seed = `${match.id}:v${versionNumber}`;
    const algorithmInputPlayers = confirmedAttendances.map((attendance) => {
      const rating = ratingByPlayerId.get(attendance.playerId);

      if (!rating) {
        throw new ConflictException('Confirmed player rating is missing.');
      }

      return {
        playerId: attendance.playerId,
        rating: rating.rating,
        preferredStyle: attendance.player.preferredStyle,
      };
    });
    const inputSnapshot: TeamGenerationInputSnapshot = {
      matchId: match.id,
      groupId,
      playersPerTeam: match.playersPerTeam,
      generatorStyle,
      goalkeeperMode,
      playerRatings: algorithmInputPlayers.map((player) => ({
        playerId: player.playerId,
        rating: player.rating,
        ratingsReceived:
          ratingByPlayerId.get(player.playerId)?.ratingsReceived ?? 0,
        preferredStyle: player.preferredStyle,
      })),
    };
    const result = generateBalancedTeams({
      players: algorithmInputPlayers,
      playersPerTeam: match.playersPerTeam,
      seed,
      style: generatorStyle,
      goalkeeperMode,
    });
    const generation = await this.prisma.teamGenerationVersion.create({
      data: {
        matchId: match.id,
        generatedByUserId: actorMembership.userId,
        versionNumber,
        seed,
        algorithmVersion: result.algorithmVersion,
        teamA: result.teamA,
        teamB: result.teamB,
        teamATotal: result.teamA.totalRating,
        teamBTotal: result.teamB.totalRating,
        fairnessPercentage: result.fairnessPercentage,
        inputSnapshot,
        scoreComponents: result.scoreComponents,
        explanation: result.explanation,
      },
    });

    return this.toInternalTeamGenerationVersion(generation);
  }

  async listTeamGenerations(
    clerkUserId: string,
    groupId: string,
    matchId: string,
  ): Promise<InternalTeamGenerationVersion[]> {
    await this.requireGroupMembership(clerkUserId, groupId);

    const match = await this.prisma.match.findFirst({
      where: {
        id: matchId,
        groupId,
      },
      select: {
        id: true,
      },
    });

    if (!match) {
      throw new ForbiddenException('Match required.');
    }

    const generations = await this.prisma.teamGenerationVersion.findMany({
      where: {
        matchId,
      },
      orderBy: {
        versionNumber: 'desc',
      },
    });

    return generations.map((generation) =>
      this.toInternalTeamGenerationVersion(generation),
    );
  }

  async getLatestTeamGeneration(
    clerkUserId: string,
    groupId: string,
    matchId: string,
  ): Promise<InternalTeamGenerationVersion | null> {
    await this.requireGroupMembership(clerkUserId, groupId);

    const match = await this.prisma.match.findFirst({
      where: {
        id: matchId,
        groupId,
      },
      select: {
        id: true,
      },
    });

    if (!match) {
      throw new ForbiddenException('Match required.');
    }

    const generation = await this.prisma.teamGenerationVersion.findFirst({
      where: {
        matchId,
      },
      orderBy: {
        versionNumber: 'desc',
      },
    });

    return generation ? this.toInternalTeamGenerationVersion(generation) : null;
  }

  async applyManualTeamAdjustment(
    clerkUserId: string,
    groupId: string,
    matchId: string,
    generationId: string,
    input: ManualTeamAdjustmentInput,
  ): Promise<InternalTeamGenerationVersion> {
    const actorMembership = await this.requireGroupMembership(
      clerkUserId,
      groupId,
    );
    const match = await this.prisma.match.findFirst({
      where: {
        id: matchId,
        groupId,
        status: 'open',
      },
      select: {
        id: true,
        organizerUserId: true,
      },
    });

    if (!match) {
      throw new ForbiddenException('Open match required.');
    }

    if (
      !canUpdateGroupSettings(actorMembership.role) &&
      match.organizerUserId !== actorMembership.userId
    ) {
      throw new ForbiddenException('Organizer role required.');
    }

    const generation = await this.prisma.teamGenerationVersion.findFirst({
      where: {
        id: generationId,
        matchId: match.id,
      },
    });

    if (!generation) {
      throw new ForbiddenException('Team generation required.');
    }

    if (generation.status === 'locked') {
      throw new ConflictException('Locked team generation cannot be adjusted.');
    }

    if (generation.manualAdjustment) {
      throw new ConflictException('Manual adjustment already used.');
    }

    const teamA = generation.teamA as unknown as TeamGenerationTeam;
    const teamB = generation.teamB as unknown as TeamGenerationTeam;
    const adjustedTeams = swapTeamPlayers(
      teamA,
      teamB,
      input.teamAPlayerId,
      input.teamBPlayerId,
    );
    const inputSnapshot =
      generation.inputSnapshot as unknown as TeamGenerationInputSnapshot;
    const scoreComponents = scoreAdjustedTeams(
      adjustedTeams.teamA,
      adjustedTeams.teamB,
      inputSnapshot,
    );
    const manualAdjustment: TeamManualAdjustment = {
      type: 'swap',
      adjustedAt: new Date().toISOString(),
      adjustedByUserId: actorMembership.userId,
      fromTeamAPlayerId: input.teamAPlayerId,
      fromTeamBPlayerId: input.teamBPlayerId,
    };
    const explanation: TeamGenerationExplanation = {
      summary: `Manual swap applied. Team A averages ${adjustedTeams.teamA.averageRating}/100 and Team B averages ${adjustedTeams.teamB.averageRating}/100, with a ${scoreComponents.ratingGap}/100 rating gap.`,
      bullets: [
        'One manual swap was used for this draft version.',
        'Team totals and fairness were recalculated after the swap.',
        'No additional manual adjustment is available for this version.',
      ],
    };
    const updatedGeneration = await this.prisma.teamGenerationVersion.update({
      where: {
        id: generation.id,
      },
      data: {
        teamA: adjustedTeams.teamA,
        teamB: adjustedTeams.teamB,
        teamATotal: adjustedTeams.teamA.totalRating,
        teamBTotal: adjustedTeams.teamB.totalRating,
        fairnessPercentage: getFairnessPercentage(scoreComponents),
        scoreComponents,
        explanation,
        manualAdjustment,
      },
    });

    return this.toInternalTeamGenerationVersion(updatedGeneration);
  }

  async confirmTeamGeneration(
    clerkUserId: string,
    groupId: string,
    matchId: string,
    generationId: string,
  ): Promise<{
    match: InternalFootballMatch;
    generation: InternalTeamGenerationVersion;
  }> {
    const actorMembership = await this.requireGroupMembership(
      clerkUserId,
      groupId,
    );
    const match = await this.prisma.match.findFirst({
      where: {
        id: matchId,
        groupId,
      },
    });

    if (!match) {
      throw new ForbiddenException('Match required.');
    }

    if (
      !canUpdateGroupSettings(actorMembership.role) &&
      match.organizerUserId !== actorMembership.userId
    ) {
      throw new ForbiddenException('Organizer role required.');
    }

    const generation = await this.prisma.teamGenerationVersion.findFirst({
      where: {
        id: generationId,
        matchId: match.id,
      },
    });

    if (!generation) {
      throw new ForbiddenException('Team generation required.');
    }

    if (match.status === 'locked' && generation.status === 'locked') {
      return {
        match: await this.toInternalMatch(match),
        generation: this.toInternalTeamGenerationVersion(generation),
      };
    }

    if (normalizeMatchStatus(match.status) !== 'open') {
      throw new ConflictException('Open match required for team confirmation.');
    }

    if (generation.status === 'locked') {
      throw new ConflictException('Team generation is already locked.');
    }

    const lockedGeneration = await this.prisma.teamGenerationVersion.findFirst({
      where: {
        matchId: match.id,
        status: 'locked',
      },
      select: {
        id: true,
      },
    });

    if (lockedGeneration && lockedGeneration.id !== generation.id) {
      throw new ConflictException('Another team generation is already locked.');
    }

    const [, updatedGeneration, updatedMatch] = await this.prisma.$transaction([
      this.prisma.teamGenerationVersion.updateMany({
        where: {
          matchId: match.id,
          NOT: {
            id: generation.id,
          },
        },
        data: {
          status: 'draft',
        },
      }),
      this.prisma.teamGenerationVersion.update({
        where: {
          id: generation.id,
        },
        data: {
          status: 'locked',
        },
      }),
      this.prisma.match.update({
        where: {
          id: match.id,
        },
        data: {
          status: 'locked',
        },
      }),
    ]);

    return {
      match: await this.toInternalMatch(updatedMatch),
      generation: this.toInternalTeamGenerationVersion(updatedGeneration),
    };
  }

  private buildMatchEventWriteOperation(
    matchId: string,
    playerId: string,
    kind: InternalFootballMatchEvent['kind'],
    count: number,
    recordedByUserId: string,
  ) {
    if (count <= 0) {
      return this.prisma.matchEvent.deleteMany({
        where: {
          matchId,
          playerId,
          kind,
        },
      });
    }

    return this.prisma.matchEvent.upsert({
      where: {
        matchId_playerId_kind: {
          matchId,
          playerId,
          kind,
        },
      },
      create: {
        matchId,
        playerId,
        kind,
        count,
        recordedByUserId,
      },
      update: {
        count,
        recordedByUserId,
      },
    });
  }

  private async getOpponentRatingContext(
    groupId: string,
    matchId: string,
    playerId: string,
  ): Promise<{
    match: PrismaMatch;
    opponentPlayerIds: Set<string>;
  }> {
    const match = await this.prisma.match.findFirst({
      where: {
        id: matchId,
        groupId,
      },
    });

    if (!match || normalizeMatchStatus(match.status) !== 'locked') {
      throw new ConflictException(
        'Locked match required for opponent ratings.',
      );
    }

    const attendance = await this.prisma.matchAttendance.findUnique({
      where: {
        matchId_playerId: {
          matchId,
          playerId,
        },
      },
    });

    if (
      !attendance ||
      normalizeAttendanceStatus(attendance.status) !== 'confirmed'
    ) {
      throw new ForbiddenException('Confirmed match player required.');
    }

    const lockedGeneration = await this.prisma.teamGenerationVersion.findFirst({
      where: {
        matchId: match.id,
        status: 'locked',
      },
    });

    if (!lockedGeneration) {
      throw new ConflictException('Locked team generation required.');
    }

    const opponentPlayerIds = getOpponentPlayerIds(
      getLockedGenerationTeamContext(lockedGeneration),
      playerId,
    );

    if (!opponentPlayerIds) {
      throw new ForbiddenException('Rater must be a locked team player.');
    }

    return {
      match,
      opponentPlayerIds,
    };
  }

  private async requireGroupMembership(
    clerkUserId: string,
    groupId: string,
  ): Promise<{ userId: string; role: GroupMemberRole }> {
    const user = await this.prisma.user.findUnique({
      where: {
        clerkUserId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      throw new ForbiddenException('Group membership required.');
    }

    const membership = await this.prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: user.id,
      },
      select: {
        userId: true,
        role: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('Group membership required.');
    }

    return {
      userId: membership.userId,
      role: normalizeGroupMemberRole(membership.role),
    };
  }

  private async requireGroupPlayer(
    clerkUserId: string,
    groupId: string,
  ): Promise<{ userId: string; role: GroupMemberRole; playerId: string }> {
    const membership = await this.requireGroupMembership(clerkUserId, groupId);
    const player = await this.findGroupPlayer(membership.userId, groupId);

    if (!player) {
      throw new ForbiddenException('Player profile required.');
    }

    return {
      ...membership,
      playerId: player.id,
    };
  }

  private async findGroupPlayer(userId: string, groupId: string) {
    return this.prisma.player.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      select: {
        id: true,
      },
    });
  }

  private async getNextAttendanceStatus(
    match: PrismaMatch,
    playerId: string,
    response: FootballMatchAttendanceResponse,
  ): Promise<FootballMatchAttendanceStatus> {
    if (response === 'out' || response === 'maybe') {
      return response;
    }

    const confirmedCountExcludingPlayer =
      await this.prisma.matchAttendance.count({
        where: {
          matchId: match.id,
          status: 'confirmed',
          NOT: {
            playerId,
          },
        },
      });

    return confirmedCountExcludingPlayer < match.maxPlayers
      ? 'confirmed'
      : 'waitlisted';
  }

  private async getNextWaitlistPosition(matchId: string, playerId: string) {
    const existingAttendance = await this.prisma.matchAttendance.findUnique({
      where: {
        matchId_playerId: {
          matchId,
          playerId,
        },
      },
      select: {
        waitlistPosition: true,
      },
    });

    if (existingAttendance?.waitlistPosition) {
      return existingAttendance.waitlistPosition;
    }

    const waitlistCount = await this.prisma.matchAttendance.count({
      where: {
        matchId,
        status: 'waitlisted',
      },
    });

    return waitlistCount + 1;
  }

  private async getGenerationPlayerRatings(
    groupId: string,
    playerIds: string[],
  ) {
    const ratings = await this.prisma.initialPeerRating.findMany({
      where: {
        groupId,
        ratedPlayerId: {
          in: playerIds,
        },
      },
    });
    const ratingsByPlayerId = new Map<string, PrismaInitialPeerRating[]>();

    for (const rating of ratings) {
      const playerRatings = ratingsByPlayerId.get(rating.ratedPlayerId) ?? [];
      playerRatings.push(rating);
      ratingsByPlayerId.set(rating.ratedPlayerId, playerRatings);
    }

    return playerIds.map((playerId) => {
      const playerRatings = ratingsByPlayerId.get(playerId) ?? [];
      const ratingsReceived = playerRatings.length;
      const averageOverall =
        ratingsReceived === 0
          ? 0
          : playerRatings.reduce((total, rating) => total + rating.overall, 0) /
            ratingsReceived;

      return {
        playerId,
        rating: Math.round(averageOverall * 10) / 10,
        ratingsReceived,
      };
    });
  }

  private async reconcileWaitlist(match: PrismaMatch) {
    const confirmedCount = await this.prisma.matchAttendance.count({
      where: {
        matchId: match.id,
        status: 'confirmed',
      },
    });
    let availableSpots = Math.max(match.maxPlayers - confirmedCount, 0);

    while (availableSpots > 0) {
      const nextWaitlistedPlayer = await this.prisma.matchAttendance.findFirst({
        where: {
          matchId: match.id,
          status: 'waitlisted',
        },
        orderBy: [
          {
            waitlistPosition: 'asc',
          },
          {
            respondedAt: 'asc',
          },
          {
            createdAt: 'asc',
          },
        ],
      });

      if (!nextWaitlistedPlayer) {
        break;
      }

      await this.prisma.matchAttendance.update({
        where: {
          id: nextWaitlistedPlayer.id,
        },
        data: {
          response: 'in',
          status: 'confirmed',
          waitlistPosition: null,
          respondedAt: new Date(),
        },
      });
      availableSpots -= 1;
    }

    await this.normalizeWaitlistPositions(match.id);
  }

  private async normalizeWaitlistPositions(matchId: string) {
    const waitlistedPlayers = await this.prisma.matchAttendance.findMany({
      where: {
        matchId,
        status: 'waitlisted',
      },
      orderBy: [
        {
          waitlistPosition: 'asc',
        },
        {
          respondedAt: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });

    for (const [index, attendance] of waitlistedPlayers.entries()) {
      const nextPosition = index + 1;

      if (attendance.waitlistPosition === nextPosition) {
        continue;
      }

      await this.prisma.matchAttendance.update({
        where: {
          id: attendance.id,
        },
        data: {
          waitlistPosition: nextPosition,
        },
      });
    }
  }

  private async buildFinalizedPlayerRatingUpdates(
    groupId: string,
    match: PrismaMatch,
    generation: PrismaTeamGenerationVersion,
  ): Promise<FinalizedPlayerRatingUpdate[]> {
    const teamPlayers = getLockedGenerationPlayers(generation);
    const playerIds = teamPlayers.map((player) => player.playerId);
    const [
      matchEvents,
      mvpVotes,
      opponentRatings,
      ratingStates,
      initialRatings,
    ] = await Promise.all([
      this.prisma.matchEvent.findMany({
        where: {
          matchId: match.id,
          playerId: {
            in: playerIds,
          },
        },
      }),
      this.prisma.matchMvpVote.findMany({
        where: {
          matchId: match.id,
        },
      }),
      this.prisma.matchOpponentRating.findMany({
        where: {
          matchId: match.id,
          ratedPlayerId: {
            in: playerIds,
          },
        },
      }),
      this.prisma.playerRatingState.findMany({
        where: {
          playerId: {
            in: playerIds,
          },
        },
      }),
      this.getGenerationPlayerRatings(groupId, playerIds),
    ]);
    const initialRatingByPlayerId = new Map(
      initialRatings.map((rating) => [rating.playerId, rating]),
    );
    const ratingStateByPlayerId = new Map(
      ratingStates.map((state) => [state.playerId, state]),
    );
    const goalsByPlayerId = getEventCountsByPlayer(matchEvents, 'goal');
    const assistsByPlayerId = getEventCountsByPlayer(matchEvents, 'assist');
    const mvpVotesByPlayerId = getMvpVotesByPlayer(mvpVotes);
    const maxMvpVotes = Math.max(0, ...mvpVotesByPlayerId.values());
    const opponentRatingsByPlayerId =
      getOpponentRatingsByPlayer(opponentRatings);

    return teamPlayers.map((player) => {
      const initialRating = initialRatingByPlayerId.get(player.playerId);
      const ratingState = ratingStateByPlayerId.get(player.playerId);
      const baselineRating =
        initialRating && initialRating.ratingsReceived > 0
          ? initialRating.rating
          : null;
      const overallBefore = getCurrentOverallRating(
        ratingState,
        baselineRating,
        player.generationRating,
      );
      const formBefore = getCurrentFormRating(ratingState, overallBefore);
      const goals = goalsByPlayerId.get(player.playerId) ?? 0;
      const assists = assistsByPlayerId.get(player.playerId) ?? 0;
      const playerMvpVotes = mvpVotesByPlayerId.get(player.playerId) ?? 0;
      const mvpAwarded = maxMvpVotes > 0 && playerMvpVotes === maxMvpVotes;
      const result = getPlayerMatchResult(match, player.teamLabel);
      const opponentRatingSignal = getOpponentRatingSignal(
        opponentRatingsByPlayerId.get(player.playerId) ?? [],
      );
      const performanceScore = getPerformanceScore({
        assists,
        baselineRating,
        formBefore,
        generationRating: player.generationRating,
        goals,
        mvpAwarded,
        mvpVotes: playerMvpVotes,
        opponentAverageRating: opponentRatingSignal.average,
        overallBefore,
        result,
      });
      const overallAfter = evolveRating(
        overallBefore,
        performanceScore,
        OVERALL_RATING_EVOLUTION_WEIGHT,
      );
      const formAfter = evolveRating(
        formBefore,
        performanceScore,
        FORM_RATING_EVOLUTION_WEIGHT,
      );

      return {
        playerId: player.playerId,
        teamLabel: player.teamLabel,
        result,
        goals,
        assists,
        mvpVotes: playerMvpVotes,
        mvpAwarded,
        opponentAverageRating: opponentRatingSignal.average,
        performanceScore,
        overallBefore,
        overallAfter,
        formBefore,
        formAfter,
        overallDelta: roundToOneDecimal(overallAfter - overallBefore),
        formDelta: roundToOneDecimal(formAfter - formBefore),
        initialRating: baselineRating,
        ignoredExtremeRatings: opponentRatingSignal.ignoredExtremeRatings,
        rawOpponentRatings: opponentRatingSignal.rawRatings,
      };
    });
  }

  private buildRatingHistoryReason(
    update: FinalizedPlayerRatingUpdate,
    match: PrismaMatch,
  ) {
    return {
      algorithmVersion: 'rating-evolution-v1',
      result: update.result,
      teamLabel: update.teamLabel,
      score: {
        teamA: match.teamAScore,
        teamB: match.teamBScore,
      },
      performanceScore: update.performanceScore,
      goals: update.goals,
      assists: update.assists,
      mvpVotes: update.mvpVotes,
      mvpAwarded: update.mvpAwarded,
      initialRating: update.initialRating,
      opponentRatings: {
        average: update.opponentAverageRating,
        rawCount: update.rawOpponentRatings.length,
        ignoredExtremeRatings: update.ignoredExtremeRatings,
        rawRatings: update.rawOpponentRatings,
      },
      antiAbuse: {
        method: 'median-distance-filter',
        threshold: EXTREME_OPPONENT_RATING_DISTANCE,
      },
      weights: {
        overall: OVERALL_RATING_EVOLUTION_WEIGHT,
        form: FORM_RATING_EVOLUTION_WEIGHT,
      },
    };
  }

  private async buildPlayerRatingStateRecomputeOperations(
    playerIds: string[],
    voidedMatchId: string,
  ) {
    const operations: Prisma.PrismaPromise<unknown>[] = [];

    for (const playerId of playerIds) {
      const [earliestHistory, activeStats] = await Promise.all([
        this.prisma.playerRatingHistory.findFirst({
          where: {
            playerId,
          },
          orderBy: [
            {
              createdAt: 'asc',
            },
            {
              id: 'asc',
            },
          ],
        }),
        this.prisma.matchPlayerStat.findMany({
          where: {
            playerId,
            matchId: {
              not: voidedMatchId,
            },
            voidedAt: null,
            match: {
              status: 'completed',
              voidedAt: null,
            },
          },
          orderBy: [
            {
              createdAt: 'asc',
            },
            {
              id: 'asc',
            },
          ],
        }),
      ]);
      const recomputed = this.recomputePlayerRatingState(
        playerId,
        earliestHistory,
        activeStats,
      );

      operations.push(...recomputed.historyOperations);
      operations.push(
        this.prisma.playerRatingState.upsert({
          where: {
            playerId,
          },
          create: recomputed.ratingStateCreateData,
          update: recomputed.ratingStateUpdateData,
        }),
      );
    }

    return operations;
  }

  private recomputePlayerRatingState(
    playerId: string,
    earliestHistory: PrismaPlayerRatingHistory | null,
    activeStats: PrismaMatchPlayerStat[],
  ) {
    let currentOverall = roundToOneDecimal(
      earliestHistory?.overallBefore ?? DEFAULT_PLAYER_RATING,
    );
    let currentForm = roundToOneDecimal(
      earliestHistory?.formBefore ?? currentOverall,
    );
    const totals = {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      goals: 0,
      assists: 0,
      mvpAwards: 0,
      mvpVotes: 0,
    };
    const historyOperations: Prisma.PrismaPromise<unknown>[] = [];

    for (const stat of activeStats) {
      const overallBefore = currentOverall;
      const formBefore = currentForm;
      const overallAfter = evolveRating(
        overallBefore,
        stat.performanceScore,
        OVERALL_RATING_EVOLUTION_WEIGHT,
      );
      const formAfter = evolveRating(
        formBefore,
        stat.performanceScore,
        FORM_RATING_EVOLUTION_WEIGHT,
      );

      totals.gamesPlayed += 1;
      totals.wins += stat.result === 'win' ? 1 : 0;
      totals.losses += stat.result === 'loss' ? 1 : 0;
      totals.draws += stat.result === 'draw' ? 1 : 0;
      totals.goals += stat.goals;
      totals.assists += stat.assists;
      totals.mvpAwards += stat.mvpAwarded ? 1 : 0;
      totals.mvpVotes += stat.mvpVotes;
      historyOperations.push(
        this.prisma.matchPlayerStat.update({
          where: {
            id: stat.id,
          },
          data: {
            overallBefore,
            overallAfter,
            formBefore,
            formAfter,
          },
        }),
        this.prisma.playerRatingHistory.update({
          where: {
            matchId_playerId: {
              matchId: stat.matchId,
              playerId,
            },
          },
          data: {
            overallBefore,
            overallAfter,
            formBefore,
            formAfter,
            overallDelta: roundToOneDecimal(overallAfter - overallBefore),
            formDelta: roundToOneDecimal(formAfter - formBefore),
            voidedAt: null,
          },
        }),
      );
      currentOverall = overallAfter;
      currentForm = formAfter;
    }

    return {
      historyOperations,
      ratingStateCreateData: {
        playerId,
        overallRating: currentOverall,
        formRating: currentForm,
        ...totals,
      },
      ratingStateUpdateData: {
        overallRating: currentOverall,
        formRating: currentForm,
        ...totals,
      },
    };
  }

  private async toInternalMatch(
    match: PrismaMatch,
    currentPlayerId?: string,
  ): Promise<InternalFootballMatch> {
    const [
      confirmedCount,
      waitlistCount,
      myAttendance,
      events,
      mvpVotes,
      opponentRatingCompletion,
    ] = await Promise.all([
      this.prisma.matchAttendance.count({
        where: {
          matchId: match.id,
          status: 'confirmed',
        },
      }),
      this.prisma.matchAttendance.count({
        where: {
          matchId: match.id,
          status: 'waitlisted',
        },
      }),
      currentPlayerId
        ? this.prisma.matchAttendance.findUnique({
            where: {
              matchId_playerId: {
                matchId: match.id,
                playerId: currentPlayerId,
              },
            },
          })
        : null,
      this.prisma.matchEvent.findMany({
        where: {
          matchId: match.id,
        },
        orderBy: [
          {
            kind: 'asc',
          },
          {
            count: 'desc',
          },
          {
            updatedAt: 'asc',
          },
        ],
      }),
      this.prisma.matchMvpVote.findMany({
        where: {
          matchId: match.id,
        },
        orderBy: [
          {
            createdAt: 'asc',
          },
          {
            id: 'asc',
          },
        ],
      }),
      currentPlayerId
        ? this.prisma.matchOpponentRatingCompletion.findUnique({
            where: {
              matchId_playerId: {
                matchId: match.id,
                playerId: currentPlayerId,
              },
            },
          })
        : null,
    ]);
    const attendances = await this.prisma.matchAttendance.findMany({
      where: {
        matchId: match.id,
      },
      orderBy: [
        {
          respondedAt: 'asc',
        },
        {
          createdAt: 'asc',
        },
      ],
    });
    const internalMvpVotes = mvpVotes.map((vote) =>
      this.toInternalMvpVote(vote),
    );

    return {
      id: match.id,
      groupId: match.groupId,
      organizerUserId: match.organizerUserId,
      title: match.title,
      startsAt: match.startsAt,
      location: match.location,
      playersPerTeam: match.playersPerTeam,
      maxPlayers: match.maxPlayers,
      attendanceDeadlineAt: match.attendanceDeadlineAt,
      generatorStyleOverride: normalizeGeneratorStyleOverride(
        match.generatorStyleOverride,
      ),
      goalkeeperModeOverride: normalizeGoalkeeperModeOverride(
        match.goalkeeperModeOverride,
      ),
      status: normalizeMatchStatus(match.status),
      confirmedCount,
      waitlistCount,
      score:
        match.teamAScore !== null &&
        match.teamBScore !== null &&
        match.scoreSubmittedByUserId &&
        match.scoreSubmittedAt
          ? {
              teamAScore: match.teamAScore,
              teamBScore: match.teamBScore,
              submittedByUserId: match.scoreSubmittedByUserId,
              submittedAt: match.scoreSubmittedAt,
            }
          : null,
      finalization:
        match.finalizedByUserId && match.finalizedAt
          ? {
              finalizedByUserId: match.finalizedByUserId,
              finalizedAt: match.finalizedAt,
            }
          : null,
      voiding:
        match.voidedByUserId && match.voidedAt
          ? {
              voidedByUserId: match.voidedByUserId,
              voidedAt: match.voidedAt,
            }
          : null,
      events: events.map((event) => this.toInternalMatchEvent(event)),
      mvpVotes: internalMvpVotes,
      myMvpVote: currentPlayerId
        ? (internalMvpVotes.find(
            (vote) => vote.voterPlayerId === currentPlayerId,
          ) ?? null)
        : null,
      myOpponentRatingCompletion: opponentRatingCompletion
        ? this.toInternalOpponentRatingCompletion(opponentRatingCompletion)
        : null,
      attendances: attendances.map((attendance) =>
        this.toInternalAttendance(attendance),
      ),
      myAttendance: myAttendance
        ? this.toInternalAttendance(myAttendance)
        : null,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
    };
  }

  private toInternalAttendance(
    attendance: PrismaMatchAttendance,
  ): InternalFootballMatchAttendance {
    return {
      id: attendance.id,
      matchId: attendance.matchId,
      playerId: attendance.playerId,
      response: normalizeAttendanceResponse(attendance.response),
      status: normalizeAttendanceStatus(attendance.status),
      waitlistPosition: attendance.waitlistPosition,
      respondedAt: attendance.respondedAt,
      createdAt: attendance.createdAt,
      updatedAt: attendance.updatedAt,
    };
  }

  private toInternalMatchEvent(
    event: PrismaMatchEvent,
  ): InternalFootballMatchEvent {
    return {
      id: event.id,
      matchId: event.matchId,
      playerId: event.playerId,
      kind: event.kind === 'assist' ? 'assist' : 'goal',
      count: event.count,
      recordedByUserId: event.recordedByUserId,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  private toInternalMvpVote(
    vote: PrismaMatchMvpVote,
  ): InternalFootballMatchMvpVote {
    return {
      id: vote.id,
      matchId: vote.matchId,
      voterPlayerId: vote.voterPlayerId,
      votedPlayerId: vote.votedPlayerId,
      createdAt: vote.createdAt,
      updatedAt: vote.updatedAt,
    };
  }

  private toInternalOpponentRating(
    rating: PrismaMatchOpponentRating,
  ): InternalFootballMatchOpponentRating {
    return {
      id: rating.id,
      matchId: rating.matchId,
      raterPlayerId: rating.raterPlayerId,
      ratedPlayerId: rating.ratedPlayerId,
      rating: rating.rating,
      tags: rating.tags.filter(isSupportedOpponentRatingTag),
      createdAt: rating.createdAt,
      updatedAt: rating.updatedAt,
    };
  }

  private toInternalOpponentRatingCompletion(
    completion: PrismaMatchOpponentRatingCompletion,
  ): InternalFootballMatchOpponentRatingCompletion {
    return {
      id: completion.id,
      matchId: completion.matchId,
      playerId: completion.playerId,
      status: completion.status === 'submitted' ? 'submitted' : 'skipped',
      createdAt: completion.createdAt,
      updatedAt: completion.updatedAt,
    };
  }

  private toInternalTeamGenerationVersion(
    generation: PrismaTeamGenerationVersion,
  ): InternalTeamGenerationVersion {
    return {
      id: generation.id,
      matchId: generation.matchId,
      generatedByUserId: generation.generatedByUserId,
      versionNumber: generation.versionNumber,
      seed: generation.seed,
      algorithmVersion: generation.algorithmVersion,
      status: generation.status === 'locked' ? 'locked' : 'draft',
      teamA: generation.teamA as unknown as TeamGenerationTeam,
      teamB: generation.teamB as unknown as TeamGenerationTeam,
      teamATotal: generation.teamATotal,
      teamBTotal: generation.teamBTotal,
      fairnessPercentage: generation.fairnessPercentage,
      inputSnapshot:
        generation.inputSnapshot as unknown as TeamGenerationInputSnapshot,
      scoreComponents:
        generation.scoreComponents as unknown as TeamGenerationScoreComponents,
      explanation:
        generation.explanation as unknown as TeamGenerationExplanation,
      manualAdjustment:
        (generation.manualAdjustment as unknown as TeamManualAdjustment | null) ??
        null,
      createdAt: generation.createdAt,
      updatedAt: generation.updatedAt,
    };
  }
}

function getLockedGenerationPlayers(
  generation: PrismaTeamGenerationVersion,
): FinalizationTeamPlayer[] {
  const teamA = generation.teamA as unknown as TeamGenerationTeam;
  const teamB = generation.teamB as unknown as TeamGenerationTeam;

  return [
    ...teamA.players.map((player) => ({
      playerId: player.playerId,
      teamLabel: 'A' as const,
      generationRating: player.rating,
    })),
    ...teamB.players.map((player) => ({
      playerId: player.playerId,
      teamLabel: 'B' as const,
      generationRating: player.rating,
    })),
  ];
}

function getEventCountsByPlayer(
  events: PrismaMatchEvent[],
  kind: InternalFootballMatchEvent['kind'],
) {
  return events.reduce((counts, event) => {
    if (event.kind !== kind) {
      return counts;
    }

    counts.set(event.playerId, (counts.get(event.playerId) ?? 0) + event.count);

    return counts;
  }, new Map<string, number>());
}

function getMvpVotesByPlayer(votes: PrismaMatchMvpVote[]) {
  return votes.reduce((counts, vote) => {
    counts.set(vote.votedPlayerId, (counts.get(vote.votedPlayerId) ?? 0) + 1);

    return counts;
  }, new Map<string, number>());
}

function getOpponentRatingsByPlayer(ratings: PrismaMatchOpponentRating[]) {
  return ratings.reduce((ratingsByPlayerId, rating) => {
    const currentRatings = ratingsByPlayerId.get(rating.ratedPlayerId) ?? [];
    currentRatings.push(rating.rating);
    ratingsByPlayerId.set(rating.ratedPlayerId, currentRatings);

    return ratingsByPlayerId;
  }, new Map<string, number[]>());
}

function getOpponentRatingSignal(ratings: number[]): OpponentRatingSignal {
  if (ratings.length === 0) {
    return {
      average: null,
      rawRatings: [],
      ignoredExtremeRatings: 0,
    };
  }

  const median = getMedian(ratings);
  const filteredRatings = ratings.filter(
    (rating) => Math.abs(rating - median) <= EXTREME_OPPONENT_RATING_DISTANCE,
  );
  const effectiveRatings =
    filteredRatings.length > 0 ? filteredRatings : [median];
  const ignoredExtremeRatings =
    filteredRatings.length > 0
      ? ratings.length - filteredRatings.length
      : ratings.length;

  return {
    average: roundToOneDecimal(getAverage(effectiveRatings)),
    rawRatings: ratings,
    ignoredExtremeRatings,
  };
}

function getCurrentOverallRating(
  ratingState: PrismaPlayerRatingState | undefined,
  baselineRating: number | null,
  generationRating: number,
) {
  return roundToOneDecimal(
    ratingState?.overallRating ??
      baselineRating ??
      generationRating ??
      DEFAULT_PLAYER_RATING,
  );
}

function getCurrentFormRating(
  ratingState: PrismaPlayerRatingState | undefined,
  overallBefore: number,
) {
  return roundToOneDecimal(ratingState?.formRating ?? overallBefore);
}

function getPlayerMatchResult(
  match: PrismaMatch,
  teamLabel: FinalizationTeamPlayer['teamLabel'],
): FinalizedPlayerRatingUpdate['result'] {
  const teamAScore = match.teamAScore ?? 0;
  const teamBScore = match.teamBScore ?? 0;

  if (teamAScore === teamBScore) {
    return 'draw';
  }

  const teamAWon = teamAScore > teamBScore;

  if (teamLabel === 'A') {
    return teamAWon ? 'win' : 'loss';
  }

  return teamAWon ? 'loss' : 'win';
}

function getPerformanceScore({
  assists,
  baselineRating,
  formBefore,
  generationRating,
  goals,
  mvpAwarded,
  mvpVotes,
  opponentAverageRating,
  overallBefore,
  result,
}: {
  assists: number;
  baselineRating: number | null;
  formBefore: number;
  generationRating: number;
  goals: number;
  mvpAwarded: boolean;
  mvpVotes: number;
  opponentAverageRating: number | null;
  overallBefore: number;
  result: FinalizedPlayerRatingUpdate['result'];
}) {
  const ratingSignal =
    opponentAverageRating ?? baselineRating ?? generationRating;
  const blendedMatchSignal =
    ratingSignal * 0.55 + overallBefore * 0.3 + formBefore * 0.15;
  const score =
    blendedMatchSignal +
    getResultAdjustment(result) +
    goals * 3 +
    assists * 2 +
    Math.min(mvpVotes, 5) * 1.2 +
    (mvpAwarded ? 4 : 0);

  return roundToOneDecimal(clampRating(score));
}

function getResultAdjustment(result: FinalizedPlayerRatingUpdate['result']) {
  if (result === 'win') {
    return 3;
  }

  if (result === 'loss') {
    return -2;
  }

  return 0;
}

function evolveRating(
  currentRating: number,
  performanceScore: number,
  weight: number,
) {
  return roundToOneDecimal(
    clampRating(currentRating + (performanceScore - currentRating) * weight),
  );
}

function getMedian(values: number[]) {
  const sortedValues = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sortedValues.length / 2);

  if (sortedValues.length % 2 === 0) {
    return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2;
  }

  return sortedValues[middleIndex];
}

function getAverage(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function clampRating(value: number) {
  return Math.max(0, Math.min(100, value));
}

function swapTeamPlayers(
  teamA: TeamGenerationTeam,
  teamB: TeamGenerationTeam,
  teamAPlayerId: string,
  teamBPlayerId: string,
) {
  const teamAPlayerIndex = teamA.players.findIndex(
    (player) => player.playerId === teamAPlayerId,
  );
  const teamBPlayerIndex = teamB.players.findIndex(
    (player) => player.playerId === teamBPlayerId,
  );

  if (teamAPlayerIndex < 0 || teamBPlayerIndex < 0) {
    throw new ConflictException(
      'Manual swap requires one player from each team.',
    );
  }

  const nextTeamAPlayers = [...teamA.players];
  const nextTeamBPlayers = [...teamB.players];
  const teamAPlayer = nextTeamAPlayers[teamAPlayerIndex];
  const teamBPlayer = nextTeamBPlayers[teamBPlayerIndex];

  nextTeamAPlayers[teamAPlayerIndex] = teamBPlayer;
  nextTeamBPlayers[teamBPlayerIndex] = teamAPlayer;

  return {
    teamA: buildAdjustedTeam('A', nextTeamAPlayers),
    teamB: buildAdjustedTeam('B', nextTeamBPlayers),
  };
}

function getLockedGenerationPlayerIds(generation: PrismaTeamGenerationVersion) {
  return getLockedGenerationTeamContext(generation).allPlayerIds;
}

function getLockedGenerationTeamContext(
  generation: PrismaTeamGenerationVersion,
) {
  const teamA = generation.teamA as unknown as TeamGenerationTeam;
  const teamB = generation.teamB as unknown as TeamGenerationTeam;
  const teamAPlayerIds = new Set(
    teamA.players.map((player) => player.playerId),
  );
  const teamBPlayerIds = new Set(
    teamB.players.map((player) => player.playerId),
  );

  return {
    teamAPlayerIds,
    teamBPlayerIds,
    allPlayerIds: new Set([...teamAPlayerIds, ...teamBPlayerIds]),
  };
}

function getOpponentPlayerIds(
  context: ReturnType<typeof getLockedGenerationTeamContext>,
  playerId: string,
) {
  if (context.teamAPlayerIds.has(playerId)) {
    return context.teamBPlayerIds;
  }

  if (context.teamBPlayerIds.has(playerId)) {
    return context.teamAPlayerIds;
  }

  return null;
}

function buildAdjustedTeam(
  label: TeamGenerationTeam['label'],
  players: TeamGenerationPlayer[],
): TeamGenerationTeam {
  const normalizedPlayers = players.map((player, index) => ({
    ...player,
    slot: index + 1,
  }));

  return {
    label,
    players: normalizedPlayers,
    totalRating: getTeamTotalRating(normalizedPlayers),
    averageRating: getTeamAverageRating(normalizedPlayers),
  };
}

function scoreAdjustedTeams(
  teamA: TeamGenerationTeam,
  teamB: TeamGenerationTeam,
  inputSnapshot: TeamGenerationInputSnapshot,
): TeamGenerationScoreComponents {
  const weights = MANUAL_ADJUSTMENT_SCORE_WEIGHTS[inputSnapshot.generatorStyle];
  const ratingGap = roundToOneDecimal(
    Math.abs(teamA.averageRating - teamB.averageRating),
  );
  const positionImbalance = getPositionImbalance(teamA.players, teamB.players);
  const goalkeeperImbalance = getGoalkeeperImbalance(
    teamA.players,
    teamB.players,
    inputSnapshot.goalkeeperMode,
  );

  return {
    ratingGap,
    positionImbalance,
    goalkeeperImbalance,
    randomness: 0,
    candidateScore: roundToThreeDecimals(
      ratingGap * weights.rating +
        positionImbalance * weights.position +
        goalkeeperImbalance * weights.goalkeeper,
    ),
  };
}

function getFairnessPercentage(scoreComponents: TeamGenerationScoreComponents) {
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          scoreComponents.ratingGap * 5 -
          scoreComponents.positionImbalance * 1.5 -
          scoreComponents.goalkeeperImbalance * 5,
      ),
    ),
  );
}

function getTeamTotalRating(players: TeamGenerationPlayer[]) {
  return roundToOneDecimal(
    players.reduce((total, player) => total + player.rating, 0),
  );
}

function getTeamAverageRating(players: TeamGenerationPlayer[]) {
  return roundToOneDecimal(getTeamTotalRating(players) / players.length);
}

function getPositionImbalance(
  teamA: TeamGenerationPlayer[],
  teamB: TeamGenerationPlayer[],
) {
  const styles = new Set([
    ...teamA.map((player) => player.preferredStyle ?? 'all_rounder'),
    ...teamB.map((player) => player.preferredStyle ?? 'all_rounder'),
  ]);

  return [...styles].reduce((imbalance, style) => {
    return (
      imbalance + Math.abs(countStyle(teamA, style) - countStyle(teamB, style))
    );
  }, 0);
}

function getGoalkeeperImbalance(
  teamA: TeamGenerationPlayer[],
  teamB: TeamGenerationPlayer[],
  goalkeeperMode: GroupGoalkeeperMode,
) {
  if (goalkeeperMode === 'no_goalkeeper') {
    return 0;
  }

  return Math.abs(
    countStyle(teamA, 'goalkeeper') - countStyle(teamB, 'goalkeeper'),
  );
}

function countStyle(players: TeamGenerationPlayer[], style: string) {
  return players.filter(
    (player) => (player.preferredStyle ?? 'all_rounder') === style,
  ).length;
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10;
}

function roundToThreeDecimals(value: number) {
  return Math.round(value * 1000) / 1000;
}
