import { BadRequestException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';

describe('MatchesController', () => {
  it('creates and serializes a match', async () => {
    const createMatch = jest.fn().mockResolvedValue(createInternalMatch());
    const controller = new MatchesController({
      createMatch,
    } as unknown as MatchesService);

    await expect(
      controller.createMatch(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        {
          title: 'Wednesday Football',
          startsAt: '2026-06-10T18:00:00.000Z',
          location: 'Mont Foot 5',
          playersPerTeam: 5,
          attendanceDeadlineAt: '2026-06-10T16:00:00.000Z',
          generatorStyleOverride: 'max_fairness',
          goalkeeperModeOverride: 'fixed_goalkeeper',
        },
      ),
    ).resolves.toMatchObject({
      data: {
        match: {
          id: 'match_123',
          startsAt: '2026-06-10T18:00:00.000Z',
          maxPlayers: 10,
          attendances: [],
        },
      },
    });

    expect(createMatch).toHaveBeenCalledWith('user_123', 'grp_123', {
      title: 'Wednesday Football',
      startsAt: '2026-06-10T18:00:00.000Z',
      location: 'Mont Foot 5',
      playersPerTeam: 5,
      attendanceDeadlineAt: '2026-06-10T16:00:00.000Z',
      generatorStyleOverride: 'max_fairness',
      goalkeeperModeOverride: 'fixed_goalkeeper',
    });
  });

  it('rejects invalid players per team values', async () => {
    const controller = new MatchesController({
      createMatch: jest.fn(),
    } as unknown as MatchesService);

    await expect(
      controller.createMatch(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        {
          title: 'Wednesday Football',
          startsAt: '2026-06-10T18:00:00.000Z',
          location: 'Mont Foot 5',
          playersPerTeam: 3,
          attendanceDeadlineAt: '2026-06-10T16:00:00.000Z',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('serializes the next match response', async () => {
    const getNextMatch = jest.fn().mockResolvedValue(createInternalMatch());
    const controller = new MatchesController({
      getNextMatch,
    } as unknown as MatchesService);

    await expect(
      controller.getNextMatch(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
      ),
    ).resolves.toMatchObject({
      data: {
        match: {
          id: 'match_123',
          confirmedCount: 0,
          waitlistCount: 0,
          attendances: [],
        },
      },
    });
  });

  it('submits current-player attendance', async () => {
    const submitAttendance = jest.fn().mockResolvedValue(
      createInternalMatch({
        attendances: [
          {
            id: 'attendance_maybe',
            matchId: 'match_123',
            playerId: 'ply_maybe',
            response: 'maybe',
            status: 'maybe',
            waitlistPosition: null,
            respondedAt: new Date('2026-06-03T02:10:00.000Z'),
            createdAt: new Date('2026-06-03T02:10:00.000Z'),
            updatedAt: new Date('2026-06-03T02:10:00.000Z'),
          },
        ],
        myAttendance: {
          id: 'attendance_123',
          matchId: 'match_123',
          playerId: 'ply_123',
          response: 'in',
          status: 'confirmed',
          waitlistPosition: null,
          respondedAt: new Date('2026-06-03T02:00:00.000Z'),
          createdAt: new Date('2026-06-03T02:00:00.000Z'),
          updatedAt: new Date('2026-06-03T02:00:00.000Z'),
        },
      }),
    );
    const controller = new MatchesController({
      submitAttendance,
    } as unknown as MatchesService);

    await expect(
      controller.submitAttendance(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        'match_123',
        {
          response: 'in',
        },
      ),
    ).resolves.toMatchObject({
      data: {
        match: {
          id: 'match_123',
          myAttendance: {
            response: 'in',
            status: 'confirmed',
          },
          attendances: [
            {
              response: 'maybe',
              status: 'maybe',
            },
          ],
        },
      },
    });

    expect(submitAttendance).toHaveBeenCalledWith(
      'user_123',
      'grp_123',
      'match_123',
      {
        response: 'in',
      },
    );
  });

  it('submits and serializes final score for locked teams', async () => {
    const submitFinalScore = jest.fn().mockResolvedValue(
      createInternalMatch({
        status: 'locked',
        score: {
          teamAScore: 7,
          teamBScore: 5,
          submittedByUserId: 'usr_123',
          submittedAt: new Date('2026-06-10T21:10:00.000Z'),
        },
      }),
    );
    const controller = new MatchesController({
      submitFinalScore,
    } as unknown as MatchesService);

    await expect(
      controller.submitFinalScore(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        'match_123',
        {
          teamAScore: 7,
          teamBScore: 5,
        },
      ),
    ).resolves.toMatchObject({
      data: {
        match: {
          id: 'match_123',
          status: 'locked',
          score: {
            teamAScore: 7,
            teamBScore: 5,
            submittedByUserId: 'usr_123',
            submittedAt: '2026-06-10T21:10:00.000Z',
          },
        },
      },
    });

    expect(submitFinalScore).toHaveBeenCalledWith(
      'user_123',
      'grp_123',
      'match_123',
      {
        teamAScore: 7,
        teamBScore: 5,
      },
    );
  });

  it('rejects invalid final score values', async () => {
    const controller = new MatchesController({
      submitFinalScore: jest.fn(),
    } as unknown as MatchesService);

    await expect(
      controller.submitFinalScore(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        'match_123',
        {
          teamAScore: 7.5,
          teamBScore: -1,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('generates and serializes a team version', async () => {
    const generateTeamVersion = jest
      .fn()
      .mockResolvedValue(createInternalTeamGenerationVersion());
    const controller = new MatchesController({
      generateTeamVersion,
    } as unknown as MatchesService);

    await expect(
      controller.generateTeamVersion(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        'match_123',
      ),
    ).resolves.toMatchObject({
      data: {
        generation: {
          id: 'generation_123',
          matchId: 'match_123',
          versionNumber: 1,
          fairnessPercentage: 96,
          teamA: {
            label: 'A',
          },
          explanation: {
            summary: expect.any(String) as string,
          },
        },
      },
    });

    expect(generateTeamVersion).toHaveBeenCalledWith(
      'user_123',
      'grp_123',
      'match_123',
    );
  });

  it('lists and serializes saved team generations with the MVP limit', async () => {
    const listTeamGenerations = jest.fn().mockResolvedValue([
      {
        ...createInternalTeamGenerationVersion(),
        id: 'generation_2',
        versionNumber: 2,
      },
      createInternalTeamGenerationVersion(),
    ]);
    const controller = new MatchesController({
      listTeamGenerations,
    } as unknown as MatchesService);

    await expect(
      controller.listTeamGenerations(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        'match_123',
      ),
    ).resolves.toMatchObject({
      data: {
        generations: [
          {
            id: 'generation_2',
            versionNumber: 2,
          },
          {
            id: 'generation_123',
            versionNumber: 1,
          },
        ],
        limit: 5,
        remaining: 3,
      },
    });

    expect(listTeamGenerations).toHaveBeenCalledWith(
      'user_123',
      'grp_123',
      'match_123',
    );
  });

  it('serializes the latest saved team generation', async () => {
    const getLatestTeamGeneration = jest
      .fn()
      .mockResolvedValue(createInternalTeamGenerationVersion());
    const controller = new MatchesController({
      getLatestTeamGeneration,
    } as unknown as MatchesService);

    await expect(
      controller.getLatestTeamGeneration(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        'match_123',
      ),
    ).resolves.toMatchObject({
      data: {
        generation: {
          id: 'generation_123',
          versionNumber: 1,
          fairnessPercentage: 96,
          createdAt: '2026-06-03T03:00:00.000Z',
        },
      },
    });

    expect(getLatestTeamGeneration).toHaveBeenCalledWith(
      'user_123',
      'grp_123',
      'match_123',
    );
  });

  it('applies and serializes a manual team adjustment', async () => {
    const applyManualTeamAdjustment = jest.fn().mockResolvedValue({
      ...createInternalTeamGenerationVersion(),
      manualAdjustment: {
        type: 'swap',
        adjustedAt: '2026-06-03T04:00:00.000Z',
        adjustedByUserId: 'usr_123',
        fromTeamAPlayerId: 'ply_1',
        fromTeamBPlayerId: 'ply_2',
      },
    });
    const controller = new MatchesController({
      applyManualTeamAdjustment,
    } as unknown as MatchesService);

    await expect(
      controller.applyManualTeamAdjustment(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        'match_123',
        'generation_123',
        {
          teamAPlayerId: 'ply_1',
          teamBPlayerId: 'ply_2',
        },
      ),
    ).resolves.toMatchObject({
      data: {
        generation: {
          id: 'generation_123',
          manualAdjustment: {
            type: 'swap',
            fromTeamAPlayerId: 'ply_1',
            fromTeamBPlayerId: 'ply_2',
          },
        },
      },
    });

    expect(applyManualTeamAdjustment).toHaveBeenCalledWith(
      'user_123',
      'grp_123',
      'match_123',
      'generation_123',
      {
        teamAPlayerId: 'ply_1',
        teamBPlayerId: 'ply_2',
      },
    );
  });

  it('rejects a manual adjustment with the same player twice', async () => {
    const controller = new MatchesController({
      applyManualTeamAdjustment: jest.fn(),
    } as unknown as MatchesService);

    await expect(
      controller.applyManualTeamAdjustment(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        'match_123',
        'generation_123',
        {
          teamAPlayerId: 'ply_1',
          teamBPlayerId: 'ply_1',
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('confirms and serializes locked teams', async () => {
    const confirmTeamGeneration = jest.fn().mockResolvedValue({
      match: createInternalMatch({ status: 'locked' }),
      generation: {
        ...createInternalTeamGenerationVersion(),
        status: 'locked',
      },
    });
    const controller = new MatchesController({
      confirmTeamGeneration,
    } as unknown as MatchesService);

    await expect(
      controller.confirmTeamGeneration(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        'match_123',
        'generation_123',
      ),
    ).resolves.toMatchObject({
      data: {
        match: {
          id: 'match_123',
          status: 'locked',
        },
        generation: {
          id: 'generation_123',
          status: 'locked',
        },
      },
    });

    expect(confirmTeamGeneration).toHaveBeenCalledWith(
      'user_123',
      'grp_123',
      'match_123',
      'generation_123',
    );
  });

  it('returns null when no latest generation is available', async () => {
    const controller = new MatchesController({
      getLatestTeamGeneration: jest.fn().mockResolvedValue(null),
    } as unknown as MatchesService);

    await expect(
      controller.getLatestTeamGeneration(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        'match_123',
      ),
    ).resolves.toEqual({
      data: {
        generation: null,
      },
    });
  });
});

function createInternalMatch(
  overrides: Partial<{
    status: 'open' | 'cancelled' | 'locked' | 'completed';
    score: {
      teamAScore: number;
      teamBScore: number;
      submittedByUserId: string;
      submittedAt: Date;
    } | null;
    attendances: {
      id: string;
      matchId: string;
      playerId: string;
      response: 'in' | 'out' | 'maybe';
      status: 'confirmed' | 'waitlisted' | 'out' | 'maybe';
      waitlistPosition: number | null;
      respondedAt: Date;
      createdAt: Date;
      updatedAt: Date;
    }[];
    myAttendance: {
      id: string;
      matchId: string;
      playerId: string;
      response: 'in' | 'out' | 'maybe';
      status: 'confirmed' | 'waitlisted' | 'out' | 'maybe';
      waitlistPosition: number | null;
      respondedAt: Date;
      createdAt: Date;
      updatedAt: Date;
    } | null;
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
    confirmedCount: 0,
    waitlistCount: 0,
    score: overrides.score ?? null,
    attendances: overrides.attendances ?? [],
    myAttendance: overrides.myAttendance ?? null,
    createdAt: new Date('2026-06-03T00:00:00.000Z'),
    updatedAt: new Date('2026-06-03T01:00:00.000Z'),
  };
}

function createInternalTeamGenerationVersion() {
  return {
    id: 'generation_123',
    matchId: 'match_123',
    generatedByUserId: 'usr_123',
    versionNumber: 1,
    seed: 'match_123:v1',
    algorithmVersion: 'team-generator-v1',
    status: 'draft',
    teamA: {
      label: 'A',
      totalRating: 390,
      averageRating: 78,
      players: [
        {
          playerId: 'ply_1',
          rating: 80,
          preferredStyle: 'attacker',
          slot: 1,
        },
      ],
    },
    teamB: {
      label: 'B',
      totalRating: 386,
      averageRating: 77.2,
      players: [
        {
          playerId: 'ply_2',
          rating: 79,
          preferredStyle: 'defender',
          slot: 1,
        },
      ],
    },
    teamATotal: 390,
    teamBTotal: 386,
    fairnessPercentage: 96,
    inputSnapshot: {
      matchId: 'match_123',
      groupId: 'grp_123',
      playersPerTeam: 5,
      generatorStyle: 'fair_fresh',
      goalkeeperMode: 'rotating_goalkeeper',
      playerRatings: [
        {
          playerId: 'ply_1',
          rating: 80,
          ratingsReceived: 3,
          preferredStyle: 'attacker',
        },
      ],
    },
    scoreComponents: {
      ratingGap: 0.8,
      positionImbalance: 1,
      goalkeeperImbalance: 0,
      randomness: 0.1,
      candidateScore: 9.6,
    },
    explanation: {
      summary: 'Team A and Team B are close on average rating.',
      bullets: ['Balanced by rating first.'],
    },
    manualAdjustment: null,
    createdAt: new Date('2026-06-03T03:00:00.000Z'),
    updatedAt: new Date('2026-06-03T03:00:00.000Z'),
  };
}
