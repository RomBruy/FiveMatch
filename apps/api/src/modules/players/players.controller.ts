import {
  BadRequestException,
  Body,
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  PlayerProfileResponse,
  PlayerRosterResponse,
  UpsertPlayerProfileInput,
  UpsertPlayerProfileResponse,
  UpsertPlayerVestiaireInput,
  UpsertPlayerVestiaireResponse,
} from '@fit-five/shared';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  isSupportedDominantFoot,
  isSupportedPreferredStyle,
} from './player-options';
import { serializePlayerProfile } from './player.presenter';
import { PlayersService } from './players.service';

@Controller('groups/:groupId/players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  @UseGuards(ClerkAuthGuard)
  async listGroupRoster(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
  ): Promise<PlayerRosterResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const players = await this.playersService.listGroupRoster(
      request.auth.clerkUserId,
      groupId,
    );

    return {
      data: {
        players: players.map(serializePlayerProfile),
      },
    };
  }

  @Get('me')
  @UseGuards(ClerkAuthGuard)
  async getMyProfile(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
  ): Promise<PlayerProfileResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const player = await this.playersService.getMyProfile(
      request.auth.clerkUserId,
      groupId,
    );

    return {
      data: {
        player: player ? serializePlayerProfile(player) : null,
      },
    };
  }

  @Put('me')
  @UseGuards(ClerkAuthGuard)
  async upsertMyProfile(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Body() body: UpsertPlayerProfileInput,
  ): Promise<UpsertPlayerProfileResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const input = this.parseUpsertProfileInput(body);
    const player = await this.playersService.upsertMyProfile(
      request.auth.clerkUserId,
      groupId,
      input,
    );

    return {
      data: {
        player: serializePlayerProfile(player),
      },
    };
  }

  @Put('me/vestiaire')
  @UseGuards(ClerkAuthGuard)
  async upsertMyVestiaire(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Body() body: UpsertPlayerVestiaireInput,
  ): Promise<UpsertPlayerVestiaireResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const input = this.parseUpsertVestiaireInput(body);
    const player = await this.playersService.upsertMyVestiaire(
      request.auth.clerkUserId,
      groupId,
      input,
    );

    return {
      data: {
        player: serializePlayerProfile(player),
      },
    };
  }

  private parseUpsertProfileInput(
    body: UpsertPlayerProfileInput,
  ): UpsertPlayerProfileInput {
    if (
      body.dominantFoot !== null &&
      body.dominantFoot !== undefined &&
      !isSupportedDominantFoot(body.dominantFoot)
    ) {
      throw new BadRequestException('Unsupported dominant foot.');
    }

    if (
      body.preferredStyle !== null &&
      body.preferredStyle !== undefined &&
      !isSupportedPreferredStyle(body.preferredStyle)
    ) {
      throw new BadRequestException('Unsupported preferred style.');
    }

    if (
      body.jerseyNumber !== null &&
      body.jerseyNumber !== undefined &&
      (!Number.isInteger(body.jerseyNumber) ||
        body.jerseyNumber < 0 ||
        body.jerseyNumber > 99)
    ) {
      throw new BadRequestException('Jersey number must be between 0 and 99.');
    }

    return {
      firstName: body.firstName,
      lastName: body.lastName,
      nickname: body.nickname,
      photoUrl: body.photoUrl,
      bio: body.bio,
      dominantFoot: body.dominantFoot ?? null,
      jerseyNumber: body.jerseyNumber ?? null,
      preferredStyle: body.preferredStyle ?? null,
      clubDeFormation: body.clubDeFormation,
    };
  }

  private parseUpsertVestiaireInput(
    body: UpsertPlayerVestiaireInput,
  ): UpsertPlayerVestiaireInput {
    if (
      body.badFaithLevel !== null &&
      body.badFaithLevel !== undefined &&
      (!Number.isInteger(body.badFaithLevel) ||
        body.badFaithLevel < 0 ||
        body.badFaithLevel > 100)
    ) {
      throw new BadRequestException(
        'Bad-faith level must be between 0 and 100.',
      );
    }

    return {
      specialty: body.specialty,
      favoriteExcuse: body.favoriteExcuse,
      badFaithLevel: body.badFaithLevel ?? null,
      lockerRoomStyle: body.lockerRoomStyle,
      thirdHalfProfile: body.thirdHalfProfile,
      warCry: body.warCry,
      signatureCelebration: body.signatureCelebration,
      worstOnPitchHabit: body.worstOnPitchHabit,
      legendaryPhrase: body.legendaryPhrase,
    };
  }
}
