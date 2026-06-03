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

  it('saves an In response idempotently as confirmed before capacity', async () => {
    const count = jest
      .fn()
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0);
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        createAttendanceRow({
          response: 'in',
          status: 'confirmed',
        }),
      );
    const upsert = jest.fn().mockResolvedValue(
      createAttendanceRow({
        response: 'in',
        status: 'confirmed',
      }),
    );
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
        findFirst: jest.fn().mockResolvedValue(createMatchRow()),
        attendanceCount: count,
        attendanceFindUnique: findUnique,
        attendanceUpsert: upsert,
      }),
    );

    await expect(
      service.submitAttendance('user_123', 'grp_123', 'match_123', {
        response: 'in',
      }),
    ).resolves.toMatchObject({
      confirmedCount: 5,
      waitlistCount: 0,
      myAttendance: {
        response: 'in',
        status: 'confirmed',
      },
    });

    expect(upsert).toHaveBeenCalledWith({
      where: {
        matchId_playerId: {
          matchId: 'match_123',
          playerId: 'ply_123',
        },
      },
      create: expect.objectContaining({
        response: 'in',
        status: 'confirmed',
      }) as object,
      update: expect.objectContaining({
        response: 'in',
        status: 'confirmed',
      }) as object,
    });
  });
});

function createPrismaMock({
  role,
  create = jest.fn(),
  findFirst = jest.fn(),
  attendanceCount = jest.fn().mockResolvedValue(0),
  attendanceFindUnique = jest.fn().mockResolvedValue(null),
  attendanceUpsert = jest.fn(),
}: {
  role: string;
  create?: jest.Mock;
  findFirst?: jest.Mock;
  attendanceCount?: jest.Mock;
  attendanceFindUnique?: jest.Mock;
  attendanceUpsert?: jest.Mock;
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
    player: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'ply_123',
      }),
    },
    match: {
      create,
      findFirst,
    },
    matchAttendance: {
      count: attendanceCount,
      findUnique: attendanceFindUnique,
      upsert: attendanceUpsert,
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

function createAttendanceRow(
  overrides: Partial<{
    response: string;
    status: string;
    waitlistPosition: number | null;
  }> = {},
) {
  return {
    id: 'attendance_123',
    matchId: 'match_123',
    playerId: 'ply_123',
    response: overrides.response ?? 'in',
    status: overrides.status ?? 'confirmed',
    waitlistPosition: overrides.waitlistPosition ?? null,
    respondedAt: new Date('2026-06-03T02:00:00.000Z'),
    createdAt: new Date('2026-06-03T02:00:00.000Z'),
    updatedAt: new Date('2026-06-03T02:00:00.000Z'),
  };
}
