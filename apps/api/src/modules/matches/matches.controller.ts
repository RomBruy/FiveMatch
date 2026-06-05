import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  ConfirmTeamGenerationResponse,
  CreateFootballMatchInput,
  CreateFootballMatchResponse,
  GenerateTeamVersionResponse,
  LatestTeamGenerationResponse,
  ManualTeamAdjustmentInput,
  ManualTeamAdjustmentResponse,
  NextFootballMatchResponse,
  SkipOpponentRatingsResponse,
  SubmitFinalScoreInput,
  SubmitFinalScoreResponse,
  SubmitMatchAttendanceInput,
  SubmitMatchAttendanceResponse,
  SubmitMvpVoteInput,
  SubmitMvpVoteResponse,
  SubmitOpponentRatingsInput,
  SubmitOpponentRatingsResponse,
  TeamGenerationVersionsResponse,
  UpsertMatchPlayerEventsInput,
  UpsertMatchPlayerEventsResponse,
} from '@fit-five/shared';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  isSupportedGroupGeneratorStyle,
  isSupportedGroupGoalkeeperMode,
} from '../groups/group-options';
import {
  isSupportedAttendanceResponse,
  isSupportedOpponentRatingTag,
} from './match-options';
import {
  serializeFootballMatch,
  serializeMvpVote,
  serializeOpponentRating,
  serializeOpponentRatingCompletion,
  serializeTeamGenerationVersion,
} from './match.presenter';
import {
  MatchesService,
  TEAM_GENERATION_VERSION_LIMIT,
} from './matches.service';

