import type { AuthenticatedRequest } from '../auth/auth.types';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

describe('RatingsController', () => {
  it('serializes current-user initial peer ratings', async () => {
    const listMyInitialPeerRatings = jest.fn().mockResolvedValue([
      createInternalRating({
        id: 'ipr_123',
      }),
    ]);
    const controller = new RatingsController({
      listMyInitialPeerRatings,
    } as unknown as RatingsService);

    await expect(
      controller.listMyInitialPeerRatings(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
      ),
    ).resolves.toEqual({
      data: {
        ratings: [
          expect.objectContaining({
            id: 'ipr_123',
            groupId: 'grp_123',
            raterPlayerId: 'ply_rater',
            ratedPlayerId: 'ply_target',
            createdAt: '2026-06-03T00:00:00.000Z',
          }) as object,
        ],
      },
    });
  });

  it('submits an initial peer rating', async () => {
    const submitInitialPeerRating = jest.fn().mockResolvedValue(
      createInternalRating({
        id: 'ipr_456',
      }),
    );
    const controller = new RatingsController({
      submitInitialPeerRating,
    } as unknown as RatingsService);

    await expect(
      controller.submitInitialPeerRating(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        {
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
        },
      ),
    ).resolves.toMatchObject({
      data: {
        rating: {
          id: 'ipr_456',
          attributeSet: 'standard',
          overall: 80,
        },
      },
    });

    expect(submitInitialPeerRating).toHaveBeenCalledWith(
      'user_123',
      'grp_123',
      {
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
      },
    );
  });

  it('updates an initial peer rating', async () => {
    const updateInitialPeerRating = jest.fn().mockResolvedValue(
      createInternalRating({
        id: 'ipr_456',
      }),
    );
    const controller = new RatingsController({
      updateInitialPeerRating,
    } as unknown as RatingsService);

    await expect(
      controller.updateInitialPeerRating(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        'ipr_456',
        {
          values: {
            overall: 90,
            speed: 90,
            attack: 90,
            technique: 90,
            defense: 90,
            physical: 90,
            stamina: 90,
            fun: 90,
          },
        },
      ),
    ).resolves.toMatchObject({
      data: {
        rating: {
          id: 'ipr_456',
          attributeSet: 'standard',
        },
      },
    });

    expect(updateInitialPeerRating).toHaveBeenCalledWith(
      'user_123',
      'grp_123',
      'ipr_456',
      {
        values: {
          overall: 90,
          speed: 90,
          attack: 90,
          technique: 90,
          defense: 90,
          physical: 90,
          stamina: 90,
          fun: 90,
        },
      },
    );
  });
});

function createInternalRating(overrides: Partial<{ id: string }> = {}) {
  return {
    id: overrides.id ?? 'ipr_123',
    groupId: 'grp_123',
    raterPlayerId: 'ply_rater',
    ratedPlayerId: 'ply_target',
    attributeSet: 'standard',
    overall: 80,
    speed: 80,
    attack: 80,
    technique: 80,
    defense: 80,
    reflexes: null,
    positioning: null,
    handling: null,
    distribution: null,
    communication: null,
    physical: 80,
    stamina: 80,
    fun: 80,
    lockedAt: null,
    createdAt: new Date('2026-06-03T00:00:00.000Z'),
    updatedAt: new Date('2026-06-03T01:00:00.000Z'),
  };
}
