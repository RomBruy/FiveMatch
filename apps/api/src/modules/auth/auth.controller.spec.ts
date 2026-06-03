import { AuthController } from './auth.controller';
import { UsersService } from '../users/users.service';
import type { AuthenticatedRequest } from './auth.types';

describe('AuthController', () => {
  it('syncs the authenticated Clerk user into an internal user response', async () => {
    const syncFromAuth = jest.fn().mockResolvedValue({
      id: 'usr_123',
      clerkUserId: 'user_123',
      emailAddress: 'roro@example.com',
      firstName: 'Roro',
      lastName: null,
      imageUrl: null,
      preferredLocale: 'fr',
      createdAt: new Date('2026-05-31T00:00:00.000Z'),
      updatedAt: new Date('2026-05-31T01:00:00.000Z'),
    });

    const usersService = {
      syncFromAuth,
    } as unknown as UsersService;

    const controller = new AuthController(usersService);

    await expect(
      controller.syncCurrentUser(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        {
          emailAddress: 'roro@example.com',
          firstName: 'Roro',
        },
      ),
    ).resolves.toEqual({
      data: {
        user: {
          id: 'usr_123',
          clerkUserId: 'user_123',
          emailAddress: 'roro@example.com',
          firstName: 'Roro',
          lastName: null,
          imageUrl: null,
          preferredLocale: 'fr',
          createdAt: '2026-05-31T00:00:00.000Z',
          updatedAt: '2026-05-31T01:00:00.000Z',
        },
      },
    });

    expect(syncFromAuth).toHaveBeenCalledWith({
      clerkUserId: 'user_123',
      emailAddress: 'roro@example.com',
      firstName: 'Roro',
      lastName: undefined,
      imageUrl: undefined,
      preferredLocale: undefined,
    });
  });
});
