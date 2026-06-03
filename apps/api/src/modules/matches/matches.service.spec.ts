import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatchesService } from './matches.service';

describe('MatchesService', () => {
  it('creates a match for an owner/admin and calculates max players', async () => {
    const create = jest.fn().mockResolvedValue(createMatchRow());
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        create,
      }),
    );

    await expect(
      service.createMatch('user_123', 'grp_123', {
        title: 'Wednesday Football',
        startsAt: '2026-06-10T18:00:00.000Z',
        location: 'Mont Foot 5',
        playersPerTeam: 5,
        attendanceDeadlineAt: '2026-06-10T16:00:00.000Z',
        generatorStyleOverride: 'max_fairness',
        goalkeeperModeOverride: 'fixed_goalkeeper',
      }),
    ).resolves.toMatchObject({
      id: 'match_123',
      maxPlayers: 10,
      confirmedCount: 0,
      waitlistCount: 0,
    });

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: 'grp_123',
        organizerUserId: 'usr_123',
        playersPerTeam: 5,
        maxPlayers: 10,
      }) as object,
    });
  });

  it('blocks match creation for regular members', async () => {
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
      }),
    );

    await expect(
      service.createMatch('user_123', 'grp_123', {
        title: 'Wednesday Football',
        startsAt: '2026-06-10T18:00:00.000Z',
        location: 'Mont Foot 5',
        playersPerTeam: 5,
        attendanceDeadlineAt: '2026-06-10T16:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns the next open future match for group members', async () => {
    const findFirst = jest.fn().mockResolvedValue(createMatchRow());
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
        findFirst,
      }),
    );

    await expect(
      service.getNextMatch('user_123', 'grp_123'),
    ).resolves.toMatchObject({
      id: 'match_123',
      status: 'open',
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        groupId: 'grp_123',
        status: 'open',
        startsAt: {
          gte: expect.any(Date) as Date,
        },
      },
      orderBy: {
        startsAt: 'asc',
      },
    });
  });
});

function createPrismaMock({
  role,
  create = jest.fn(),
  findFirst = jest.fn(),
}: {
  role: string;
  create?: jest.Mock;
  findFirst?: jest.Mock;
}) {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'usr_123',
      }),
    },
    groupMember: {
      findFirst: jest.fn().mockResolvedValue({
        userId: 'usr_123',
        role,
      }),
    },
    match: {
      create,
      findFirst,
    },
  } as unknown as PrismaService;
}

function createMatchRow() {
  return {
    id: 'match_123',
    groupId: 'grp_123',
    organizerUserId: 'usr_123',
    title: 'Wednesday Football',
    startsAt: new Date('2026-06-10T18:00:00.000Z'),
    location: 'Mont Foot 5',
    playersPerTeam: 5,
    maxPlayers: 10,
    attendanceDeadlineAt: new Date('2026-06-10T16:00:00.000Z'),
    generatorStyleOverride: 'max_fairness',
    goalkeeperModeOverride: 'fixed_goalkeeper',
    status: 'open',
    createdAt: new Date('2026-06-03T00:00:00.000Z'),
    updatedAt: new Date('2026-06-03T01:00:00.000Z'),
  };
}
