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
        },
      },
    });
  });
});

function createInternalMatch() {
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
    confirmedCount: 0,
    waitlistCount: 0,
    createdAt: new Date('2026-06-03T00:00:00.000Z'),
    updatedAt: new Date('2026-06-03T01:00:00.000Z'),
  };
}
