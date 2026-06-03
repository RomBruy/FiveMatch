import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlayersService } from './players.service';

describe('PlayersService', () => {
  it('upserts the authenticated member player profile without rating fields', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'usr_123',
    });
    const findFirst = jest.fn().mockResolvedValue({
      userId: 'usr_123',
    });
    const upsert = jest.fn().mockResolvedValue({
      id: 'ply_123',
      groupId: 'grp_123',
      userId: 'usr_123',
      firstName: 'Romain',
      lastName: 'Bruyndonckx',
      nickname: 'Neymar',
      photoUrl: 'https://example.com/photo.jpg',
      bio: 'Toujours chaud',
      dominantFoot: 'right',
      jerseyNumber: 10,
      preferredStyle: 'attacker',
      clubDeFormation: 'FC Annecy',
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T01:00:00.000Z'),
    });
    const service = new PlayersService({
      user: {
        findUnique,
      },
      groupMember: {
        findFirst,
      },
      player: {
        upsert,
      },
    } as unknown as PrismaService);

    await expect(
      service.upsertMyProfile('user_123', 'grp_123', {
        firstName: ' Romain ',
        lastName: 'Bruyndonckx',
        nickname: 'Neymar',
        photoUrl: 'https://example.com/photo.jpg',
        bio: 'Toujours chaud',
        dominantFoot: 'right',
        jerseyNumber: 10,
        preferredStyle: 'attacker',
        clubDeFormation: 'FC Annecy',
      }),
    ).resolves.toMatchObject({
      id: 'ply_123',
      isComplete: true,
      missingFields: [],
    });

    expect(upsert).toHaveBeenCalledWith({
      where: {
        groupId_userId: {
          groupId: 'grp_123',
          userId: 'usr_123',
        },
      },
      create: expect.objectContaining({
        firstName: 'Romain',
        userId: 'usr_123',
      }) as object,
      update: expect.objectContaining({
        firstName: 'Romain',
        preferredStyle: 'attacker',
      }) as object,
    });
    expect(upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          overallRating: expect.anything() as unknown,
        }) as object,
      }),
    );
  });

  it('upserts vestiaire personality without rating fields', async () => {
    const upsert = jest.fn().mockResolvedValue({
      id: 'ply_123',
      groupId: 'grp_123',
      userId: 'usr_123',
      firstName: null,
      lastName: null,
      nickname: null,
      photoUrl: null,
      bio: null,
      dominantFoot: null,
      jerseyNumber: null,
      preferredStyle: null,
      clubDeFormation: null,
      specialty: 'Petit pont puis perte de balle',
      favoriteExcuse: "J'etais pas chaud",
      badFaithLevel: 75,
      lockerRoomStyle: 'Clown',
      thirdHalfProfile: 'Lait fraise',
      warCry: 'On les mange',
      signatureCelebration: 'Slide rate',
      worstOnPitchHabit: 'Dribble de trop',
      legendaryPhrase: 'La prochaine elle rentre',
      createdAt: new Date('2026-06-03T00:00:00.000Z'),
      updatedAt: new Date('2026-06-03T01:00:00.000Z'),
    });
    const service = new PlayersService({
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
        upsert,
      },
    } as unknown as PrismaService);

    await expect(
      service.upsertMyVestiaire('user_123', 'grp_123', {
        specialty: ' Petit pont puis perte de balle ',
        favoriteExcuse: "J'etais pas chaud",
        badFaithLevel: 75,
        lockerRoomStyle: 'Clown',
        thirdHalfProfile: 'Lait fraise',
        warCry: 'On les mange',
        signatureCelebration: 'Slide rate',
        worstOnPitchHabit: 'Dribble de trop',
        legendaryPhrase: 'La prochaine elle rentre',
      }),
    ).resolves.toMatchObject({
      specialty: 'Petit pont puis perte de balle',
      badFaithLevel: 75,
      isVestiaireComplete: true,
      vestiaireMissingFields: [],
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          groupId: 'grp_123',
          userId: 'usr_123',
          specialty: 'Petit pont puis perte de balle',
        }) as object,
        update: expect.objectContaining({
          specialty: 'Petit pont puis perte de balle',
          badFaithLevel: 75,
        }) as object,
      }),
    );
    expect(upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          overallRating: expect.anything() as unknown,
        }) as object,
      }),
    );
    expect(upsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          globalRating: expect.anything() as unknown,
        }) as object,
      }),
    );
  });

  it('shows missing fields for incomplete profiles', async () => {
    const service = new PlayersService({
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
          id: 'ply_123',
          groupId: 'grp_123',
          userId: 'usr_123',
          firstName: 'Romain',
          lastName: null,
          nickname: null,
          photoUrl: null,
          bio: null,
          dominantFoot: null,
          jerseyNumber: null,
          preferredStyle: null,
          clubDeFormation: null,
          createdAt: new Date('2026-06-02T00:00:00.000Z'),
          updatedAt: new Date('2026-06-02T01:00:00.000Z'),
        }),
      },
    } as unknown as PrismaService);

    await expect(
      service.getMyProfile('user_123', 'grp_123'),
    ).resolves.toMatchObject({
      isComplete: false,
      missingFields: [
        'lastName',
        'nickname',
        'photoUrl',
        'bio',
        'dominantFoot',
        'jerseyNumber',
        'preferredStyle',
        'clubDeFormation',
      ],
    });
  });

  it('blocks profile writes outside group membership', async () => {
    const service = new PlayersService({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'usr_123',
        }),
      },
      groupMember: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService);

    await expect(
      service.upsertMyProfile('user_123', 'grp_123', {
        firstName: 'Romain',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists roster player identities for group members', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'ply_123',
        groupId: 'grp_123',
        userId: 'usr_123',
        firstName: 'Romain',
        lastName: 'Bruyndonckx',
        nickname: 'Neymar',
        photoUrl: null,
        bio: null,
        dominantFoot: 'right',
        jerseyNumber: 10,
        preferredStyle: 'attacker',
        clubDeFormation: null,
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
        updatedAt: new Date('2026-06-02T01:00:00.000Z'),
      },
    ]);
    const service = new PlayersService({
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
        findMany,
      },
    } as unknown as PrismaService);

    await expect(
      service.listGroupRoster('user_123', 'grp_123'),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'ply_123',
          nickname: 'Neymar',
        }) as object,
      ]),
    );
  });
});
