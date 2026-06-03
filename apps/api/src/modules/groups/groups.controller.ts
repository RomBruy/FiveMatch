import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type {
  CreateFootballGroupInvitationResponse,
  CreateFootballGroupInput,
  CreateFootballGroupResponse,
  FootballGroupMembersResponse,
  FootballGroupsResponse,
  RemoveFootballGroupMemberResponse,
  UpdateFootballGroupMemberRoleInput,
  UpdateFootballGroupMemberRoleResponse,
  UpdateFootballGroupSettingsInput,
  UpdateFootballGroupSettingsResponse,
} from '@fit-five/shared';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  isSupportedGroupGeneratorStyle,
  isSupportedGroupGoalkeeperMode,
  isSupportedGroupIntensity,
  isSupportedGroupLanguage,
  isSupportedGroupPlayStyle,
} from './group-options';
import {
  serializeFootballGroup,
  serializeFootballGroupInvitation,
  serializeFootballGroupMember,
} from './group.presenter';
import { GroupsService } from './groups.service';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  @UseGuards(ClerkAuthGuard)
  async listCurrentUserGroups(
    @Req() request: AuthenticatedRequest,
  ): Promise<FootballGroupsResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const groups = await this.groupsService.listForUser(
      request.auth.clerkUserId,
    );

    return {
      data: {
        groups: groups.map(serializeFootballGroup),
      },
    };
  }

  @Post()
  @UseGuards(ClerkAuthGuard)
  async createGroup(
    @Req() request: AuthenticatedRequest,
    @Body() body: Partial<CreateFootballGroupInput>,
  ): Promise<CreateFootballGroupResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const input = this.parseCreateGroupInput(body);
    const group = await this.groupsService.createForUser(
      request.auth.clerkUserId,
      input,
    );

    return {
      data: {
        group: serializeFootballGroup(group),
      },
    };
  }

  @Post(':groupId/invitations')
  @UseGuards(ClerkAuthGuard)
  async createInvitation(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
  ): Promise<CreateFootballGroupInvitationResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const invitation = await this.groupsService.createInvitation(
      request.auth.clerkUserId,
      groupId,
    );

    return {
      data: {
        invitation: serializeFootballGroupInvitation(invitation),
      },
    };
  }

  @Patch(':groupId/settings')
  @UseGuards(ClerkAuthGuard)
  async updateSettings(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Body() body: Partial<UpdateFootballGroupSettingsInput>,
  ): Promise<UpdateFootballGroupSettingsResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const input = this.parseUpdateSettingsInput(body);
    const group = await this.groupsService.updateSettings(
      request.auth.clerkUserId,
      groupId,
      input,
    );

    return {
      data: {
        group: serializeFootballGroup(group),
      },
    };
  }

  @Get(':groupId/members')
  @UseGuards(ClerkAuthGuard)
  async listMembers(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
  ): Promise<FootballGroupMembersResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const members = await this.groupsService.listMembers(
      request.auth.clerkUserId,
      groupId,
    );

    return {
      data: {
        members: members.map(serializeFootballGroupMember),
      },
    };
  }

  @Patch(':groupId/members/:memberId/role')
  @UseGuards(ClerkAuthGuard)
  async updateMemberRole(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @Body() body: Partial<UpdateFootballGroupMemberRoleInput>,
  ): Promise<UpdateFootballGroupMemberRoleResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const input = this.parseUpdateMemberRoleInput(body);
    const member = await this.groupsService.updateMemberRole(
      request.auth.clerkUserId,
      groupId,
      memberId,
      input,
    );

    return {
      data: {
        member: serializeFootballGroupMember(member),
      },
    };
  }

  @Delete(':groupId/members/:memberId')
  @UseGuards(ClerkAuthGuard)
  async removeMember(
    @Req() request: AuthenticatedRequest,
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
  ): Promise<RemoveFootballGroupMemberResponse> {
    if (!request.auth) {
      throw new InternalServerErrorException('Authenticated user missing.');
    }

    const removedMemberId = await this.groupsService.removeMember(
      request.auth.clerkUserId,
      groupId,
      memberId,
    );

    return {
      data: {
        removedMemberId,
      },
    };
  }

  private parseCreateGroupInput(
    body: Partial<CreateFootballGroupInput>,
  ): CreateFootballGroupInput {
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (name.length < 2 || name.length > 80) {
      throw new BadRequestException(
        'Group name must be between 2 and 80 chars.',
      );
    }

    if (!isSupportedGroupLanguage(body.defaultLanguage)) {
      throw new BadRequestException('Unsupported group language.');
    }

    if (!isSupportedGroupPlayStyle(body.playStyle)) {
      throw new BadRequestException('Unsupported group play style.');
    }

    if (!isSupportedGroupIntensity(body.intensity)) {
      throw new BadRequestException('Unsupported group intensity.');
    }

    if (!isSupportedGroupGoalkeeperMode(body.goalkeeperMode)) {
      throw new BadRequestException('Unsupported goalkeeper mode.');
    }

    if (!isSupportedGroupGeneratorStyle(body.generatorStyle)) {
      throw new BadRequestException('Unsupported generator style.');
    }

    return {
      name,
      defaultLanguage: body.defaultLanguage,
      playStyle: body.playStyle,
      intensity: body.intensity,
      goalkeeperMode: body.goalkeeperMode,
      generatorStyle: body.generatorStyle,
    };
  }

  private parseUpdateSettingsInput(
    body: Partial<UpdateFootballGroupSettingsInput>,
  ): UpdateFootballGroupSettingsInput {
    if (!isSupportedGroupPlayStyle(body.playStyle)) {
      throw new BadRequestException('Unsupported group play style.');
    }

    if (!isSupportedGroupIntensity(body.intensity)) {
      throw new BadRequestException('Unsupported group intensity.');
    }

    if (!isSupportedGroupGoalkeeperMode(body.goalkeeperMode)) {
      throw new BadRequestException('Unsupported goalkeeper mode.');
    }

    if (!isSupportedGroupGeneratorStyle(body.generatorStyle)) {
      throw new BadRequestException('Unsupported generator style.');
    }

    return {
      playStyle: body.playStyle,
      intensity: body.intensity,
      goalkeeperMode: body.goalkeeperMode,
      generatorStyle: body.generatorStyle,
    };
  }

  private parseUpdateMemberRoleInput(
    body: Partial<UpdateFootballGroupMemberRoleInput>,
  ): UpdateFootballGroupMemberRoleInput {
    if (body.role !== 'admin' && body.role !== 'member') {
      throw new BadRequestException('Unsupported member role.');
    }

    return {
      role: body.role,
    };
  }
}
