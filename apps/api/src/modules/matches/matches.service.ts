import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Match as PrismaMatch } from '@prisma/client';
import type {
  CreateFootballMatchInput,
  FootballMatchStatus,
  GroupGeneratorStyle,
  GroupGoalkeeperMode,
  GroupMemberRole,
} from '@fit-five/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  canUpdateGroupSettings,
  normalizeGroupMemberRole,
} from '../groups/group-options';
import {
  normalizeGeneratorStyleOverride,
  normalizeGoalkeeperModeOverride,
  normalizeMatchStatus,
} from './match-options';

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
    await this.requireGroupMembership(clerkUserId, groupId);

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

    return match ? this.toInternalMatch(match) : null;
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

  private toInternalMatch(match: PrismaMatch): InternalFootballMatch {
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
      confirmedCount: 0,
      waitlistCount: 0,
      createdAt: match.createdAt,
      updatedAt: match.updatedAt,
    };
  }
}
