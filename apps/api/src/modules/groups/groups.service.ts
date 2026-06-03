import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  Group,
  GroupMember,
  GroupSettings,
  Invitation,
  User,
} from '@prisma/client';
import type {
  CreateFootballGroupInput,
  FootballGroupInvitation,
  FootballGroupMember,
  FootballGroupSettings,
  GroupInviteAcceptNextAction,
  GroupMemberRole,
  UpdateFootballGroupMemberRoleInput,
  UpdateFootballGroupSettingsInput,
} from '@fit-five/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  canManageGroupMembers,
  canManageGroupInvitations,
  canUpdateGroupSettings,
  DEFAULT_GROUP_SETTINGS,
  normalizeGroupGeneratorStyle,
  normalizeGroupGoalkeeperMode,
  normalizeGroupInvitationStatus,
  normalizeGroupIntensity,
  normalizeGroupLanguage,
  normalizeGroupMemberRole,
  normalizeGroupPlayStyle,
} from './group-options';

type GroupWithSettingsAndMembers = Group & {
  settings: GroupSettings | null;
  members: GroupMember[];
};

type InvitationWithGroup = Invitation & {
  group: Group & {
    settings: GroupSettings | null;
  };
};

type GroupMemberWithUser = GroupMember & {
  user: Pick<
    User,
    'id' | 'emailAddress' | 'firstName' | 'lastName' | 'imageUrl'
  >;
};

export type InternalFootballGroup = {
  id: string;
  name: string;
  ownerUserId: string;
  currentUserRole: GroupMemberRole;
  settings: FootballGroupSettings;
  createdAt: Date;
  updatedAt: Date;
};

