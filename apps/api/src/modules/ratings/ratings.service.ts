import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { InitialPeerRating as PrismaInitialPeerRating } from '@prisma/client';
import type {
  InitialPeerRatingAttributeSet,
  SubmitInitialPeerRatingInput,
} from '@fit-five/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  getInitialPeerRatingAttributeSet,
  getRequiredInitialPeerRatingAttributes,
  getValidatedRatingValue,
} from './rating-options';

export type InternalInitialPeerRating = {
  id: string;
  groupId: string;
  raterPlayerId: string;
  ratedPlayerId: string;
  attributeSet: InitialPeerRatingAttributeSet;
  overall: number;
  speed: number | null;
  attack: number | null;
  technique: number | null;
  defense: number | null;
  reflexes: number | null;
  positioning: number | null;
  handling: number | null;
  distribution: number | null;
  communication: number | null;
  physical: number;
  stamina: number | null;
  fun: number;
  lockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMyInitialPeerRatings(
    clerkUserId: string,
    groupId: string,
  ): Promise<InternalInitialPeerRating[]> {
    const raterPlayer = await this.requireGroupPlayer(clerkUserId, groupId);
    const ratings = await this.prisma.initialPeerRating.findMany({
      where: {
        groupId,
        raterPlayerId: raterPlayer.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return ratings.map((rating) => this.toInternalRating(rating));
  }

  async submitInitialPeerRating(
    clerkUserId: string,
    groupId: string,
    input: SubmitInitialPeerRatingInput,
  ): Promise<InternalInitialPeerRating> {
    const raterPlayer = await this.requireGroupPlayer(clerkUserId, groupId);
    const ratedPlayer = await this.prisma.player.findFirst({
      where: {
        id: input.ratedPlayerId,
        groupId,
      },
      select: {
        id: true,
        preferredStyle: true,
      },
    });

    if (!ratedPlayer) {
      throw new BadRequestException('Rated player must belong to this group.');
    }

    if (ratedPlayer.id === raterPlayer.id) {
      throw new BadRequestException('Self-rating is not allowed.');
    }

    const existingRating = await this.prisma.initialPeerRating.findUnique({
      where: {
        groupId_raterPlayerId_ratedPlayerId: {
          groupId,
          raterPlayerId: raterPlayer.id,
          ratedPlayerId: ratedPlayer.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (existingRating) {
      throw new ConflictException('Initial peer rating already exists.');
    }

    const attributeSet = getInitialPeerRatingAttributeSet(
      ratedPlayer.preferredStyle,
    );
    const data = this.buildRatingData(attributeSet, input.values);
    const rating = await this.prisma.initialPeerRating.create({
      data: {
        groupId,
        raterPlayerId: raterPlayer.id,
        ratedPlayerId: ratedPlayer.id,
        attributeSet,
        ...data,
      },
    });

    return this.toInternalRating(rating);
  }

  private async requireGroupPlayer(
    clerkUserId: string,
    groupId: string,
  ): Promise<{ id: string; userId: string }> {
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

    const player = await this.prisma.player.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: membership.userId,
        },
      },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!player) {
      throw new ForbiddenException('Player profile required.');
    }

    return player;
  }

  private buildRatingData(
    attributeSet: InitialPeerRatingAttributeSet,
    values: SubmitInitialPeerRatingInput['values'],
  ) {
    const requiredAttributes =
      getRequiredInitialPeerRatingAttributes(attributeSet);

    for (const attribute of requiredAttributes) {
      const value = getValidatedRatingValue(values, attribute);

      if (value === null) {
        throw new BadRequestException(
          `Rating value for ${attribute} must be an integer between 0 and 100.`,
        );
      }
    }

    if (attributeSet === 'goalkeeper') {
      return {
        overall: values.overall as number,
        speed: null,
        attack: null,
        technique: null,
        defense: null,
        reflexes: values.reflexes as number,
        positioning: values.positioning as number,
        handling: values.handling as number,
        distribution: values.distribution as number,
        communication: values.communication as number,
        physical: values.physical as number,
        stamina: null,
        fun: values.fun as number,
      };
    }

    return {
      overall: values.overall as number,
      speed: values.speed as number,
      attack: values.attack as number,
      technique: values.technique as number,
      defense: values.defense as number,
      reflexes: null,
      positioning: null,
      handling: null,
      distribution: null,
      communication: null,
      physical: values.physical as number,
      stamina: values.stamina as number,
      fun: values.fun as number,
    };
  }

  private toInternalRating(
    rating: PrismaInitialPeerRating,
  ): InternalInitialPeerRating {
    return {
      id: rating.id,
      groupId: rating.groupId,
      raterPlayerId: rating.raterPlayerId,
      ratedPlayerId: rating.ratedPlayerId,
      attributeSet:
        rating.attributeSet === 'goalkeeper' ? 'goalkeeper' : 'standard',
      overall: rating.overall,
      speed: rating.speed,
      attack: rating.attack,
      technique: rating.technique,
      defense: rating.defense,
      reflexes: rating.reflexes,
      positioning: rating.positioning,
      handling: rating.handling,
      distribution: rating.distribution,
      communication: rating.communication,
      physical: rating.physical,
      stamina: rating.stamina,
      fun: rating.fun,
      lockedAt: rating.lockedAt,
      createdAt: rating.createdAt,
      updatedAt: rating.updatedAt,
    };
  }
}