@Controller('groups/:groupId/matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post()
  @UseGuards(ClerkAuthGuard)
  async createMatch(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Body() body: Partial<CreateFootballMatchInput>,
  ): Promise<CreateFootballMatchResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const match = await this.matchesService.createMatch(
      request.auth.clerkUserId,
      groupId,
      this.parseCreateMatchInput(body),
    );

    return {
      data: {
        match: serializeFootballMatch(match),
      },
    };
  }

  @Get('next')
  @UseGuards(ClerkAuthGuard)
  async getNextMatch(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
  ): Promise<NextFootballMatchResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const match = await this.matchesService.getNextMatch(
      request.auth.clerkUserId,
      groupId,
    );

    return {
      data: {
        match: match ? serializeFootballMatch(match) : null,
      },
    };
  }

  @Post(':matchId/attendance/me')
  @UseGuards(ClerkAuthGuard)
  async submitAttendance(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Param('matchId') matchId: string,
    @Body() body: Partial<SubmitMatchAttendanceInput>,
  ): Promise<SubmitMatchAttendanceResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    if (!isSupportedAttendanceResponse(body.response)) {
      throw new BadRequestException('Attendance response is invalid.');
    }

    const match = await this.matchesService.submitAttendance(
      request.auth.clerkUserId,
      groupId,
      matchId,
      {
        response: body.response,
      },
    );

    return {
      data: {
        match: serializeFootballMatch(match),
      },
    };
  }

  @Put(':matchId/final-score')
  @UseGuards(ClerkAuthGuard)
  async submitFinalScore(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Param('matchId') matchId: string,
    @Body() body: Partial<SubmitFinalScoreInput>,
  ): Promise<SubmitFinalScoreResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const match = await this.matchesService.submitFinalScore(
      request.auth.clerkUserId,
      groupId,
      matchId,
      this.parseSubmitFinalScoreInput(body),
    );

    return {
      data: {
        match: serializeFootballMatch(match),
      },
    };
  }

  @Put(':matchId/events')
  @UseGuards(ClerkAuthGuard)
  async upsertMatchPlayerEvents(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Param('matchId') matchId: string,
    @Body() body: Partial<UpsertMatchPlayerEventsInput>,
  ): Promise<UpsertMatchPlayerEventsResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const match = await this.matchesService.upsertMatchPlayerEvents(
      request.auth.clerkUserId,
      groupId,
      matchId,
      this.parseUpsertMatchPlayerEventsInput(body),
    );

    return {
      data: {
        match: serializeFootballMatch(match),
      },
    };
  }

  @Post(':matchId/mvp-votes')
  @UseGuards(ClerkAuthGuard)
  async submitMvpVote(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Param('matchId') matchId: string,
    @Body() body: Partial<SubmitMvpVoteInput>,
  ): Promise<SubmitMvpVoteResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const result = await this.matchesService.submitMvpVote(
      request.auth.clerkUserId,
      groupId,
      matchId,
      this.parseSubmitMvpVoteInput(body),
    );

    return {
      data: {
        vote: serializeMvpVote(result.vote),
        match: serializeFootballMatch(result.match),
      },
    };
  }

  @Post(':matchId/opponent-ratings/skip')
  @UseGuards(ClerkAuthGuard)
  async skipOpponentRatings(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Param('matchId') matchId: string,
  ): Promise<SkipOpponentRatingsResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const result = await this.matchesService.skipOpponentRatings(
      request.auth.clerkUserId,
      groupId,
      matchId,
    );

    return {
      data: {
        completion: serializeOpponentRatingCompletion(result.completion),
        match: serializeFootballMatch(result.match),
      },
    };
  }

  @Post(':matchId/opponent-ratings')
  @UseGuards(ClerkAuthGuard)
  async submitOpponentRatings(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Param('matchId') matchId: string,
    @Body() body: Partial<SubmitOpponentRatingsInput>,
  ): Promise<SubmitOpponentRatingsResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const result = await this.matchesService.submitOpponentRatings(
      request.auth.clerkUserId,
      groupId,
      matchId,
      this.parseSubmitOpponentRatingsInput(body),
    );

    return {
      data: {
        ratings: result.ratings.map((rating) =>
          serializeOpponentRating(rating),
        ),
        completion: serializeOpponentRatingCompletion(result.completion),
        match: serializeFootballMatch(result.match),
      },
    };
  }

  @Post(':matchId/team-generations')
  @UseGuards(ClerkAuthGuard)
  async generateTeamVersion(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Param('matchId') matchId: string,
  ): Promise<GenerateTeamVersionResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const generation = await this.matchesService.generateTeamVersion(
      request.auth.clerkUserId,
      groupId,
      matchId,
    );

    return {
      data: {
        generation: serializeTeamGenerationVersion(generation),
      },
    };
  }

  @Get(':matchId/team-generations')
  @UseGuards(ClerkAuthGuard)
  async listTeamGenerations(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Param('matchId') matchId: string,
  ): Promise<TeamGenerationVersionsResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const generations = await this.matchesService.listTeamGenerations(
      request.auth.clerkUserId,
      groupId,
      matchId,
    );

    return {
      data: {
        generations: generations.map((generation) =>
          serializeTeamGenerationVersion(generation),
        ),
        limit: TEAM_GENERATION_VERSION_LIMIT,
        remaining: Math.max(
          TEAM_GENERATION_VERSION_LIMIT - generations.length,
          0,
        ),
      },
    };
  }

  @Get(':matchId/team-generations/latest')
  @UseGuards(ClerkAuthGuard)
  async getLatestTeamGeneration(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Param('matchId') matchId: string,
  ): Promise<LatestTeamGenerationResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const generation = await this.matchesService.getLatestTeamGeneration(
      request.auth.clerkUserId,
      groupId,
      matchId,
    );

    return {
      data: {
        generation: generation
          ? serializeTeamGenerationVersion(generation)
          : null,
      },
    };
  }

  @Patch(':matchId/team-generations/:generationId/manual-adjustment')
  @UseGuards(ClerkAuthGuard)
  async applyManualTeamAdjustment(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Param('matchId') matchId: string,
    @Param('generationId') generationId: string,
    @Body() body: Partial<ManualTeamAdjustmentInput>,
  ): Promise<ManualTeamAdjustmentResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const generation = await this.matchesService.applyManualTeamAdjustment(
      request.auth.clerkUserId,
      groupId,
      matchId,
      generationId,
      this.parseManualTeamAdjustmentInput(body),
    );

    return {
      data: {
        generation: serializeTeamGenerationVersion(generation),
      },
    };
  }

  @Patch(':matchId/team-generations/:generationId/confirm')
  @UseGuards(ClerkAuthGuard)
  async confirmTeamGeneration(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Param('matchId') matchId: string,
    @Param('generationId') generationId: string,
  ): Promise<ConfirmTeamGenerationResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const result = await this.matchesService.confirmTeamGeneration(
      request.auth.clerkUserId,
      groupId,
      matchId,
      generationId,
    );

    return {
      data: {
        match: serializeFootballMatch(result.match),
        generation: serializeTeamGenerationVersion(result.generation),
      },
    };
  }

  private parseCreateMatchInput(
    body: Partial<CreateFootballMatchInput>,
  ): CreateFootballMatchInput {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const location =
      typeof body.location === 'string' ? body.location.trim() : '';
    const startsAt = parseDate(body.startsAt, 'startsAt');
    const attendanceDeadlineAt = parseDate(
      body.attendanceDeadlineAt,
      'attendanceDeadlineAt',
    );
    const playersPerTeam = body.playersPerTeam;

    if (title.length < 2 || title.length > 80) {
      throw new BadRequestException(
        'Match title must be between 2 and 80 chars.',
      );
    }

    if (location.length < 2 || location.length > 160) {
      throw new BadRequestException(
        'Match location must be between 2 and 160 chars.',
      );
    }

    if (
      playersPerTeam === undefined ||
      !Number.isInteger(playersPerTeam) ||
      playersPerTeam < 4 ||
      playersPerTeam > 11
    ) {
      throw new BadRequestException(
        'Players per team must be an integer between 4 and 11.',
      );
    }

    if (attendanceDeadlineAt >= startsAt) {
      throw new BadRequestException(
        'Attendance deadline must be before match start.',
      );
    }

    return {
      title,
      startsAt: startsAt.toISOString(),
      location,
      playersPerTeam,
      attendanceDeadlineAt: attendanceDeadlineAt.toISOString(),
      generatorStyleOverride: isSupportedGroupGeneratorStyle(
        body.generatorStyleOverride,
      )
        ? body.generatorStyleOverride
        : null,
      goalkeeperModeOverride: isSupportedGroupGoalkeeperMode(
        body.goalkeeperModeOverride,
      )
        ? body.goalkeeperModeOverride
        : null,
    };
  }

  private parseManualTeamAdjustmentInput(
    body: Partial<ManualTeamAdjustmentInput>,
  ): ManualTeamAdjustmentInput {
    const teamAPlayerId =
      typeof body.teamAPlayerId === 'string' ? body.teamAPlayerId.trim() : '';
    const teamBPlayerId =
      typeof body.teamBPlayerId === 'string' ? body.teamBPlayerId.trim() : '';

    if (!teamAPlayerId || !teamBPlayerId) {
      throw new BadRequestException('Manual adjustment player ids required.');
    }

    if (teamAPlayerId === teamBPlayerId) {
      throw new BadRequestException('Manual adjustment needs two players.');
    }

    return {
      teamAPlayerId,
      teamBPlayerId,
    };
  }

  private parseSubmitFinalScoreInput(
    body: Partial<SubmitFinalScoreInput>,
  ): SubmitFinalScoreInput {
    const teamAScore = body.teamAScore;
    const teamBScore = body.teamBScore;

    if (
      teamAScore === undefined ||
      teamBScore === undefined ||
      !Number.isInteger(teamAScore) ||
      !Number.isInteger(teamBScore) ||
      teamAScore < 0 ||
      teamBScore < 0 ||
      teamAScore > 99 ||
      teamBScore > 99
    ) {
      throw new BadRequestException(
        'Final score values must be integers between 0 and 99.',
      );
    }

    return {
      teamAScore,
      teamBScore,
    };
  }

  private parseUpsertMatchPlayerEventsInput(
    body: Partial<UpsertMatchPlayerEventsInput>,
  ): UpsertMatchPlayerEventsInput {
    if (!Array.isArray(body.players)) {
      throw new BadRequestException('Match event player rows required.');
    }

    return {
      players: body.players.map((player) => {
        const playerId =
          typeof player.playerId === 'string' ? player.playerId.trim() : '';
        const goals = player.goals;
        const assists = player.assists;

        if (
          !playerId ||
          !Number.isInteger(goals) ||
          !Number.isInteger(assists) ||
          goals < 0 ||
          assists < 0 ||
          goals > 99 ||
          assists > 99
        ) {
          throw new BadRequestException(
            'Match event rows need player id and 0-99 goal/assist counts.',
          );
        }

        return {
          playerId,
          goals,
          assists,
        };
      }),
    };
  }

  private parseSubmitMvpVoteInput(
    body: Partial<SubmitMvpVoteInput>,
  ): SubmitMvpVoteInput {
    const votedPlayerId =
      typeof body.votedPlayerId === 'string' ? body.votedPlayerId.trim() : '';

    if (!votedPlayerId) {
      throw new BadRequestException('MVP vote requires a player id.');
    }

    return {
      votedPlayerId,
    };
  }

  private parseSubmitOpponentRatingsInput(
    body: Partial<SubmitOpponentRatingsInput>,
  ): SubmitOpponentRatingsInput {
    if (!Array.isArray(body.ratings) || body.ratings.length === 0) {
      throw new BadRequestException('Opponent ratings are required.');
    }

    return {
      ratings: body.ratings.map((rating) => {
        const ratedPlayerId =
          typeof rating.ratedPlayerId === 'string'
            ? rating.ratedPlayerId.trim()
            : '';
        const tags = Array.isArray(rating.tags) ? rating.tags : [];

        if (
          !ratedPlayerId ||
          !Number.isInteger(rating.rating) ||
          rating.rating < 0 ||
          rating.rating > 100 ||
          tags.some((tag) => !isSupportedOpponentRatingTag(tag))
        ) {
          throw new BadRequestException(
            'Opponent ratings need player id, 0-100 rating, and supported tags.',
          );
        }

        return {
          ratedPlayerId,
          rating: rating.rating,
          tags: [...new Set(tags)],
        };
      }),
    };
  }
}

function parseDate(value: unknown, fieldName: string): Date {
  if (typeof value !== 'string') {
    throw new BadRequestException(`${fieldName} must be a valid date.`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${fieldName} must be a valid date.`);
  }

  return date;
}
