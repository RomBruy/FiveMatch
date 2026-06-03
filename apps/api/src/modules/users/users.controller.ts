import {
  BadRequestException,
  Body,
  Controller,
  InternalServerErrorException,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  CurrentUserResponse,
  UpdateCurrentUserPreferencesInput,
} from '@fit-five/shared';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { serializeCurrentUser } from './user.presenter';
import { isSupportedPreferredLocale } from './user-preferences';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me/preferences')
  @UseGuards(ClerkAuthGuard)
  async updateCurrentUserPreferences(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateCurrentUserPreferencesInput,
  ): Promise<CurrentUserResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    if (!isSupportedPreferredLocale(body.preferredLocale)) {
      throw new BadRequestException('Unsupported locale.');
    }

    const user = await this.usersService.updatePreferences(
      request.auth.clerkUserId,
      body,
    );

    return {
      data: {
        user: serializeCurrentUser(user),
      },
    };
  }
}
