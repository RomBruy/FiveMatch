import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RatingsService } from './ratings.service';

describe('RatingsService', () => {
  it('submits a standard initial peer rating once for a non-self player', async () => {
    const create = jest.fn().mockResolvedValue(
      createRatingRow({
        attributeSet: 'standard',
        speed: 80,
        attack: 75,
        technique: 70,
        defense: 55,
        stamina: 90,
      }),
    );
    const service = new RatingsService(
      createPrismaMock({
        targetPreferredStyle: 'attacker',
        existingRating: null,
        create,
      }),
    );

    await expect(
      service.submitInitialPeerRating('user_123', 'grp_123', {
        ratedPlayerId: 'ply_target',
        values: {
          overall: 78,
          speed: 80,
          attack: 75,
          technique: 70,
          defense: 55,
          physical: 68,
          stamina: 90,
          fun: 88,
        },
      }),
    ).resolves.toMatchObject({
      attributeSet: 'standard',
      speed: 80,
      stamina: 90,
      reflexes: null,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: 'grp_123',
        raterPlayerId: 'ply_rater',
        ratedPlayerId: 'ply_target',
        attributeSet: 'standard',
        overall: 78,
        speed: 80,
        stamina: 90,
        reflexes: null,
      }) as object,
    });
  });

  it('uses goalkeeper attributes when the rated profile is goalkeeper', async () => {
    const create = jest.fn().mockResolvedValue(
      createRatingRow({
        attributeSet: 'goalkeeper',
        speed: null,
        attack: null,
        technique: null,
        defense: null,
        reflexes: 82,
        positioning: 76,
        handling: 79,
        distribution: 71,
        communication: 86,
        stamina: null,
      }),
    );
    const service = new RatingsService(
      createPrismaMock({
        targetPreferredStyle: 'goalkeeper',
        existingRating: null,
        create,
      }),
    );

    await expect(
      service.submitInitialPeerRating('user_123', 'grp_123', {
        ratedPlayerId: 'ply_target',
        values: {
          overall: 81,
          reflexes: 82,
          positioning: 76,
          handling: 79,
          distribution: 71,
          communication: 86,
          physical: 70,
          fun: 64,
        },
      }),
    ).resolves.toMatchObject({
      attributeSet: 'goalkeeper',
      reflexes: 82,
      speed: null,
      stamina: null,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        attributeSet: 'goalkeeper',
        reflexes: 82,
        positioning: 76,
        handling: 79,
        distribution: 71,
        communication: 86,
        speed: null,
        stamina: null,
      }) as object,
    });
  });

  it('blocks self-ratings', async () => {
    const service = new RatingsService(
      createPrismaMock({
        targetPlayerId: 'ply_rater',
        targetPreferredStyle: 'attacker',
        existingRating: null,
      }),
    );

    await expect(
      service.submitInitialPeerRating('user_123', 'grp_123', {
        ratedPlayerId: 'ply_rater',
        values: {
          overall: 50,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks duplicate initial peer ratings', async () => {
    const service = new RatingsService(
      createPrismaMock({
        targetPreferredStyle: 'attacker',
        existingRating: {
          id: 'ipr_existing',
        },
      }),
    );

    await expect(
      service.submitInitialPeerRating('user_123', 'grp_123', {
        ratedPlayerId: 'ply_target',
        values: {
          overall: 80,
          speed: 80,
          attack: 80,
          technique: 80,
          defense: 80,
          physical: 80,
          stamina: 80,
          fun: 80,
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

type CreatePrismaMockOptions = {
  targetPlayerId?: string;
  targetPreferredStyle: string;
  existingRating: { id: string } | null;
  create?: jest.Mock;
};

function createPrismaMock({
  targetPlayerId = 'ply_target',
  targetPreferredStyle,
  existingRating,
  create = jest.fn(),
}: CreatePrismaMockOptions) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'usr_123',
      }),
    },
    groupMember: {
      findFirst: jest.fn().mockResolvedValue({
        userId: 'usr_123',
      }),
    },
    player: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'ply_rater',
        userId: 'usr_123',
      }),
      findFirst: jest.fn().mockResolvedValue({
        id: targetPlayerId,
        preferredStyle: targetPreferredStyle,
      }),
    },
    initialPeerRating: {
      findUnique: jest.fn().mockResolvedValue(existingRating),
      create,
    },
  } as unknown as PrismaService;
}

function createRatingRow(
  overrides: Partial<{
    attributeSet: string;
    speed: number | null;
    attack: number | null;
    technique: number | null;
    defense: number | null;
    reflexes: number | null;
    positioning: number | null;
    handling: number | null;
    distribution: number | null;
    communication: number | null;
    stamina: number | null;
  }> = {},
) {
  return {
    id: 'ipr_123',
    groupId: 'grp_123',
    raterPlayerId: 'ply_rater',
    ratedPlayerId: 'ply_target',
    attributeSet: overrides.attributeSet ?? 'standard',
    overall: 78,
    speed: getOverrideValue(overrides, 'speed', 80),
    attack: getOverrideValue(overrides, 'attack', 75),
    technique: getOverrideValue(overrides, 'technique', 70),
    defense: getOverrideValue(overrides, 'defense', 55),
    reflexes: getOverrideValue(overrides, 'reflexes', null),
    positioning: getOverrideValue(overrides, 'positioning', null),
    handling: getOverrideValue(overrides, 'handling', null),
    distribution: getOverrideValue(overrides, 'distribution', null),
    communication: getOverrideValue(overrides, 'communication', null),
    physical: 68,
    stamina: getOverrideValue(overrides, 'stamina', 90),
    fun: 88,
    lockedAt: null,
    createdAt: new Date('2026-06-03T00:00:00.000Z'),
    updatedAt: new Date('2026-06-03T01:00:00.000Z'),
  };
}

function getOverrideValue<
  TOverrides extends Record<string, unknown>,
  TKey extends keyof TOverrides,
>(overrides: TOverrides, key: TKey, fallback: TOverrides[TKey]) {
  return Object.prototype.hasOwnProperty.call(overrides, key)
    ? overrides[key]
    : fallback;
}
