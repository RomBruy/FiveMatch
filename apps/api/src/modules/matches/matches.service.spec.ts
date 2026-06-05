import { ConflictException, ForbiddenException } from '@nestjs/common';
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

  it('generates and saves a team version from a ready confirmed pool', async () => {
    const attendanceFindMany = jest.fn().mockResolvedValue(
      createConfirmedAttendances([
        ['ply_1', 'attacker'],
        ['ply_2', 'goalkeeper'],
        ['ply_3', 'defender'],
        ['ply_4', 'midfielder'],
        ['ply_5', 'attacker'],
        ['ply_6', 'goalkeeper'],
        ['ply_7', 'defender'],
        ['ply_8', 'midfielder'],
        ['ply_9', 'all_rounder'],
        ['ply_10', 'attacker'],
      ]),
    );
    const ratingFindMany = jest
      .fn()
      .mockResolvedValue(createInitialRatingRows());
    const generationCreate = jest
      .fn()
      .mockImplementation(({ data }: { data: TeamGenerationRowOverrides }) =>
        Promise.resolve(
          createTeamGenerationRow({
            ...data,
            id: 'generation_123',
            createdAt: new Date('2026-06-03T03:00:00.000Z'),
            updatedAt: new Date('2026-06-03T03:00:00.000Z'),
          }),
        ),
      );
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest.fn().mockResolvedValue(
          createMatchRow({
            group: {
              settings: {
                generatorStyle: 'max_fairness',
                goalkeeperMode: 'fixed_goalkeeper',
              },
            },
          }),
        ),
        attendanceFindMany,
        ratingFindMany,
        generationCount: jest.fn().mockResolvedValue(0),
        generationCreate,
      }),
    );

    await expect(
      service.generateTeamVersion('user_123', 'grp_123', 'match_123'),
    ).resolves.toMatchObject({
      id: 'generation_123',
      matchId: 'match_123',
      versionNumber: 1,
      seed: 'match_123:v1',
      teamA: {
        players: expect.any(Array) as unknown[],
      },
      teamB: {
        players: expect.any(Array) as unknown[],
      },
      fairnessPercentage: expect.any(Number) as number,
      inputSnapshot: {
        generatorStyle: 'max_fairness',
        goalkeeperMode: 'fixed_goalkeeper',
        playerRatings: expect.arrayContaining([
          expect.objectContaining({
            playerId: 'ply_1',
            ratingsReceived: 3,
          }) as object,
        ]) as unknown[],
      },
    });

    expect(generationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        matchId: 'match_123',
        generatedByUserId: 'usr_123',
        versionNumber: 1,
        seed: 'match_123:v1',
        fairnessPercentage: expect.any(Number) as number,
        inputSnapshot: expect.objectContaining({
          playersPerTeam: 5,
        }) as object,
        scoreComponents: expect.objectContaining({
          ratingGap: expect.any(Number) as number,
        }) as object,
      }) as object,
    });
  });

  it('returns the latest saved team generation for group members', async () => {
    const generationFindFirst = jest
      .fn()
      .mockResolvedValue(createTeamGenerationRow({ versionNumber: 2 }));
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
        findFirst: jest.fn().mockResolvedValue(createMatchRow()),
        generationFindFirst,
      }),
    );

    await expect(
      service.getLatestTeamGeneration('user_123', 'grp_123', 'match_123'),
    ).resolves.toMatchObject({
      id: 'generation_123',
      matchId: 'match_123',
      versionNumber: 2,
      fairnessPercentage: 100,
    });

    expect(generationFindFirst).toHaveBeenCalledWith({
      where: {
        matchId: 'match_123',
      },
      orderBy: {
        versionNumber: 'desc',
      },
    });
  });

  it('returns null when no saved team generation exists yet', async () => {
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
        findFirst: jest.fn().mockResolvedValue(createMatchRow()),
        generationFindFirst: jest.fn().mockResolvedValue(null),
      }),
    );

    await expect(
      service.getLatestTeamGeneration('user_123', 'grp_123', 'match_123'),
    ).resolves.toBeNull();
  });

  it('blocks generation when confirmed players are below the rating threshold', async () => {
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest.fn().mockResolvedValue(
          createMatchRow({
            group: {
              settings: {
                generatorStyle: 'fair_fresh',
                goalkeeperMode: 'rotating_goalkeeper',
              },
            },
          }),
        ),
        attendanceFindMany: jest.fn().mockResolvedValue(
          createConfirmedAttendances([
            ['ply_1', 'attacker'],
            ['ply_2', 'goalkeeper'],
            ['ply_3', 'defender'],
            ['ply_4', 'midfielder'],
            ['ply_5', 'attacker'],
            ['ply_6', 'goalkeeper'],
            ['ply_7', 'defender'],
            ['ply_8', 'midfielder'],
            ['ply_9', 'all_rounder'],
            ['ply_10', 'attacker'],
          ]),
        ),
        ratingFindMany: jest
          .fn()
          .mockResolvedValue(
            createInitialRatingRows().filter(
              (rating) => rating.ratedPlayerId !== 'ply_10',
            ),
          ),
      }),
    );

    await expect(
      service.generateTeamVersion('user_123', 'grp_123', 'match_123'),
    ).rejects.toBeInstanceOf(ConflictException);
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
  ratingFindMany = jest.fn().mockResolvedValue([]),
  generationCount = jest.fn().mockResolvedValue(0),
  generationCreate = jest.fn(),
  generationFindFirst = jest.fn().mockResolvedValue(null),
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
  ratingFindMany?: jest.Mock;
  generationCount?: jest.Mock;
  generationCreate?: jest.Mock;
  generationFindFirst?: jest.Mock;
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
    initialPeerRating: {
      findMany: ratingFindMany,
    },
    teamGenerationVersion: {
      count: generationCount,
      create: generationCreate,
      findFirst: generationFindFirst,
    },
  } as unknown as PrismaService;
}

