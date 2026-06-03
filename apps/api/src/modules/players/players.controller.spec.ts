import { BadRequestException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PlayersController } from './players.controller';
import { PlayersService } from './players.service';

describe('PlayersController', () => {
  it('serializes the current player profile', async () => {
    const getMyProfile = jest.fn().mockResolvedValue({
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
      specialty: 'Petit pont',
      favoriteExcuse: "J'etais pas chaud",
      badFaithLevel: 80,
      lockerRoomStyle: 'Clown',
      thirdHalfProfile: 'Lait fraise',
      warCry: 'On les mange',
      signatureCelebration: 'Slide rate',
      worstOnPitchHabit: 'Dribble de trop',
      legendaryPhrase: 'La prochaine elle rentre',
      missingFields: ['photoUrl', 'bio', 'clubDeFormation'],
      isComplete: false,
      vestiaireMissingFields: [],
      isVestiaireComplete: true,
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T01:00:00.000Z'),
    });
    const controller = new PlayersController({
      getMyProfile,
    } as unknown as PlayersService);

    await expect(
      controller.getMyProfile(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
      ),
    ).resolves.toEqual({
      data: {
        player: {
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
          specialty: 'Petit pont',
          favoriteExcuse: "J'etais pas chaud",
          badFaithLevel: 80,
          lockerRoomStyle: 'Clown',
          thirdHalfProfile: 'Lait fraise',
          warCry: 'On les mange',
          signatureCelebration: 'Slide rate',
          worstOnPitchHabit: 'Dribble de trop',
          legendaryPhrase: 'La prochaine elle rentre',
          missingFields: ['photoUrl', 'bio', 'clubDeFormation'],
          isComplete: false,
          vestiaireMissingFields: [],
          isVestiaireComplete: true,
          createdAt: '2026-06-02T00:00:00.000Z',
          updatedAt: '2026-06-02T01:00:00.000Z',
        },
      },
    });
  });

  it('upserts the current player profile', async () => {
    const upsertMyProfile = jest.fn().mockResolvedValue({
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
      missingFields: [],
      isComplete: true,
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T01:00:00.000Z'),
    });
    const controller = new PlayersController({
      upsertMyProfile,
    } as unknown as PlayersService);

    await expect(
      controller.upsertMyProfile(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        {
          firstName: 'Romain',
          lastName: 'Bruyndonckx',
          nickname: 'Neymar',
          photoUrl: 'https://example.com/photo.jpg',
          bio: 'Toujours chaud',
          dominantFoot: 'right',
          jerseyNumber: 10,
          preferredStyle: 'attacker',
          clubDeFormation: 'FC Annecy',
        },
      ),
    ).resolves.toMatchObject({
      data: {
        player: {
          id: 'ply_123',
          isComplete: true,
        },
      },
    });

    expect(upsertMyProfile).toHaveBeenCalledWith('user_123', 'grp_123', {
      firstName: 'Romain',
      lastName: 'Bruyndonckx',
      nickname: 'Neymar',
      photoUrl: 'https://example.com/photo.jpg',
      bio: 'Toujours chaud',
      dominantFoot: 'right',
      jerseyNumber: 10,
      preferredStyle: 'attacker',
      clubDeFormation: 'FC Annecy',
    });
  });

  it('rejects unsupported profile claims', async () => {
    const controller = new PlayersController({
      upsertMyProfile: jest.fn(),
    } as unknown as PlayersService);

    await expect(
      controller.upsertMyProfile(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        {
          dominantFoot: 'magic',
        } as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('upserts the current player vestiaire personality', async () => {
    const upsertMyVestiaire = jest.fn().mockResolvedValue({
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
      specialty: 'Petit pont',
      favoriteExcuse: "J'etais pas chaud",
      badFaithLevel: 80,
      lockerRoomStyle: 'Clown',
      thirdHalfProfile: 'Lait fraise',
      warCry: 'On les mange',
      signatureCelebration: 'Slide rate',
      worstOnPitchHabit: 'Dribble de trop',
      legendaryPhrase: 'La prochaine elle rentre',
      missingFields: [
        'firstName',
        'lastName',
        'nickname',
        'photoUrl',
        'bio',
        'dominantFoot',
        'jerseyNumber',
        'preferredStyle',
        'clubDeFormation',
      ],
      isComplete: false,
      vestiaireMissingFields: [],
      isVestiaireComplete: true,
      createdAt: new Date('2026-06-03T00:00:00.000Z'),
      updatedAt: new Date('2026-06-03T01:00:00.000Z'),
    });
    const controller = new PlayersController({
      upsertMyVestiaire,
    } as unknown as PlayersService);

    await expect(
      controller.upsertMyVestiaire(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        {
          specialty: 'Petit pont',
          favoriteExcuse: "J'etais pas chaud",
          badFaithLevel: 80,
          lockerRoomStyle: 'Clown',
          thirdHalfProfile: 'Lait fraise',
          warCry: 'On les mange',
          signatureCelebration: 'Slide rate',
          worstOnPitchHabit: 'Dribble de trop',
          legendaryPhrase: 'La prochaine elle rentre',
        },
      ),
    ).resolves.toMatchObject({
      data: {
        player: {
          id: 'ply_123',
          specialty: 'Petit pont',
          badFaithLevel: 80,
          isVestiaireComplete: true,
        },
      },
    });

    expect(upsertMyVestiaire).toHaveBeenCalledWith('user_123', 'grp_123', {
      specialty: 'Petit pont',
      favoriteExcuse: "J'etais pas chaud",
      badFaithLevel: 80,
      lockerRoomStyle: 'Clown',
      thirdHalfProfile: 'Lait fraise',
      warCry: 'On les mange',
      signatureCelebration: 'Slide rate',
      worstOnPitchHabit: 'Dribble de trop',
      legendaryPhrase: 'La prochaine elle rentre',
    });
  });

  it('rejects unsupported vestiaire bad-faith levels', async () => {
    const controller = new PlayersController({
      upsertMyVestiaire: jest.fn(),
    } as unknown as PlayersService);

    await expect(
      controller.upsertMyVestiaire(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        {
          badFaithLevel: 101,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('serializes the roster', async () => {
    const listGroupRoster = jest.fn().mockResolvedValue([
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
        missingFields: ['photoUrl', 'bio', 'clubDeFormation'],
        isComplete: false,
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
        updatedAt: new Date('2026-06-02T01:00:00.000Z'),
      },
    ]);
    const controller = new PlayersController({
      listGroupRoster,
    } as unknown as PlayersService);

    await expect(
      controller.listGroupRoster(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
      ),
    ).resolves.toMatchObject({
      data: {
        players: [
          {
            id: 'ply_123',
            nickname: 'Neymar',
          },
        ],
      },
    });
  });
});
