import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { InitialPeerRating as PrismaInitialPeerRating } from '@prisma/client';
import type {
  InitialPeerRatingAttributeSet,
  InitialPeerRatingReadiness,
  SubmitInitialPeerRatingInput,
  UpdateInitialPeerRatingInput,
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

const INITIAL_PEER_RATING_READINESS_THRESHOLD = 3;

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

  async updateInitialPeerRating(
    clerkUserId: string,
    groupId: string,
    ratingId: string,
    input: UpdateInitialPeerRatingInput,
  ): Promise<InternalInitialPeerRating> {
    const raterPlayer = await this.requireGroupPlayer(clerkUserId, groupId);
    const existingRating = await this.prisma.initialPeerRating.findFirst({
      where: {
        id: ratingId,
        groupId,
        raterPlayerId: raterPlayer.id,
      },
    });

    if (!existingRating) {
      throw new ForbiddenException('Initial peer rating not available.');
    }

    if (existingRating.lockedAt) {
      throw new ConflictException('Initial peer rating is locked.');
    }

    const data = this.buildRatingData(
      this.toInternalRating(existingRating).attributeSet,
      input.values,
    );
    const rating = await this.prisma.initialPeerRating.update({
      where: {
        id: existingRating.id,
      },
      data,
    });

    return this.toInternalRating(rating);
  }

  async getInitialPeerRatingReadiness(
    clerkUserId: string,
    groupId: string,
  ): Promise<InitialPeerRatingReadiness> {
    const currentPlayer = await this.requireGroupPlayer(clerkUserId, groupId);
    const [players, ratingCounts, currentUserRatings] = await Promise.all([
      this.prisma.player.findMany({
        where: {
          groupId,
        },
        select: {
          id: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      }),
      this.prisma.initialPeerRating.groupBy({
        by: ['ratedPlayerId'],
        where: {
          groupId,
        },
        _count: {
          _all: true,
        },
      }),
      this.prisma.initialPeerRating.findMany({
        where: {
          groupId,
          raterPlayerId: currentPlayer.id,
        },
        select: {
          ratedPlayerId: true,
        },
      }),
    ]);
    const receivedCountByPlayerId = new Map(
      ratingCounts.map((ratingCount) => [
        ratingCount.ratedPlayerId,
        ratingCount._count._all,
      ]),
    );
    const currentUserRatedPlayerIds = new Set(
      currentUserRatings.map((rating) => rating.ratedPlayerId),
    );
    const threshold = INITIAL_PEER_RATING_READINESS_THRESHOLD;
    const progressPlayers = players.map((player) => {
      const ratingsReceived = receivedCountByPlayerId.get(player.id) ?? 0;
      const ratingsNeeded = Math.max(0, threshold - ratingsReceived);

      return {
        playerId: player.id,
        ratingsReceived,
        ratingsNeeded,
        ready: ratingsNeeded === 0,
        currentUserHasRated: currentUserRatedPlayerIds.has(player.id),
        isCurrentUser: player.id === currentPlayer.id,
      };
    });
    const totalPlayers = progressPlayers.length;
    const readyPlayers = progressPlayers.filter(
      (player) => player.ready,
    ).length;
    const incompletePlayers = totalPlayers - readyPlayers;
    const progressPercent =
      totalPlayers === 0 ? 0 : Math.round((readyPlayers / totalPlayers) * 100);
    const currentUserPendingRatings = progressPlayers.filter(
      (player) => !player.isCurrentUser && !player.currentUserHasRated,
    ).length;

    return {
      groupId,
      threshold,
      totalPlayers,
      readyPlayers,
      incompletePlayers,
      progressPercent,
      ready: totalPlayers > 0 && incompletePlayers === 0,
      currentUserPendingRatings,
      players: progressPlayers,
    };
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
