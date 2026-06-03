import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  it('upserts a user by Clerk subject', async () => {
    const upsert = jest.fn().mockResolvedValue({
      id: 'usr_123',
      clerkUserId: 'user_123',
      emailAddress: 'roro@example.com',
      firstName: 'Roro',
      lastName: null,
      imageUrl: null,
      preferredLocale: 'fr',
      createdAt: new Date('2026-05-31T00:00:00.000Z'),
      updatedAt: new Date('2026-05-31T00:00:00.000Z'),
    });

    const service = new UsersService({
      user: {
        upsert,
      },
    } as unknown as PrismaService);

    await expect(
      service.syncFromAuth({
        clerkUserId: 'user_123',
        emailAddress: 'roro@example.com',
        firstName: 'Roro',
      }),
    ).resolves.toMatchObject({
      id: 'usr_123',
      clerkUserId: 'user_123',
    });

    expect(upsert).toHaveBeenCalledWith({
      where: {
        clerkUserId: 'user_123',
      },
      create: {
        clerkUserId: 'user_123',
        emailAddress: 'roro@example.com',
        firstName: 'Roro',
        lastName: null,
        imageUrl: null,
        preferredLocale: 'fr',
      },
      update: {
        emailAddress: 'roro@example.com',
        firstName: 'Roro',
        lastName: null,
        imageUrl: null,
      },
    });
  });

  it('updates language preferences by Clerk subject', async () => {
    const upsert = jest.fn().mockResolvedValue({
      id: 'usr_123',
      clerkUserId: 'user_123',
      emailAddress: null,
      firstName: null,
      lastName: null,
      imageUrl: null,
      preferredLocale: 'en',
      createdAt: new Date('2026-05-31T00:00:00.000Z'),
      updatedAt: new Date('2026-05-31T00:00:00.000Z'),
    });

    const service = new UsersService({
      user: {
        upsert,
      },
    } as unknown as PrismaService);

    await expect(
      service.updatePreferences('user_123', {
        preferredLocale: 'en',
      }),
    ).resolves.toMatchObject({
      preferredLocale: 'en',
    });

    expect(upsert).toHaveBeenCalledWith({
      where: {
        clerkUserId: 'user_123',
      },
      create: {
        clerkUserId: 'user_123',
        preferredLocale: 'en',
      },
      update: {
        preferredLocale: 'en',
      },
    });
  });
});
