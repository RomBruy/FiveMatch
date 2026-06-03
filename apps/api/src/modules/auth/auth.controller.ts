import {
  Body,
  Controller,
  InternalServerErrorException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  CurrentUserResponse,
  SyncCurrentUserInput,
} from '@fit-five/shared';
import { serializeCurrentUser } from '../users/user.presenter';
import { UsersService } from '../users/users.service';
import { ClerkAuthGuard } from './clerk-auth.guard';
import type { AuthenticatedRequest } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly usersService: UsersService) {}

  @Post('sync')
  @UseGuards(ClerkAuthGuard)
  async syncCurrentUser(
    @Req() request: AuthenticatedRequest,
    @Body() body: SyncCurrentUserInput,
  ): Promise<CurrentUserResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const user = await this.usersService.syncFromAuth({
      clerkUserId: request.auth.clerkUserId,
      emailAddress: body.emailAddress,
      firstName: body.firstName,
      lastName: body.lastName,
      imageUrl: body.imageUrl,
      preferredLocale: body.preferredLocale,
    });

    return {
      data: {
        user: serializeCurrentUser(user),
      },
    };
  }
}
