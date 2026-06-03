import { BadRequestException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  it('updates the authenticated user preference', async () => {
    const updatePreferences = jest.fn().mockResolvedValue({
      id: 'usr_123',
      clerkUserId: 'user_123',
      emailAddress: null,
      firstName: null,
      lastName: null,
      imageUrl: null,
      preferredLocale: 'en',
      createdAt: new Date('2026-05-31T00:00:00.000Z'),
      updatedAt: new Date('2026-05-31T01:00:00.000Z'),
    });

    const controller = new UsersController({
      updatePreferences,
    } as unknown as UsersService);

    await expect(
      controller.updateCurrentUserPreferences(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        {
          preferredLocale: 'en',
        },
      ),
    ).resolves.toEqual({
      data: {
        user: {
          id: 'usr_123',
          clerkUserId: 'user_123',
          emailAddress: null,
          firstName: null,
          lastName: null,
          imageUrl: null,
          preferredLocale: 'en',
          createdAt: '2026-05-31T00:00:00.000Z',
          updatedAt: '2026-05-31T01:00:00.000Z',
        },
      },
    });

    expect(updatePreferences).toHaveBeenCalledWith('user_123', {
      preferredLocale: 'en',
    });
  });

  it('rejects unsupported locales', async () => {
    const controller = new UsersController({
      updatePreferences: jest.fn(),
    } as unknown as UsersService);

    await expect(
      controller.updateCurrentUserPreferences(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        {
          preferredLocale: 'de',
        } as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
