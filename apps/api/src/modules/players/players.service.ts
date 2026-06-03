import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Player } from '@prisma/client';
import type {
  PlayerDominantFoot,
  PlayerPreferredStyle,
  PlayerProfileField,
  PlayerVestiaireField,
  UpsertPlayerProfileInput,
  UpsertPlayerVestiaireInput,
} from '@fit-five/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  getMissingPlayerProfileFields,
  getMissingPlayerVestiaireFields,
  normalizeDominantFoot,
  normalizePreferredStyle,
} from './player-options';

export type InternalPlayerProfile = {
  id: string;
  groupId: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  nickname: string | null;
  photoUrl: string | null;
  bio: string | null;
  dominantFoot: PlayerDominantFoot | null;
  jerseyNumber: number | null;
  preferredStyle: PlayerPreferredStyle | null;
  clubDeFormation: string | null;
  specialty: string | null;
  favoriteExcuse: string | null;
  badFaithLevel: number | null;
  lockerRoomStyle: string | null;
  thirdHalfProfile: string | null;
  warCry: string | null;
  signatureCelebration: string | null;
  worstOnPitchHabit: string | null;
  legendaryPhrase: string | null;
  missingFields: PlayerProfileField[];
  isComplete: boolean;
  vestiaireMissingFields: PlayerVestiaireField[];
  isVestiaireComplete: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class PlayersService {
  constructor(private readonly prisma: PrismaService) {}

  async listGroupRoster(
    clerkUserId: string,
    groupId: string,
  ): Promise<InternalPlayerProfile[]> {
    await this.requireMembership(clerkUserId, groupId);

    const players = await this.prisma.player.findMany({
      where: {
        groupId,
      },
      orderBy: [
        {
          firstName: 'asc',
        },
        {
          nickname: 'asc',
        },
      ],
    });

    return players.map((player) => this.toInternalPlayer(player));
  }

  async getMyProfile(
    clerkUserId: string,
    groupId: string,
  ): Promise<InternalPlayerProfile | null> {
    const membership = await this.requireMembership(clerkUserId, groupId);

    const player = await this.prisma.player.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: membership.userId,
        },
      },
    });

    return player ? this.toInternalPlayer(player) : null;
  }

  async upsertMyProfile(
    clerkUserId: string,
    groupId: string,
    input: UpsertPlayerProfileInput,
  ): Promise<InternalPlayerProfile> {
    const membership = await this.requireMembership(clerkUserId, groupId);
    const data = {
      firstName: this.cleanText(input.firstName),
      lastName: this.cleanText(input.lastName),
      nickname: this.cleanText(input.nickname),
      photoUrl: this.cleanText(input.photoUrl),
      bio: this.cleanText(input.bio),
      dominantFoot: input.dominantFoot ?? null,
      jerseyNumber: input.jerseyNumber ?? null,
      preferredStyle: input.preferredStyle ?? null,
      clubDeFormation: this.cleanText(input.clubDeFormation),
    };

    const player = await this.prisma.player.upsert({
      where: {
        groupId_userId: {
          groupId,
          userId: membership.userId,
        },
      },
      create: {
        groupId,
        userId: membership.userId,
        ...data,
      },
      update: data,
    });

    return this.toInternalPlayer(player);
  }

  async upsertMyVestiaire(
    clerkUserId: string,
    groupId: string,
    input: UpsertPlayerVestiaireInput,
  ): Promise<InternalPlayerProfile> {
    const membership = await this.requireMembership(clerkUserId, groupId);
    const data = {
      specialty: this.cleanText(input.specialty),
      favoriteExcuse: this.cleanText(input.favoriteExcuse),
      badFaithLevel: input.badFaithLevel ?? null,
      lockerRoomStyle: this.cleanText(input.lockerRoomStyle),
      thirdHalfProfile: this.cleanText(input.thirdHalfProfile),
      warCry: this.cleanText(input.warCry),
      signatureCelebration: this.cleanText(input.signatureCelebration),
      worstOnPitchHabit: this.cleanText(input.worstOnPitchHabit),
      legendaryPhrase: this.cleanText(input.legendaryPhrase),
    };

    const player = await this.prisma.player.upsert({
      where: {
        groupId_userId: {
          groupId,
          userId: membership.userId,
        },
      },
      create: {
        groupId,
        userId: membership.userId,
        ...data,
      },
      update: data,
    });

    return this.toInternalPlayer(player);
  }

  private async requireMembership(
    clerkUserId: string,
    groupId: string,
  ): Promise<{ userId: string }> {
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
      },
    });

    if (!membership) {
      throw new ForbiddenException('Group membership required.');
    }

    return membership;
  }

  private toInternalPlayer(player: Player): InternalPlayerProfile {
    const normalizedPlayer = {
      id: player.id,
      groupId: player.groupId,
      userId: player.userId,
      firstName: player.firstName,
      lastName: player.lastName,
      nickname: player.nickname,
      photoUrl: player.photoUrl,
      bio: player.bio,
      dominantFoot: normalizeDominantFoot(player.dominantFoot),
      jerseyNumber: player.jerseyNumber,
      preferredStyle: normalizePreferredStyle(player.preferredStyle),
      clubDeFormation: player.clubDeFormation,
      specialty: player.specialty ?? null,
      favoriteExcuse: player.favoriteExcuse ?? null,
      badFaithLevel: player.badFaithLevel ?? null,
      lockerRoomStyle: player.lockerRoomStyle ?? null,
      thirdHalfProfile: player.thirdHalfProfile ?? null,
      warCry: player.warCry ?? null,
      signatureCelebration: player.signatureCelebration ?? null,
      worstOnPitchHabit: player.worstOnPitchHabit ?? null,
      legendaryPhrase: player.legendaryPhrase ?? null,
      createdAt: player.createdAt,
      updatedAt: player.updatedAt,
    };
    const missingFields = getMissingPlayerProfileFields(normalizedPlayer);
    const vestiaireMissingFields =
      getMissingPlayerVestiaireFields(normalizedPlayer);

    return {
      ...normalizedPlayer,
      missingFields,
      isComplete: missingFields.length === 0,
      vestiaireMissingFields,
      isVestiaireComplete: vestiaireMissingFields.length === 0,
    };
  }

  private cleanText(value: string | null | undefined): string | null {
    const trimmedValue = value?.trim();

    return trimmedValue ? trimmedValue : null;
  }
}