function createMatchRow(
  overrides: Partial<{
    group: {
      settings: {
        generatorStyle: string;
        goalkeeperMode: string;
      };
    };
  }> = {},
) {
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
    group: overrides.group,
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

function createConfirmedAttendances(
  players: Array<[playerId: string, preferredStyle: string]>,
) {
  return players.map(([playerId, preferredStyle], index) => ({
    ...createAttendanceRow({
      id: `attendance_${playerId}`,
      playerId,
      status: 'confirmed',
    }),
    respondedAt: new Date(
      `2026-06-03T02:${String(index).padStart(2, '0')}:00.000Z`,
    ),
    player: {
      id: playerId,
      preferredStyle,
    },
  }));
}

function createInitialRatingRows() {
  const ratings = [
    ['ply_1', 88],
    ['ply_2', 83],
    ['ply_3', 81],
    ['ply_4', 79],
    ['ply_5', 76],
    ['ply_6', 74],
    ['ply_7', 71],
    ['ply_8', 69],
    ['ply_9', 66],
    ['ply_10', 62],
  ] as const;

  return ratings.flatMap(([ratedPlayerId, overall]) =>
    [1, 2, 3].map((index) => ({
      id: `rating_${ratedPlayerId}_${index}`,
      groupId: 'grp_123',
      raterPlayerId: `rater_${index}`,
      ratedPlayerId,
      attributeSet: 'standard',
      overall,
      speed: overall,
      attack: overall,
      technique: overall,
      defense: overall,
      reflexes: null,
      positioning: null,
      handling: null,
      distribution: null,
      communication: null,
      physical: overall,
      stamina: overall,
      fun: overall,
      lockedAt: null,
      createdAt: new Date('2026-06-03T01:00:00.000Z'),
      updatedAt: new Date('2026-06-03T01:00:00.000Z'),
    })),
  );
}

type TeamGenerationRowOverrides = Partial<{
  id: string;
  matchId: string;
  generatedByUserId: string;
  versionNumber: number;
  seed: string;
  algorithmVersion: string;
  status: string;
  teamA: unknown;
  teamB: unknown;
  teamATotal: number;
  teamBTotal: number;
  fairnessPercentage: number;
  inputSnapshot: unknown;
  scoreComponents: unknown;
  explanation: unknown;
  createdAt: Date;
  updatedAt: Date;
}>;

function createTeamGenerationRow(overrides: TeamGenerationRowOverrides = {}) {
  return {
    id: overrides.id ?? 'generation_123',
    matchId: overrides.matchId ?? 'match_123',
    generatedByUserId: overrides.generatedByUserId ?? 'usr_123',
    versionNumber: overrides.versionNumber ?? 1,
    seed: overrides.seed ?? 'match_123:v1',
    algorithmVersion: overrides.algorithmVersion ?? 'team-generator-v1',
    status: overrides.status ?? 'draft',
    teamA: overrides.teamA ?? {
      label: 'A',
      totalRating: 0,
      averageRating: 0,
      players: [],
    },
    teamB: overrides.teamB ?? {
      label: 'B',
      totalRating: 0,
      averageRating: 0,
      players: [],
    },
    teamATotal: overrides.teamATotal ?? 0,
    teamBTotal: overrides.teamBTotal ?? 0,
    fairnessPercentage: overrides.fairnessPercentage ?? 100,
    inputSnapshot: overrides.inputSnapshot ?? {
      matchId: 'match_123',
      groupId: 'grp_123',
      playersPerTeam: 5,
      generatorStyle: 'fair_fresh',
      goalkeeperMode: 'rotating_goalkeeper',
      playerRatings: [],
    },
    scoreComponents: overrides.scoreComponents ?? {
      ratingGap: 0,
      positionImbalance: 0,
      goalkeeperImbalance: 0,
      randomness: 0,
      candidateScore: 0,
    },
    explanation: overrides.explanation ?? {
      summary: 'Balanced teams generated.',
      bullets: [],
    },
    createdAt: overrides.createdAt ?? new Date('2026-06-03T03:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-06-03T03:00:00.000Z'),
  };
}
