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
    const attendanceFindMany = jest.fn().mockResolvedValue([
      createAttendanceRow({
        id: 'attendance_confirmed',
        playerId: 'ply_confirmed',
        response: 'in',
        status: 'confirmed',
      }),
      createAttendanceRow({
        id: 'attendance_maybe',
        playerId: 'ply_maybe',
        response: 'maybe',
        status: 'maybe',
      }),
    ]);
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
        findFirst,
        attendanceCount: jest
          .fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(0),
        attendanceFindMany,
      }),
    );

    await expect(
      service.getNextMatch('user_123', 'grp_123'),
    ).resolves.toMatchObject({
      id: 'match_123',
      status: 'open',
      confirmedCount: 1,
      waitlistCount: 0,
      attendances: [
        {
          response: 'in',
          status: 'confirmed',
        },
        {
          response: 'maybe',
          status: 'maybe',
        },
      ],
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

  it('adds an In response to the ordered waitlist when the match is full', async () => {
    const count = jest
      .fn()
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2);
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        createAttendanceRow({
          response: 'in',
          status: 'waitlisted',
          waitlistPosition: 2,
        }),
      );
    const upsert = jest.fn().mockResolvedValue(
      createAttendanceRow({
        response: 'in',
        status: 'waitlisted',
        waitlistPosition: 2,
      }),
    );
    const findMany = jest.fn().mockResolvedValue([
      createAttendanceRow({
        id: 'attendance_wait_1',
        playerId: 'ply_wait_1',
        status: 'waitlisted',
        waitlistPosition: 1,
      }),
      createAttendanceRow({
        id: 'attendance_123',
        status: 'waitlisted',
        waitlistPosition: 2,
      }),
    ]);
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
        findFirst: jest.fn().mockResolvedValue(createMatchRow()),
        attendanceCount: count,
        attendanceFindUnique: findUnique,
        attendanceFindMany: findMany,
        attendanceUpsert: upsert,
      }),
    );

    await expect(
      service.submitAttendance('user_123', 'grp_123', 'match_123', {
        response: 'in',
      }),
    ).resolves.toMatchObject({
      confirmedCount: 10,
      waitlistCount: 2,
      myAttendance: {
        response: 'in',
        status: 'waitlisted',
        waitlistPosition: 2,
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
        status: 'waitlisted',
        waitlistPosition: 2,
      }) as object,
      update: expect.objectContaining({
        response: 'in',
        status: 'waitlisted',
        waitlistPosition: 2,
      }) as object,
    });
  });

  it('promotes the next waitlisted player when a confirmed player cancels', async () => {
    const count = jest
      .fn()
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(1);
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce(
        createAttendanceRow({
          response: 'in',
          status: 'confirmed',
        }),
      )
      .mockResolvedValueOnce(
        createAttendanceRow({
          response: 'out',
          status: 'out',
        }),
      );
    const matchFindFirst = jest.fn().mockResolvedValue(createMatchRow());
    const attendanceFindFirst = jest.fn().mockResolvedValue(
      createAttendanceRow({
        id: 'attendance_wait_1',
        playerId: 'ply_wait_1',
        status: 'waitlisted',
        waitlistPosition: 1,
      }),
    );
    const findMany = jest.fn().mockResolvedValue([
      createAttendanceRow({
        id: 'attendance_wait_2',
        playerId: 'ply_wait_2',
        status: 'waitlisted',
        waitlistPosition: 2,
      }),
    ]);
    const update = jest.fn().mockResolvedValue(createAttendanceRow());
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
        findFirst: matchFindFirst,
        attendanceCount: count,
        attendanceFindFirst,
        attendanceFindUnique: findUnique,
        attendanceFindMany: findMany,
        attendanceUpdate: update,
      }),
    );

    await expect(
      service.submitAttendance('user_123', 'grp_123', 'match_123', {
        response: 'out',
      }),
    ).resolves.toMatchObject({
      confirmedCount: 10,
      waitlistCount: 1,
      myAttendance: {
        response: 'out',
        status: 'out',
      },
    });

    expect(update).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'attendance_wait_1',
      },
      data: {
        response: 'in',
        status: 'confirmed',
        waitlistPosition: null,
        respondedAt: expect.any(Date) as Date,
      },
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      where: {
        id: 'attendance_wait_2',
      },
      data: {
        waitlistPosition: 1,
      },
    });
  });
});

function createPrismaMock({
  role,
  create = jest.fn(),
  findFirst = jest.fn(),
  attendanceCount = jest.fn().mockResolvedValue(0),
  attendanceFindFirst = jest.fn().mockResolvedValue(null),
  attendanceFindMany = jest.fn().mockResolvedValue([]),
  attendanceFindUnique = jest.fn().mockResolvedValue(null),
  attendanceUpdate = jest.fn().mockResolvedValue(createAttendanceRow()),
  attendanceUpsert = jest.fn(),
}: {
  role: string;
  create?: jest.Mock;
  findFirst?: jest.Mock;
  attendanceCount?: jest.Mock;
  attendanceFindFirst?: jest.Mock;
  attendanceFindMany?: jest.Mock;
  attendanceFindUnique?: jest.Mock;
  attendanceUpdate?: jest.Mock;
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
      findFirst: attendanceFindFirst,
      findMany: attendanceFindMany,
      findUnique: attendanceFindUnique,
      update: attendanceUpdate,
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
    id: string;
    matchId: string;
    playerId: string;
    response: string;
    status: string;
    waitlistPosition: number | null;
  }> = {},
) {
  return {
    id: overrides.id ?? 'attendance_123',
    matchId: overrides.matchId ?? 'match_123',
    playerId: overrides.playerId ?? 'ply_123',
    response: overrides.response ?? 'in',
    status: overrides.status ?? 'confirmed',
    waitlistPosition: overrides.waitlistPosition ?? null,
    respondedAt: new Date('2026-06-03T02:00:00.000Z'),
    createdAt: new Date('2026-06-03T02:00:00.000Z'),
    updatedAt: new Date('2026-06-03T02:00:00.000Z'),
  };
}
