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
        status: {
          in: ['open', 'locked'],
        },
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

  it('submits final score for a locked match idempotently', async () => {
    const matchUpdate = jest.fn().mockResolvedValue(
      createMatchRow({
        status: 'locked',
        teamAScore: 7,
        teamBScore: 5,
        scoreSubmittedByUserId: 'usr_123',
        scoreSubmittedAt: new Date('2026-06-10T21:10:00.000Z'),
      }),
    );
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest
          .fn()
          .mockResolvedValue(createMatchRow({ status: 'locked' })),
        matchUpdate,
        generationFindFirst: jest.fn().mockResolvedValue({
          id: 'generation_locked',
        }),
      }),
    );

    await expect(
      service.submitFinalScore('user_123', 'grp_123', 'match_123', {
        teamAScore: 7,
        teamBScore: 5,
      }),
    ).resolves.toMatchObject({
      id: 'match_123',
      status: 'locked',
      score: {
        teamAScore: 7,
        teamBScore: 5,
        submittedByUserId: 'usr_123',
      },
    });

    expect(matchUpdate).toHaveBeenCalledWith({
      where: {
        id: 'match_123',
      },
      data: {
        teamAScore: 7,
        teamBScore: 5,
        scoreSubmittedByUserId: 'usr_123',
        scoreSubmittedAt: expect.any(Date) as Date,
      },
    });
  });

  it('edits final score while match completion is not finalized', async () => {
    const matchUpdate = jest.fn().mockResolvedValue(
      createMatchRow({
        status: 'locked',
        teamAScore: 8,
        teamBScore: 6,
        scoreSubmittedByUserId: 'usr_123',
        scoreSubmittedAt: new Date('2026-06-10T21:20:00.000Z'),
      }),
    );
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest.fn().mockResolvedValue(
          createMatchRow({
            status: 'locked',
            teamAScore: 7,
            teamBScore: 5,
            scoreSubmittedByUserId: 'usr_123',
            scoreSubmittedAt: new Date('2026-06-10T21:10:00.000Z'),
          }),
        ),
        matchUpdate,
        generationFindFirst: jest.fn().mockResolvedValue({
          id: 'generation_locked',
        }),
      }),
    );

    await expect(
      service.submitFinalScore('user_123', 'grp_123', 'match_123', {
        teamAScore: 8,
        teamBScore: 6,
      }),
    ).resolves.toMatchObject({
      score: {
        teamAScore: 8,
        teamBScore: 6,
      },
    });

    expect(matchUpdate).toHaveBeenCalledWith({
      where: {
        id: 'match_123',
      },
      data: expect.objectContaining({
        teamAScore: 8,
        teamBScore: 6,
      }) as object,
    });
  });

  it('does not rewrite score metadata for a duplicate score submission', async () => {
    const submittedAt = new Date('2026-06-10T21:10:00.000Z');
    const matchUpdate = jest.fn();
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest.fn().mockResolvedValue(
          createMatchRow({
            status: 'locked',
            teamAScore: 7,
            teamBScore: 5,
            scoreSubmittedByUserId: 'usr_123',
            scoreSubmittedAt: submittedAt,
          }),
        ),
        matchUpdate,
        generationFindFirst: jest.fn().mockResolvedValue({
          id: 'generation_locked',
        }),
      }),
    );

    await expect(
      service.submitFinalScore('user_123', 'grp_123', 'match_123', {
        teamAScore: 7,
        teamBScore: 5,
      }),
    ).resolves.toMatchObject({
      score: {
        teamAScore: 7,
        teamBScore: 5,
        submittedAt,
      },
    });
    expect(matchUpdate).not.toHaveBeenCalled();
  });

  it('blocks final score submission before teams are locked', async () => {
    const matchUpdate = jest.fn();
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest.fn().mockResolvedValue(createMatchRow()),
        matchUpdate,
      }),
    );

    await expect(
      service.submitFinalScore('user_123', 'grp_123', 'match_123', {
        teamAScore: 7,
        teamBScore: 5,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(matchUpdate).not.toHaveBeenCalled();
  });

  it('saves goals and assists for locked team players', async () => {
    const eventUpsert = jest
      .fn()
      .mockResolvedValue(createMatchEventRow({ playerId: 'ply_a_1' }));
    const eventDeleteMany = jest.fn().mockResolvedValue({ count: 0 });
    const eventFindMany = jest.fn().mockResolvedValue([
      createMatchEventRow({
        playerId: 'ply_a_1',
        kind: 'goal',
        count: 2,
      }),
      createMatchEventRow({
        id: 'event_assist_1',
        playerId: 'ply_a_1',
        kind: 'assist',
        count: 1,
      }),
    ]);
    const transaction = jest.fn(async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    );
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest.fn().mockResolvedValue(
          createMatchRow({
            status: 'locked',
            teamAScore: 7,
            teamBScore: 5,
            scoreSubmittedByUserId: 'usr_123',
            scoreSubmittedAt: new Date('2026-06-10T21:10:00.000Z'),
          }),
        ),
        generationFindFirst: jest
          .fn()
          .mockResolvedValue(createTeamGenerationRow(createSwappableTeams())),
        eventDeleteMany,
        eventFindMany,
        eventUpsert,
        transaction,
      }),
    );

    await expect(
      service.upsertMatchPlayerEvents('user_123', 'grp_123', 'match_123', {
        players: [
          {
            playerId: 'ply_a_1',
            goals: 2,
            assists: 1,
          },
          {
            playerId: 'ply_b_1',
            goals: 0,
            assists: 0,
          },
        ],
      }),
    ).resolves.toMatchObject({
      events: [
        {
          playerId: 'ply_a_1',
          kind: 'goal',
          count: 2,
        },
        {
          playerId: 'ply_a_1',
          kind: 'assist',
          count: 1,
        },
      ],
    });

    expect(eventUpsert).toHaveBeenCalledWith({
      where: {
        matchId_playerId_kind: {
          matchId: 'match_123',
          playerId: 'ply_a_1',
          kind: 'goal',
        },
      },
      create: expect.objectContaining({
        count: 2,
        recordedByUserId: 'usr_123',
      }) as object,
      update: {
        count: 2,
        recordedByUserId: 'usr_123',
      },
    });
    expect(eventDeleteMany).toHaveBeenCalledWith({
      where: {
        matchId: 'match_123',
        playerId: 'ply_b_1',
        kind: 'goal',
      },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects goals and assists for players outside locked teams', async () => {
    const eventUpsert = jest.fn();
    const transaction = jest.fn();
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest.fn().mockResolvedValue(
          createMatchRow({
            status: 'locked',
            teamAScore: 7,
            teamBScore: 5,
            scoreSubmittedByUserId: 'usr_123',
            scoreSubmittedAt: new Date('2026-06-10T21:10:00.000Z'),
          }),
        ),
        generationFindFirst: jest
          .fn()
          .mockResolvedValue(createTeamGenerationRow(createSwappableTeams())),
        eventUpsert,
        transaction,
      }),
    );

    await expect(
      service.upsertMatchPlayerEvents('user_123', 'grp_123', 'match_123', {
        players: [
          {
            playerId: 'ply_not_locked',
            goals: 1,
            assists: 0,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(eventUpsert).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('blocks goals and assists before score is submitted', async () => {
    const transaction = jest.fn();
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest
          .fn()
          .mockResolvedValue(createMatchRow({ status: 'locked' })),
        transaction,
      }),
    );

    await expect(
      service.upsertMatchPlayerEvents('user_123', 'grp_123', 'match_123', {
        players: [
          {
            playerId: 'ply_a_1',
            goals: 1,
            assists: 0,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('saves one MVP vote for a confirmed locked-team player', async () => {
    const vote = createMvpVoteRow({
      voterPlayerId: 'ply_a_1',
      votedPlayerId: 'ply_b_1',
    });
    const mvpVoteCreate = jest.fn().mockResolvedValue(vote);
    const mvpVoteFindMany = jest.fn().mockResolvedValue([vote]);
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
        playerFindUnique: jest.fn().mockResolvedValue({
          id: 'ply_a_1',
        }),
        findFirst: jest
          .fn()
          .mockResolvedValue(createMatchRow({ status: 'locked' })),
        attendanceFindUnique: jest.fn().mockResolvedValue(
          createAttendanceRow({
            playerId: 'ply_a_1',
            status: 'confirmed',
          }),
        ),
        generationFindFirst: jest
          .fn()
          .mockResolvedValue(createTeamGenerationRow(createSwappableTeams())),
        mvpVoteCreate,
        mvpVoteFindMany,
      }),
    );

    await expect(
      service.submitMvpVote('user_123', 'grp_123', 'match_123', {
        votedPlayerId: 'ply_b_1',
      }),
    ).resolves.toMatchObject({
      vote: {
        voterPlayerId: 'ply_a_1',
        votedPlayerId: 'ply_b_1',
      },
      match: {
        mvpVotes: [
          {
            voterPlayerId: 'ply_a_1',
            votedPlayerId: 'ply_b_1',
          },
        ],
        myMvpVote: {
          votedPlayerId: 'ply_b_1',
        },
      },
    });

    expect(mvpVoteCreate).toHaveBeenCalledWith({
      data: {
        matchId: 'match_123',
        voterPlayerId: 'ply_a_1',
        votedPlayerId: 'ply_b_1',
      },
    });
  });

  it('blocks duplicate MVP votes from the same voter', async () => {
    const mvpVoteCreate = jest.fn();
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
        playerFindUnique: jest.fn().mockResolvedValue({
          id: 'ply_a_1',
        }),
        findFirst: jest
          .fn()
          .mockResolvedValue(createMatchRow({ status: 'locked' })),
        attendanceFindUnique: jest.fn().mockResolvedValue(
          createAttendanceRow({
            playerId: 'ply_a_1',
            status: 'confirmed',
          }),
        ),
        generationFindFirst: jest
          .fn()
          .mockResolvedValue(createTeamGenerationRow(createSwappableTeams())),
        mvpVoteFindUnique: jest
          .fn()
          .mockResolvedValue(createMvpVoteRow({ voterPlayerId: 'ply_a_1' })),
        mvpVoteCreate,
      }),
    );

    await expect(
      service.submitMvpVote('user_123', 'grp_123', 'match_123', {
        votedPlayerId: 'ply_b_1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mvpVoteCreate).not.toHaveBeenCalled();
  });

  it('blocks self MVP votes', async () => {
    const mvpVoteCreate = jest.fn();
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
        playerFindUnique: jest.fn().mockResolvedValue({
          id: 'ply_a_1',
        }),
        findFirst: jest
          .fn()
          .mockResolvedValue(createMatchRow({ status: 'locked' })),
        attendanceFindUnique: jest.fn().mockResolvedValue(
          createAttendanceRow({
            playerId: 'ply_a_1',
            status: 'confirmed',
          }),
        ),
        generationFindFirst: jest
          .fn()
          .mockResolvedValue(createTeamGenerationRow(createSwappableTeams())),
        mvpVoteCreate,
      }),
    );

    await expect(
      service.submitMvpVote('user_123', 'grp_123', 'match_123', {
        votedPlayerId: 'ply_a_1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mvpVoteCreate).not.toHaveBeenCalled();
  });

  it('blocks MVP votes from players who were not confirmed', async () => {
    const mvpVoteCreate = jest.fn();
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
        playerFindUnique: jest.fn().mockResolvedValue({
          id: 'ply_a_1',
        }),
        findFirst: jest
          .fn()
          .mockResolvedValue(createMatchRow({ status: 'locked' })),
        attendanceFindUnique: jest.fn().mockResolvedValue(
          createAttendanceRow({
            playerId: 'ply_a_1',
            status: 'out',
          }),
        ),
        mvpVoteCreate,
      }),
    );

    await expect(
      service.submitMvpVote('user_123', 'grp_123', 'match_123', {
        votedPlayerId: 'ply_b_1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mvpVoteCreate).not.toHaveBeenCalled();
  });

  it('blocks MVP votes for players outside locked teams', async () => {
    const mvpVoteCreate = jest.fn();
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
        playerFindUnique: jest.fn().mockResolvedValue({
          id: 'ply_a_1',
        }),
        findFirst: jest
          .fn()
          .mockResolvedValue(createMatchRow({ status: 'locked' })),
        attendanceFindUnique: jest.fn().mockResolvedValue(
          createAttendanceRow({
            playerId: 'ply_a_1',
            status: 'confirmed',
          }),
        ),
        generationFindFirst: jest
          .fn()
          .mockResolvedValue(createTeamGenerationRow(createSwappableTeams())),
        mvpVoteCreate,
      }),
    );

    await expect(
      service.submitMvpVote('user_123', 'grp_123', 'match_123', {
        votedPlayerId: 'ply_not_locked',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(mvpVoteCreate).not.toHaveBeenCalled();
  });

  it('saves quick ratings for every opponent', async () => {
    const completion = createOpponentRatingCompletionRow({
      status: 'submitted',
    });
    const opponentRatingUpsert = jest
      .fn()
      .mockResolvedValueOnce(
        createOpponentRatingRow({
          ratedPlayerId: 'ply_b_1',
          rating: 82,
          tags: ['fast'],
        }),
      )
      .mockResolvedValueOnce(
        createOpponentRatingRow({
          id: 'opponent_rating_2',
          ratedPlayerId: 'ply_b_2',
          rating: 76,
          tags: ['technical'],
        }),
      );
    const opponentRatingCompletionUpsert = jest
      .fn()
      .mockResolvedValue(completion);
    const transaction = jest.fn(async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    );
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
        playerFindUnique: jest.fn().mockResolvedValue({
          id: 'ply_a_1',
        }),
        findFirst: jest
          .fn()
          .mockResolvedValue(createMatchRow({ status: 'locked' })),
        attendanceFindUnique: jest.fn().mockResolvedValue(
          createAttendanceRow({
            playerId: 'ply_a_1',
            status: 'confirmed',
          }),
        ),
        generationFindFirst: jest
          .fn()
          .mockResolvedValue(createTeamGenerationRow(createSwappableTeams())),
        opponentRatingCompletionFindUnique: jest
          .fn()
          .mockResolvedValue(completion),
        opponentRatingCompletionUpsert,
        opponentRatingUpsert,
        transaction,
      }),
    );

    await expect(
      service.submitOpponentRatings('user_123', 'grp_123', 'match_123', {
        ratings: [
          {
            ratedPlayerId: 'ply_b_1',
            rating: 82,
            tags: ['fast'],
          },
          {
            ratedPlayerId: 'ply_b_2',
            rating: 76,
            tags: ['technical'],
          },
        ],
      }),
    ).resolves.toMatchObject({
      ratings: [
        {
          ratedPlayerId: 'ply_b_1',
          rating: 82,
          tags: ['fast'],
        },
        {
          ratedPlayerId: 'ply_b_2',
          rating: 76,
          tags: ['technical'],
        },
      ],
      completion: {
        status: 'submitted',
      },
      match: {
        myOpponentRatingCompletion: {
          status: 'submitted',
        },
      },
    });

    expect(opponentRatingUpsert).toHaveBeenCalledWith({
      where: {
        matchId_raterPlayerId_ratedPlayerId: {
          matchId: 'match_123',
          raterPlayerId: 'ply_a_1',
          ratedPlayerId: 'ply_b_1',
        },
      },
      create: expect.objectContaining({
        rating: 82,
        tags: ['fast'],
      }) as object,
      update: {
        rating: 82,
        tags: ['fast'],
      },
    });
    expect(opponentRatingCompletionUpsert).toHaveBeenCalledWith({
      where: {
        matchId_playerId: {
          matchId: 'match_123',
          playerId: 'ply_a_1',
        },
      },
      create: expect.objectContaining({
        status: 'submitted',
      }) as object,
      update: {
        status: 'submitted',
      },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects quick ratings when not every opponent is rated', async () => {
    const opponentRatingUpsert = jest.fn();
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
        playerFindUnique: jest.fn().mockResolvedValue({
          id: 'ply_a_1',
        }),
        findFirst: jest
          .fn()
          .mockResolvedValue(createMatchRow({ status: 'locked' })),
        attendanceFindUnique: jest.fn().mockResolvedValue(
          createAttendanceRow({
            playerId: 'ply_a_1',
            status: 'confirmed',
          }),
        ),
        generationFindFirst: jest
          .fn()
          .mockResolvedValue(createTeamGenerationRow(createSwappableTeams())),
        opponentRatingUpsert,
      }),
    );

    await expect(
      service.submitOpponentRatings('user_123', 'grp_123', 'match_123', {
        ratings: [
          {
            ratedPlayerId: 'ply_b_1',
            rating: 82,
            tags: [],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(opponentRatingUpsert).not.toHaveBeenCalled();
  });

  it('rejects quick ratings for teammates and self', async () => {
    const opponentRatingUpsert = jest.fn();
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
        playerFindUnique: jest.fn().mockResolvedValue({
          id: 'ply_a_1',
        }),
        findFirst: jest
          .fn()
          .mockResolvedValue(createMatchRow({ status: 'locked' })),
        attendanceFindUnique: jest.fn().mockResolvedValue(
          createAttendanceRow({
            playerId: 'ply_a_1',
            status: 'confirmed',
          }),
        ),
        generationFindFirst: jest
          .fn()
          .mockResolvedValue(createTeamGenerationRow(createSwappableTeams())),
        opponentRatingUpsert,
      }),
    );

    await expect(
      service.submitOpponentRatings('user_123', 'grp_123', 'match_123', {
        ratings: [
          {
            ratedPlayerId: 'ply_a_1',
            rating: 82,
            tags: [],
          },
          {
            ratedPlayerId: 'ply_a_2',
            rating: 76,
            tags: [],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(opponentRatingUpsert).not.toHaveBeenCalled();
  });

  it('allows confirmed players to skip quick opponent ratings', async () => {
    const completion = createOpponentRatingCompletionRow({
      status: 'skipped',
    });
    const opponentRatingCompletionUpsert = jest
      .fn()
      .mockResolvedValue(completion);
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
        playerFindUnique: jest.fn().mockResolvedValue({
          id: 'ply_a_1',
        }),
        findFirst: jest
          .fn()
          .mockResolvedValue(createMatchRow({ status: 'locked' })),
        attendanceFindUnique: jest.fn().mockResolvedValue(
          createAttendanceRow({
            playerId: 'ply_a_1',
            status: 'confirmed',
          }),
        ),
        generationFindFirst: jest
          .fn()
          .mockResolvedValue(createTeamGenerationRow(createSwappableTeams())),
        opponentRatingCompletionFindUnique: jest
          .fn()
          .mockResolvedValue(completion),
        opponentRatingCompletionUpsert,
      }),
    );

    await expect(
      service.skipOpponentRatings('user_123', 'grp_123', 'match_123'),
    ).resolves.toMatchObject({
      completion: {
        status: 'skipped',
      },
      match: {
        myOpponentRatingCompletion: {
          status: 'skipped',
        },
      },
    });

    expect(opponentRatingCompletionUpsert).toHaveBeenCalledWith({
      where: {
        matchId_playerId: {
          matchId: 'match_123',
          playerId: 'ply_a_1',
        },
      },
      create: expect.objectContaining({
        status: 'skipped',
      }) as object,
      update: {
        status: 'skipped',
      },
    });
  });

  it('finalizes a locked match and evolves ratings slower than form', async () => {
    const finalizedAt = new Date('2026-06-10T21:45:00.000Z');
    const matchUpdate = jest.fn().mockResolvedValue(
      createMatchRow({
        status: 'completed',
        teamAScore: 7,
        teamBScore: 5,
        scoreSubmittedByUserId: 'usr_123',
        scoreSubmittedAt: new Date('2026-06-10T21:10:00.000Z'),
        finalizedByUserId: 'usr_123',
        finalizedAt,
      }),
    );
    const playerRatingStateUpsert = jest.fn().mockResolvedValue({});
    const matchPlayerStatUpsert = jest.fn().mockResolvedValue({});
    const playerRatingHistoryUpsert = jest.fn().mockResolvedValue({});
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest.fn().mockResolvedValue(
          createMatchRow({
            status: 'locked',
            teamAScore: 7,
            teamBScore: 5,
            scoreSubmittedByUserId: 'usr_123',
            scoreSubmittedAt: new Date('2026-06-10T21:10:00.000Z'),
          }),
        ),
        generationFindFirst: jest.fn().mockResolvedValue(
          createTeamGenerationRow({
            ...createSwappableTeams(),
            status: 'locked',
          }),
        ),
        ratingFindMany: jest.fn().mockResolvedValue(
          createInitialRatingRowsForPlayers([
            ['ply_a_1', 80],
            ['ply_a_2', 70],
            ['ply_b_1', 84],
            ['ply_b_2', 64],
          ]),
        ),
        ratingStateFindMany: jest.fn().mockResolvedValue([
          createPlayerRatingStateRow({
            playerId: 'ply_a_1',
            overallRating: 80,
            formRating: 70,
          }),
        ]),
        eventFindMany: jest.fn().mockResolvedValue([
          createMatchEventRow({
            playerId: 'ply_a_1',
            kind: 'goal',
            count: 2,
          }),
          createMatchEventRow({
            id: 'event_assist_1',
            playerId: 'ply_a_1',
            kind: 'assist',
            count: 1,
          }),
        ]),
        mvpVoteFindMany: jest.fn().mockResolvedValue([
          createMvpVoteRow({
            id: 'mvp_vote_1',
            voterPlayerId: 'ply_b_1',
            votedPlayerId: 'ply_a_1',
          }),
          createMvpVoteRow({
            id: 'mvp_vote_2',
            voterPlayerId: 'ply_b_2',
            votedPlayerId: 'ply_a_1',
          }),
        ]),
        opponentRatingFindMany: jest.fn().mockResolvedValue([
          createOpponentRatingRow({
            id: 'rating_good_1',
            raterPlayerId: 'ply_b_1',
            ratedPlayerId: 'ply_a_1',
            rating: 90,
          }),
          createOpponentRatingRow({
            id: 'rating_good_2',
            raterPlayerId: 'ply_b_2',
            ratedPlayerId: 'ply_a_1',
            rating: 92,
          }),
          createOpponentRatingRow({
            id: 'rating_extreme_1',
            raterPlayerId: 'ply_b_3',
            ratedPlayerId: 'ply_a_1',
            rating: 1,
          }),
        ]),
        playerRatingStateUpsert,
        matchPlayerStatUpsert,
        playerRatingHistoryUpsert,
        matchUpdate,
      }),
    );

    await expect(
      service.finalizeMatch('user_123', 'grp_123', 'match_123'),
    ).resolves.toMatchObject({
      status: 'completed',
      finalization: {
        finalizedByUserId: 'usr_123',
        finalizedAt,
      },
    });

    expect(playerRatingStateUpsert).toHaveBeenCalledWith({
      where: {
        playerId: 'ply_a_1',
      },
      create: expect.objectContaining({
        overallRating: 82.4,
        formRating: 80.5,
      }) as object,
      update: expect.objectContaining({
        overallRating: 82.4,
        formRating: 80.5,
      }) as object,
    });
    expect(matchPlayerStatUpsert).toHaveBeenCalledWith({
      where: {
        matchId_playerId: {
          matchId: 'match_123',
          playerId: 'ply_a_1',
        },
      },
      create: expect.objectContaining({
        result: 'win',
        goals: 2,
        assists: 1,
        mvpVotes: 2,
        mvpAwarded: true,
        opponentAverageRating: 91,
        performanceScore: 100,
        overallBefore: 80,
        overallAfter: 82.4,
        formBefore: 70,
        formAfter: 80.5,
      }) as object,
      update: expect.objectContaining({
        overallAfter: 82.4,
        formAfter: 80.5,
      }) as object,
    });
    expect(playerRatingHistoryUpsert).toHaveBeenCalledWith({
      where: {
        matchId_playerId: {
          matchId: 'match_123',
          playerId: 'ply_a_1',
        },
      },
      create: expect.objectContaining({
        overallDelta: 2.4,
        formDelta: 10.5,
        reason: expect.objectContaining({
          antiAbuse: expect.objectContaining({
            method: 'median-distance-filter',
          }) as object,
          opponentRatings: expect.objectContaining({
            ignoredExtremeRatings: 1,
            average: 91,
          }) as object,
        }) as object,
      }) as object,
      update: expect.objectContaining({
        overallDelta: 2.4,
        formDelta: 10.5,
      }) as object,
    });
    expect(matchUpdate).toHaveBeenCalledWith({
      where: {
        id: 'match_123',
      },
      data: {
        status: 'completed',
        finalizedByUserId: 'usr_123',
        finalizedAt: expect.any(Date) as Date,
      },
    });
  });

  it('blocks finalization before a final score is submitted', async () => {
    const transaction = jest.fn();
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest
          .fn()
          .mockResolvedValue(createMatchRow({ status: 'locked' })),
        transaction,
      }),
    );

    await expect(
      service.finalizeMatch('user_123', 'grp_123', 'match_123'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('returns an already completed match without applying evolution again', async () => {
    const transaction = jest.fn();
    const finalizedAt = new Date('2026-06-10T21:45:00.000Z');
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest.fn().mockResolvedValue(
          createMatchRow({
            status: 'completed',
            teamAScore: 7,
            teamBScore: 5,
            scoreSubmittedByUserId: 'usr_123',
            scoreSubmittedAt: new Date('2026-06-10T21:10:00.000Z'),
            finalizedByUserId: 'usr_123',
            finalizedAt,
          }),
        ),
        transaction,
      }),
    );

    await expect(
      service.finalizeMatch('user_123', 'grp_123', 'match_123'),
    ).resolves.toMatchObject({
      status: 'completed',
      finalization: {
        finalizedByUserId: 'usr_123',
        finalizedAt,
      },
    });
    expect(transaction).not.toHaveBeenCalled();
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

  it('regenerates as the next saved version while keeping prior versions', async () => {
    const generationCreate = jest
      .fn()
      .mockImplementation(({ data }: { data: TeamGenerationRowOverrides }) =>
        Promise.resolve(createTeamGenerationRow({ ...data })),
      );
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest.fn().mockResolvedValue(
          createMatchRow({
            group: {
              settings: {
                generatorStyle: 'more_variety',
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
        ratingFindMany: jest.fn().mockResolvedValue(createInitialRatingRows()),
        generationCount: jest.fn().mockResolvedValue(1),
        generationCreate,
      }),
    );

    await expect(
      service.generateTeamVersion('user_123', 'grp_123', 'match_123'),
    ).resolves.toMatchObject({
      versionNumber: 2,
      seed: 'match_123:v2',
    });

    expect(generationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        versionNumber: 2,
        seed: 'match_123:v2',
      }) as object,
    });
  });

  it('blocks regeneration after five saved versions', async () => {
    const generationCreate = jest.fn();
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
        generationCount: jest.fn().mockResolvedValue(5),
        generationCreate,
      }),
    );

    await expect(
      service.generateTeamVersion('user_123', 'grp_123', 'match_123'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(generationCreate).not.toHaveBeenCalled();
  });

  it('blocks regeneration once a team version is locked', async () => {
    const generationCreate = jest.fn();
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
        generationFindFirst: jest.fn().mockResolvedValue({
          id: 'generation_locked',
        }),
        generationCount: jest.fn().mockResolvedValue(1),
        generationCreate,
      }),
    );

    await expect(
      service.generateTeamVersion('user_123', 'grp_123', 'match_123'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(generationCreate).not.toHaveBeenCalled();
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

  it('lists saved team generations for group members newest first', async () => {
    const generationFindMany = jest
      .fn()
      .mockResolvedValue([
        createTeamGenerationRow({ id: 'generation_2', versionNumber: 2 }),
        createTeamGenerationRow({ id: 'generation_1', versionNumber: 1 }),
      ]);
    const service = new MatchesService(
      createPrismaMock({
        role: 'member',
        findFirst: jest.fn().mockResolvedValue(createMatchRow()),
        generationFindMany,
      }),
    );

    await expect(
      service.listTeamGenerations('user_123', 'grp_123', 'match_123'),
    ).resolves.toMatchObject([
      {
        id: 'generation_2',
        versionNumber: 2,
      },
      {
        id: 'generation_1',
        versionNumber: 1,
      },
    ]);

    expect(generationFindMany).toHaveBeenCalledWith({
      where: {
        matchId: 'match_123',
      },
      orderBy: {
        versionNumber: 'desc',
      },
    });
  });

  it('applies one manual swap and recalculates team fairness', async () => {
    const generationUpdate = jest
      .fn()
      .mockImplementation(({ data }: { data: TeamGenerationRowOverrides }) =>
        Promise.resolve(
          createTeamGenerationRow({
            ...data,
            id: 'generation_123',
            versionNumber: 1,
          }),
        ),
      );
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest.fn().mockResolvedValue(createMatchRow()),
        generationFindFirst: jest
          .fn()
          .mockResolvedValue(createTeamGenerationRow(createSwappableTeams())),
        generationUpdate,
      }),
    );

    await expect(
      service.applyManualTeamAdjustment(
        'user_123',
        'grp_123',
        'match_123',
        'generation_123',
        {
          teamAPlayerId: 'ply_a_1',
          teamBPlayerId: 'ply_b_1',
        },
      ),
    ).resolves.toMatchObject({
      id: 'generation_123',
      teamA: {
        players: expect.arrayContaining([
          expect.objectContaining({
            playerId: 'ply_b_1',
          }) as object,
        ]) as unknown[],
      },
      teamB: {
        players: expect.arrayContaining([
          expect.objectContaining({
            playerId: 'ply_a_1',
          }) as object,
        ]) as unknown[],
      },
      fairnessPercentage: expect.any(Number) as number,
      manualAdjustment: {
        type: 'swap',
        adjustedByUserId: 'usr_123',
        fromTeamAPlayerId: 'ply_a_1',
        fromTeamBPlayerId: 'ply_b_1',
      },
    });

    expect(generationUpdate).toHaveBeenCalledWith({
      where: {
        id: 'generation_123',
      },
      data: expect.objectContaining({
        teamA: expect.objectContaining({
          totalRating: expect.any(Number) as number,
        }) as object,
        teamB: expect.objectContaining({
          totalRating: expect.any(Number) as number,
        }) as object,
        fairnessPercentage: expect.any(Number) as number,
        manualAdjustment: expect.objectContaining({
          type: 'swap',
        }) as object,
      }) as object,
    });
  });

  it('blocks a second manual adjustment on the same version', async () => {
    const generationUpdate = jest.fn();
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest.fn().mockResolvedValue(createMatchRow()),
        generationFindFirst: jest.fn().mockResolvedValue(
          createTeamGenerationRow({
            ...createSwappableTeams(),
            manualAdjustment: createManualAdjustment(),
          }),
        ),
        generationUpdate,
      }),
    );

    await expect(
      service.applyManualTeamAdjustment(
        'user_123',
        'grp_123',
        'match_123',
        'generation_123',
        {
          teamAPlayerId: 'ply_a_1',
          teamBPlayerId: 'ply_b_1',
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(generationUpdate).not.toHaveBeenCalled();
  });

  it('blocks manual adjustment on a locked version', async () => {
    const generationUpdate = jest.fn();
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest.fn().mockResolvedValue(createMatchRow()),
        generationFindFirst: jest.fn().mockResolvedValue(
          createTeamGenerationRow({
            ...createSwappableTeams(),
            status: 'locked',
          }),
        ),
        generationUpdate,
      }),
    );

    await expect(
      service.applyManualTeamAdjustment(
        'user_123',
        'grp_123',
        'match_123',
        'generation_123',
        {
          teamAPlayerId: 'ply_a_1',
          teamBPlayerId: 'ply_b_1',
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(generationUpdate).not.toHaveBeenCalled();
  });

  it('confirms one generation and locks the match as source of truth', async () => {
    const generationUpdateMany = jest.fn().mockResolvedValue({
      count: 1,
    });
    const generationUpdate = jest
      .fn()
      .mockResolvedValue(createTeamGenerationRow({ status: 'locked' }));
    const matchUpdate = jest
      .fn()
      .mockResolvedValue(createMatchRow({ status: 'locked' }));
    const transaction = jest.fn(async (operations: Array<Promise<unknown>>) =>
      Promise.all(operations),
    );
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest.fn().mockResolvedValue(createMatchRow()),
        matchUpdate,
        generationFindFirst: jest
          .fn()
          .mockResolvedValueOnce(createTeamGenerationRow())
          .mockResolvedValueOnce(null),
        generationUpdate,
        generationUpdateMany,
        transaction,
      }),
    );

    await expect(
      service.confirmTeamGeneration(
        'user_123',
        'grp_123',
        'match_123',
        'generation_123',
      ),
    ).resolves.toMatchObject({
      match: {
        id: 'match_123',
        status: 'locked',
      },
      generation: {
        id: 'generation_123',
        status: 'locked',
      },
    });

    expect(generationUpdateMany).toHaveBeenCalledWith({
      where: {
        matchId: 'match_123',
        NOT: {
          id: 'generation_123',
        },
      },
      data: {
        status: 'draft',
      },
    });
    expect(generationUpdate).toHaveBeenCalledWith({
      where: {
        id: 'generation_123',
      },
      data: {
        status: 'locked',
      },
    });
    expect(matchUpdate).toHaveBeenCalledWith({
      where: {
        id: 'match_123',
      },
      data: {
        status: 'locked',
      },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('returns the locked source of truth idempotently', async () => {
    const transaction = jest.fn();
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest
          .fn()
          .mockResolvedValue(createMatchRow({ status: 'locked' })),
        generationFindFirst: jest
          .fn()
          .mockResolvedValue(createTeamGenerationRow({ status: 'locked' })),
        transaction,
      }),
    );

    await expect(
      service.confirmTeamGeneration(
        'user_123',
        'grp_123',
        'match_123',
        'generation_123',
      ),
    ).resolves.toMatchObject({
      match: {
        status: 'locked',
      },
      generation: {
        status: 'locked',
      },
    });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('blocks locking a second generation after teams are official', async () => {
    const transaction = jest.fn();
    const service = new MatchesService(
      createPrismaMock({
        role: 'admin',
        findFirst: jest.fn().mockResolvedValue(createMatchRow()),
        generationFindFirst: jest
          .fn()
          .mockResolvedValueOnce(createTeamGenerationRow())
          .mockResolvedValueOnce({
            id: 'generation_locked',
          }),
        transaction,
      }),
    );

    await expect(
      service.confirmTeamGeneration(
        'user_123',
        'grp_123',
        'match_123',
        'generation_123',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(transaction).not.toHaveBeenCalled();
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
  matchUpdate = jest.fn(),
  playerFindUnique = jest.fn().mockResolvedValue({
    id: 'ply_123',
  }),
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
  generationFindMany = jest.fn().mockResolvedValue([]),
  generationUpdate = jest.fn(),
  generationUpdateMany = jest.fn(),
  eventDeleteMany = jest.fn().mockResolvedValue({ count: 0 }),
  eventFindMany = jest.fn().mockResolvedValue([]),
  eventUpsert = jest.fn(),
  mvpVoteCreate = jest.fn(),
  mvpVoteFindMany = jest.fn().mockResolvedValue([]),
  mvpVoteFindUnique = jest.fn().mockResolvedValue(null),
  opponentRatingCompletionFindUnique = jest.fn().mockResolvedValue(null),
  opponentRatingCompletionUpsert = jest.fn(),
  opponentRatingFindMany = jest.fn().mockResolvedValue([]),
  opponentRatingUpsert = jest.fn(),
  ratingStateFindMany = jest.fn().mockResolvedValue([]),
  playerRatingStateUpsert = jest.fn().mockResolvedValue({}),
  matchPlayerStatUpsert = jest.fn().mockResolvedValue({}),
  playerRatingHistoryUpsert = jest.fn().mockResolvedValue({}),
  transaction = jest.fn(async (operations: Array<Promise<unknown>>) =>
    Promise.all(operations),
  ),
}: {
  role: string;
  create?: jest.Mock;
  findFirst?: jest.Mock;
  matchUpdate?: jest.Mock;
  playerFindUnique?: jest.Mock;
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
  generationFindMany?: jest.Mock;
  generationUpdate?: jest.Mock;
  generationUpdateMany?: jest.Mock;
  eventDeleteMany?: jest.Mock;
  eventFindMany?: jest.Mock;
  eventUpsert?: jest.Mock;
  mvpVoteCreate?: jest.Mock;
  mvpVoteFindMany?: jest.Mock;
  mvpVoteFindUnique?: jest.Mock;
  opponentRatingCompletionFindUnique?: jest.Mock;
  opponentRatingCompletionUpsert?: jest.Mock;
  opponentRatingFindMany?: jest.Mock;
  opponentRatingUpsert?: jest.Mock;
  ratingStateFindMany?: jest.Mock;
  playerRatingStateUpsert?: jest.Mock;
  matchPlayerStatUpsert?: jest.Mock;
  playerRatingHistoryUpsert?: jest.Mock;
  transaction?: jest.Mock;
}) {
  return {
    $transaction: transaction,
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
      findUnique: playerFindUnique,
    },
    match: {
      create,
      findFirst,
      update: matchUpdate,
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
      findMany: generationFindMany,
      update: generationUpdate,
      updateMany: generationUpdateMany,
    },
    matchEvent: {
      deleteMany: eventDeleteMany,
      findMany: eventFindMany,
      upsert: eventUpsert,
    },
    matchMvpVote: {
      create: mvpVoteCreate,
      findMany: mvpVoteFindMany,
      findUnique: mvpVoteFindUnique,
    },
    matchOpponentRating: {
      findMany: opponentRatingFindMany,
      upsert: opponentRatingUpsert,
    },
    matchOpponentRatingCompletion: {
      findUnique: opponentRatingCompletionFindUnique,
      upsert: opponentRatingCompletionUpsert,
    },
    playerRatingState: {
      findMany: ratingStateFindMany,
      upsert: playerRatingStateUpsert,
    },
    matchPlayerStat: {
      upsert: matchPlayerStatUpsert,
    },
    playerRatingHistory: {
      upsert: playerRatingHistoryUpsert,
    },
  } as unknown as PrismaService;
}

function createMatchRow(
  overrides: Partial<{
    status: string;
    teamAScore: number | null;
    teamBScore: number | null;
    scoreSubmittedByUserId: string | null;
    scoreSubmittedAt: Date | null;
    finalizedByUserId: string | null;
    finalizedAt: Date | null;
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
    status: overrides.status ?? 'open',
    teamAScore: overrides.teamAScore ?? null,
    teamBScore: overrides.teamBScore ?? null,
    scoreSubmittedByUserId: overrides.scoreSubmittedByUserId ?? null,
    scoreSubmittedAt: overrides.scoreSubmittedAt ?? null,
    finalizedByUserId: overrides.finalizedByUserId ?? null,
    finalizedAt: overrides.finalizedAt ?? null,
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

function createMatchEventRow(
  overrides: Partial<{
    id: string;
    matchId: string;
    playerId: string;
    kind: string;
    count: number;
    recordedByUserId: string;
  }> = {},
) {
  return {
    id: overrides.id ?? 'event_goal_1',
    matchId: overrides.matchId ?? 'match_123',
    playerId: overrides.playerId ?? 'ply_1',
    kind: overrides.kind ?? 'goal',
    count: overrides.count ?? 1,
    recordedByUserId: overrides.recordedByUserId ?? 'usr_123',
    createdAt: new Date('2026-06-10T21:15:00.000Z'),
    updatedAt: new Date('2026-06-10T21:15:00.000Z'),
  };
}

function createMvpVoteRow(
  overrides: Partial<{
    id: string;
    matchId: string;
    voterPlayerId: string;
    votedPlayerId: string;
  }> = {},
) {
  return {
    id: overrides.id ?? 'mvp_vote_1',
    matchId: overrides.matchId ?? 'match_123',
    voterPlayerId: overrides.voterPlayerId ?? 'ply_a_1',
    votedPlayerId: overrides.votedPlayerId ?? 'ply_b_1',
    createdAt: new Date('2026-06-10T21:20:00.000Z'),
    updatedAt: new Date('2026-06-10T21:20:00.000Z'),
  };
}

function createOpponentRatingRow(
  overrides: Partial<{
    id: string;
    matchId: string;
    raterPlayerId: string;
    ratedPlayerId: string;
    rating: number;
    tags: string[];
  }> = {},
) {
  return {
    id: overrides.id ?? 'opponent_rating_1',
    matchId: overrides.matchId ?? 'match_123',
    raterPlayerId: overrides.raterPlayerId ?? 'ply_a_1',
    ratedPlayerId: overrides.ratedPlayerId ?? 'ply_b_1',
    rating: overrides.rating ?? 80,
    tags: overrides.tags ?? [],
    createdAt: new Date('2026-06-10T21:25:00.000Z'),
    updatedAt: new Date('2026-06-10T21:25:00.000Z'),
  };
}

function createOpponentRatingCompletionRow(
  overrides: Partial<{
    id: string;
    matchId: string;
    playerId: string;
    status: string;
  }> = {},
) {
  return {
    id: overrides.id ?? 'opponent_rating_completion_1',
    matchId: overrides.matchId ?? 'match_123',
    playerId: overrides.playerId ?? 'ply_a_1',
    status: overrides.status ?? 'submitted',
    createdAt: new Date('2026-06-10T21:26:00.000Z'),
    updatedAt: new Date('2026-06-10T21:26:00.000Z'),
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

function createInitialRatingRowsForPlayers(
  players: Array<[ratedPlayerId: string, overall: number]>,
) {
  return players.flatMap(([ratedPlayerId, overall]) =>
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

function createPlayerRatingStateRow(
  overrides: Partial<{
    id: string;
    playerId: string;
    overallRating: number;
    formRating: number;
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    goals: number;
    assists: number;
    mvpAwards: number;
    mvpVotes: number;
  }> = {},
) {
  return {
    id: overrides.id ?? `rating_state_${overrides.playerId ?? 'ply_123'}`,
    playerId: overrides.playerId ?? 'ply_123',
    overallRating: overrides.overallRating ?? 50,
    formRating: overrides.formRating ?? 50,
    gamesPlayed: overrides.gamesPlayed ?? 0,
    wins: overrides.wins ?? 0,
    losses: overrides.losses ?? 0,
    draws: overrides.draws ?? 0,
    goals: overrides.goals ?? 0,
    assists: overrides.assists ?? 0,
    mvpAwards: overrides.mvpAwards ?? 0,
    mvpVotes: overrides.mvpVotes ?? 0,
    createdAt: new Date('2026-06-03T01:00:00.000Z'),
    updatedAt: new Date('2026-06-03T01:00:00.000Z'),
  };
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
  manualAdjustment: unknown;
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
    manualAdjustment: overrides.manualAdjustment ?? null,
    createdAt: overrides.createdAt ?? new Date('2026-06-03T03:00:00.000Z'),
    updatedAt: overrides.updatedAt ?? new Date('2026-06-03T03:00:00.000Z'),
  };
}

function createSwappableTeams(): TeamGenerationRowOverrides {
  return {
    teamA: {
      label: 'A',
      totalRating: 160,
      averageRating: 80,
      players: [
        {
          playerId: 'ply_a_1',
          rating: 90,
          preferredStyle: 'attacker',
          slot: 1,
        },
        {
          playerId: 'ply_a_2',
          rating: 70,
          preferredStyle: 'defender',
          slot: 2,
        },
      ],
    },
    teamB: {
      label: 'B',
      totalRating: 150,
      averageRating: 75,
      players: [
        {
          playerId: 'ply_b_1',
          rating: 85,
          preferredStyle: 'goalkeeper',
          slot: 1,
        },
        {
          playerId: 'ply_b_2',
          rating: 65,
          preferredStyle: 'midfielder',
          slot: 2,
        },
      ],
    },
    teamATotal: 160,
    teamBTotal: 150,
    fairnessPercentage: 75,
    inputSnapshot: {
      matchId: 'match_123',
      groupId: 'grp_123',
      playersPerTeam: 2,
      generatorStyle: 'fair_fresh',
      goalkeeperMode: 'rotating_goalkeeper',
      playerRatings: [],
    },
  };
}

function createManualAdjustment() {
  return {
    type: 'swap',
    adjustedAt: '2026-06-03T04:00:00.000Z',
    adjustedByUserId: 'usr_123',
    fromTeamAPlayerId: 'ply_a_1',
    fromTeamBPlayerId: 'ply_b_1',
  };
}
