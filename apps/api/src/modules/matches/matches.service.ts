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
  SubmitMatchAttendanceInput,
  TeamGenerationExplanation,
  TeamGenerationInputSnapshot,
  TeamGenerationScoreComponents,
  TeamGenerationTeam,
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
} from './match-options';

const INITIAL_PEER_RATING_READINESS_THRESHOLD = 3;

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
  createdAt: Date;
  updatedAt: Date;
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
        status: 'open',
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
    const versionNumber =
      (await this.prisma.teamGenerationVersion.count({
        where: {
          matchId: match.id,
        },
      })) + 1;
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

  private async toInternalMatch(
    match: PrismaMatch,
    currentPlayerId?: string,
  ): Promise<InternalFootballMatch> {
    const [confirmedCount, waitlistCount, myAttendance] = await Promise.all([
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
      createdAt: generation.createdAt,
      updatedAt: generation.updatedAt,
    };
  }
}