export type InternalFootballGroupInvitation = {
  id: string;
  groupId: string;
  groupName: string;
  createdByUserId: string;
  token: string;
  status: FootballGroupInvitation['status'];
  inviteUrl: string;
  usageCount: number;
  expiresAt: Date | null;
  lastAcceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InternalAcceptedGroupInvitation = {
  invitation: InternalFootballGroupInvitation;
  group: InternalFootballGroup;
  nextAction: GroupInviteAcceptNextAction;
};

export type InternalFootballGroupMember = {
  id: string;
  groupId: string;
  userId: string;
  role: GroupMemberRole;
  user: FootballGroupMember['user'];
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class GroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(clerkUserId: string): Promise<InternalFootballGroup[]> {
    const user = await this.prisma.user.findUnique({
      where: {
        clerkUserId,
      },
      select: {
        id: true,
      },
    });

    if (!user) {
      return [];
    }

    const memberships = await this.prisma.groupMember.findMany({
      where: {
        userId: user.id,
      },
      include: {
        group: {
          include: {
            settings: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });

    return memberships.map((membership) =>
      this.toInternalGroup(
        {
          ...membership.group,
          members: [membership],
        },
        normalizeGroupMemberRole(membership.role),
      ),
    );
  }

  async createForUser(
    clerkUserId: string,
    input: CreateFootballGroupInput,
  ): Promise<InternalFootballGroup> {
    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.upsert({
        where: {
          clerkUserId,
        },
        create: {
          clerkUserId,
        },
        update: {},
        select: {
          id: true,
        },
      });

      const group = await transaction.group.create({
        data: {
          name: input.name.trim(),
          ownerUserId: user.id,
          settings: {
            create: {
              defaultLanguage: input.defaultLanguage,
              playStyle: input.playStyle,
              intensity: input.intensity,
              goalkeeperMode: input.goalkeeperMode,
              generatorStyle: input.generatorStyle,
            },
          },
          members: {
            create: {
              userId: user.id,
              role: DEFAULT_GROUP_SETTINGS.memberRole,
            },
          },
        },
        include: {
          settings: true,
          members: {
            where: {
              userId: user.id,
            },
            take: 1,
          },
        },
      });

      return this.toInternalGroup(group, DEFAULT_GROUP_SETTINGS.memberRole);
    });
  }

  async createInvitation(
    clerkUserId: string,
    groupId: string,
  ): Promise<InternalFootballGroupInvitation> {
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
    });

    const role = normalizeGroupMemberRole(membership?.role);

    if (!membership || !canManageGroupInvitations(role)) {
      throw new ForbiddenException('Owner or admin role required.');
    }

    const invitation = await this.prisma.invitation.create({
      data: {
        groupId,
        createdByUserId: user.id,
        token: this.createInviteToken(),
        status: 'active',
      },
      include: {
        group: {
          include: {
            settings: true,
          },
        },
      },
    });

    return this.toInternalInvitation(invitation);
  }

  async updateSettings(
    clerkUserId: string,
    groupId: string,
    input: UpdateFootballGroupSettingsInput,
  ): Promise<InternalFootballGroup> {
    const actorMembership = await this.requireActorMembership(
      clerkUserId,
      groupId,
    );

    if (!canUpdateGroupSettings(actorMembership.role)) {
      throw new ForbiddenException('Owner or admin role required.');
    }

    const group = await this.prisma.group.update({
      where: {
        id: groupId,
      },
      data: {
        settings: {
          update: {
            playStyle: input.playStyle,
            intensity: input.intensity,
            goalkeeperMode: input.goalkeeperMode,
            generatorStyle: input.generatorStyle,
          },
        },
      },
      include: {
        settings: true,
        members: {
          where: {
            userId: actorMembership.userId,
          },
          take: 1,
        },
      },
    });

    return this.toInternalGroup(group, actorMembership.role);
  }

  async listMembers(
    clerkUserId: string,
    groupId: string,
  ): Promise<InternalFootballGroupMember[]> {
    await this.requireActorMembership(clerkUserId, groupId);

    const members = await this.prisma.groupMember.findMany({
      where: {
        groupId,
      },
      include: {
        user: {
          select: {
            id: true,
            emailAddress: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });

    return members.map((member) => this.toInternalMember(member));
  }

  async updateMemberRole(
    clerkUserId: string,
    groupId: string,
    memberId: string,
    input: UpdateFootballGroupMemberRoleInput,
  ): Promise<InternalFootballGroupMember> {
    const actorMembership = await this.requireActorMembership(
      clerkUserId,
      groupId,
    );

    if (!canManageGroupMembers(actorMembership.role)) {
      throw new ForbiddenException('Owner role required.');
    }

    const targetMembership = await this.prisma.groupMember.findFirst({
      where: {
        id: memberId,
        groupId,
      },
      include: {
        user: {
          select: {
            id: true,
            emailAddress: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('Group member not found.');
    }

    if (normalizeGroupMemberRole(targetMembership.role) === 'owner') {
      throw new BadRequestException('Owner role cannot be changed.');
    }

    const updatedMember = await this.prisma.groupMember.update({
      where: {
        id: memberId,
      },
      data: {
        role: input.role,
      },
      include: {
        user: {
          select: {
            id: true,
            emailAddress: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });

    return this.toInternalMember(updatedMember);
  }

  async removeMember(
    clerkUserId: string,
    groupId: string,
    memberId: string,
  ): Promise<string> {
    const actorMembership = await this.requireActorMembership(
      clerkUserId,
      groupId,
    );

    if (!canManageGroupMembers(actorMembership.role)) {
      throw new ForbiddenException('Owner role required.');
    }

    const targetMembership = await this.prisma.groupMember.findFirst({
      where: {
        id: memberId,
        groupId,
      },
    });

    if (!targetMembership) {
      throw new NotFoundException('Group member not found.');
    }

    if (normalizeGroupMemberRole(targetMembership.role) === 'owner') {
      throw new BadRequestException('Owner membership cannot be removed.');
    }

    await this.prisma.groupMember.delete({
      where: {
        id: memberId,
      },
    });

    return memberId;
  }

  async acceptInvitation(
    clerkUserId: string,
    token: string,
  ): Promise<InternalAcceptedGroupInvitation> {
    const inviteToken = this.normalizeInviteToken(token);

    if (!inviteToken) {
      throw new NotFoundException('Invitation not found.');
    }

    return this.prisma.$transaction(async (transaction) => {
      const invitation = await transaction.invitation.findUnique({
        where: {
          token: inviteToken,
        },
        include: {
          group: {
            include: {
              settings: true,
            },
          },
        },
      });

      if (
        !invitation ||
        normalizeGroupInvitationStatus(invitation.status) !== 'active' ||
        (invitation.expiresAt && invitation.expiresAt <= new Date())
      ) {
        throw new NotFoundException('Invitation not found.');
      }

      const user = await transaction.user.upsert({
        where: {
          clerkUserId,
        },
        create: {
          clerkUserId,
        },
        update: {},
        select: {
          id: true,
        },
      });

      const existingMembership = await transaction.groupMember.findFirst({
        where: {
          groupId: invitation.groupId,
          userId: user.id,
        },
      });

      const membership =
        existingMembership ??
        (await transaction.groupMember.create({
          data: {
            groupId: invitation.groupId,
            userId: user.id,
            role: 'member',
          },
        }));

      const updatedInvitation = await transaction.invitation.update({
        where: {
          id: invitation.id,
        },
        data: {
          usageCount: {
            increment: 1,
          },
          lastAcceptedAt: new Date(),
        },
        include: {
          group: {
            include: {
              settings: true,
            },
          },
        },
      });

      return {
        invitation: this.toInternalInvitation(updatedInvitation),
        group: this.toInternalGroup(
          {
            ...updatedInvitation.group,
            members: [membership],
          },
          normalizeGroupMemberRole(membership.role),
        ),
        nextAction: 'create_player_profile',
      };
    });
  }

  private toInternalGroup(
    group: GroupWithSettingsAndMembers,
    fallbackRole: GroupMemberRole,
  ): InternalFootballGroup {
    const settings = group.settings;

    return {
      id: group.id,
      name: group.name,
      ownerUserId: group.ownerUserId,
      currentUserRole: normalizeGroupMemberRole(
        group.members[0]?.role ?? fallbackRole,
      ),
      settings: {
        defaultLanguage: normalizeGroupLanguage(settings?.defaultLanguage),
        playStyle: normalizeGroupPlayStyle(settings?.playStyle),
        intensity: normalizeGroupIntensity(settings?.intensity),
        goalkeeperMode: normalizeGroupGoalkeeperMode(settings?.goalkeeperMode),
        generatorStyle: normalizeGroupGeneratorStyle(settings?.generatorStyle),
      },
      createdAt: group.createdAt,
      updatedAt: group.updatedAt,
    };
  }

  private toInternalInvitation(
    invitation: InvitationWithGroup,
  ): InternalFootballGroupInvitation {
    return {
      id: invitation.id,
      groupId: invitation.groupId,
      groupName: invitation.group.name,
      createdByUserId: invitation.createdByUserId,
      token: invitation.token,
      status: normalizeGroupInvitationStatus(invitation.status),
      inviteUrl: this.buildInviteUrl(invitation.token),
      usageCount: invitation.usageCount,
      expiresAt: invitation.expiresAt,
      lastAcceptedAt: invitation.lastAcceptedAt,
      createdAt: invitation.createdAt,
      updatedAt: invitation.updatedAt,
    };
  }

  private toInternalMember(
    member: GroupMemberWithUser,
  ): InternalFootballGroupMember {
    return {
      id: member.id,
      groupId: member.groupId,
      userId: member.userId,
      role: normalizeGroupMemberRole(member.role),
      user: {
        id: member.user.id,
        emailAddress: member.user.emailAddress,
        firstName: member.user.firstName,
        lastName: member.user.lastName,
        imageUrl: member.user.imageUrl,
      },
      joinedAt: member.joinedAt,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
    };
  }

  private async requireActorMembership(
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
    });

    if (!membership) {
      throw new ForbiddenException('Group membership required.');
    }

    return {
      userId: user.id,
      role: normalizeGroupMemberRole(membership.role),
    };
  }

  private createInviteToken(): string {
    return randomBytes(9).toString('base64url');
  }

  private normalizeInviteToken(value: string): string {
    const parts = value.trim().split('/').filter(Boolean);

    return parts[parts.length - 1]?.trim() ?? '';
  }

  private buildInviteUrl(token: string): string {
    const baseUrl =
      process.env.FIVEMATCH_INVITE_BASE_URL ?? 'fivematch://invite';

    return `${baseUrl.replace(/\/+$/, '')}/${token}`;
  }
}
