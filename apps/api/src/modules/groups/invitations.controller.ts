import {
  Controller,
  InternalServerErrorException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AcceptFootballGroupInvitationResponse } from '@fit-five/shared';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  serializeFootballGroup,
  serializeFootballGroupInvitation,
} from './group.presenter';
import { GroupsService } from './groups.service';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post(':token/accept')
  @UseGuards(ClerkAuthGuard)
  async acceptInvitation(
    @Req() request: AuthenticatedRequest,
    @Param('token') token: string,
  ): Promise<AcceptFootballGroupInvitationResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const acceptedInvitation = await this.groupsService.acceptInvitation(
      request.auth.clerkUserId,
      token,
    );

    return {
      data: {
        invitation: serializeFootballGroupInvitation(
          acceptedInvitation.invitation,
        ),
        group: serializeFootballGroup(acceptedInvitation.group),
        nextAction: acceptedInvitation.nextAction,
      },
    };
  }
}
