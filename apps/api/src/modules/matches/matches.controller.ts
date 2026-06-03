import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  CreateFootballMatchInput,
  CreateFootballMatchResponse,
  NextFootballMatchResponse,
} from '@fit-five/shared';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  isSupportedGroupGeneratorStyle,
  isSupportedGroupGoalkeeperMode,
} from '../groups/group-options';
import { serializeFootballMatch } from './match.presenter';
import { MatchesService } from './matches.service';

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
