import { BadRequestException } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';

describe('GroupsController', () => {
  it('creates a private group for the authenticated organizer', async () => {
    const createForUser = jest.fn().mockResolvedValue({
      id: 'grp_123',
      name: 'Foot 5',
      ownerUserId: 'usr_123',
      currentUserRole: 'owner',
      settings: {
        defaultLanguage: 'fr',
        playStyle: 'flexible',
        intensity: 'balanced',
        goalkeeperMode: 'rotating_goalkeeper',
        generatorStyle: 'fair_fresh',
      },
      createdAt: new Date('2026-05-31T00:00:00.000Z'),
      updatedAt: new Date('2026-05-31T01:00:00.000Z'),
    });
    const controller = new GroupsController({
      createForUser,
    } as unknown as GroupsService);

    await expect(
      controller.createGroup(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        {
          name: 'Foot 5',
          defaultLanguage: 'fr',
          playStyle: 'flexible',
          intensity: 'balanced',
          goalkeeperMode: 'rotating_goalkeeper',
          generatorStyle: 'fair_fresh',
        },
      ),
    ).resolves.toEqual({
      data: {
        group: {
          id: 'grp_123',
          name: 'Foot 5',
          ownerUserId: 'usr_123',
          currentUserRole: 'owner',
          settings: {
            defaultLanguage: 'fr',
            playStyle: 'flexible',
            intensity: 'balanced',
            goalkeeperMode: 'rotating_goalkeeper',
            generatorStyle: 'fair_fresh',
          },
          createdAt: '2026-05-31T00:00:00.000Z',
          updatedAt: '2026-05-31T01:00:00.000Z',
        },
      },
    });

    expect(createForUser).toHaveBeenCalledWith('user_123', {
      name: 'Foot 5',
      defaultLanguage: 'fr',
      playStyle: 'flexible',
      intensity: 'balanced',
      goalkeeperMode: 'rotating_goalkeeper',
      generatorStyle: 'fair_fresh',
    });
  });

  it('lists groups for the authenticated user', async () => {
    const listForUser = jest.fn().mockResolvedValue([
      {
        id: 'grp_123',
        name: 'Foot 5',
        ownerUserId: 'usr_123',
        currentUserRole: 'owner',
        settings: {
          defaultLanguage: 'fr',
          playStyle: 'flexible',
          intensity: 'balanced',
          goalkeeperMode: 'rotating_goalkeeper',
          generatorStyle: 'fair_fresh',
        },
        createdAt: new Date('2026-05-31T00:00:00.000Z'),
        updatedAt: new Date('2026-05-31T01:00:00.000Z'),
      },
    ]);
    const controller = new GroupsController({
      listForUser,
    } as unknown as GroupsService);

    await expect(
      controller.listCurrentUserGroups({
        auth: {
          clerkUserId: 'user_123',
        },
      } as AuthenticatedRequest),
    ).resolves.toEqual({
      data: {
        groups: [
          {
            id: 'grp_123',
            name: 'Foot 5',
            ownerUserId: 'usr_123',
            currentUserRole: 'owner',
            settings: {
              defaultLanguage: 'fr',
              playStyle: 'flexible',
              intensity: 'balanced',
              goalkeeperMode: 'rotating_goalkeeper',
              generatorStyle: 'fair_fresh',
            },
            createdAt: '2026-05-31T00:00:00.000Z',
            updatedAt: '2026-05-31T01:00:00.000Z',
          },
        ],
      },
    });

    expect(listForUser).toHaveBeenCalledWith('user_123');
  });

  it('creates an invitation for the authenticated group admin', async () => {
    const createInvitation = jest.fn().mockResolvedValue({
      id: 'inv_123',
      groupId: 'grp_123',
      groupName: 'Foot 5',
      createdByUserId: 'usr_123',
      token: 'invite-token',
      status: 'active',
      inviteUrl: 'fivematch://invite/invite-token',
      usageCount: 0,
      expiresAt: null,
      lastAcceptedAt: null,
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T01:00:00.000Z'),
    });
    const controller = new GroupsController({
      createInvitation,
    } as unknown as GroupsService);

    await expect(
      controller.createInvitation(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
      ),
    ).resolves.toEqual({
      data: {
        invitation: {
          id: 'inv_123',
          groupId: 'grp_123',
          groupName: 'Foot 5',
          createdByUserId: 'usr_123',
          token: 'invite-token',
          status: 'active',
          inviteUrl: 'fivematch://invite/invite-token',
          usageCount: 0,
          expiresAt: null,
          lastAcceptedAt: null,
          createdAt: '2026-06-02T00:00:00.000Z',
          updatedAt: '2026-06-02T01:00:00.000Z',
        },
      },
    });

    expect(createInvitation).toHaveBeenCalledWith('user_123', 'grp_123');
  });

  it('updates group settings for an authenticated manager', async () => {
    const updateSettings = jest.fn().mockResolvedValue({
      id: 'grp_123',
      name: 'Foot 5',
      ownerUserId: 'usr_123',
      currentUserRole: 'owner',
      settings: {
        defaultLanguage: 'fr',
        playStyle: 'fixed',
        intensity: 'competitive',
        goalkeeperMode: 'fixed_goalkeeper',
        generatorStyle: 'max_fairness',
      },
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T02:00:00.000Z'),
    });
    const controller = new GroupsController({
      updateSettings,
    } as unknown as GroupsService);

    await expect(
      controller.updateSettings(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        {
          playStyle: 'fixed',
          intensity: 'competitive',
          goalkeeperMode: 'fixed_goalkeeper',
          generatorStyle: 'max_fairness',
        },
      ),
    ).resolves.toMatchObject({
      data: {
        group: {
          id: 'grp_123',
          settings: {
            playStyle: 'fixed',
            generatorStyle: 'max_fairness',
          },
        },
      },
    });

    expect(updateSettings).toHaveBeenCalledWith('user_123', 'grp_123', {
      playStyle: 'fixed',
      intensity: 'competitive',
      goalkeeperMode: 'fixed_goalkeeper',
      generatorStyle: 'max_fairness',
    });
  });

  it('lists group members for an authenticated group member', async () => {
    const listMembers = jest.fn().mockResolvedValue([
      {
        id: 'mem_123',
        groupId: 'grp_123',
        userId: 'usr_member',
        role: 'member',
        user: {
          id: 'usr_member',
          emailAddress: 'member@example.com',
          firstName: 'Member',
          lastName: null,
          imageUrl: null,
        },
        joinedAt: new Date('2026-06-02T00:00:00.000Z'),
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
        updatedAt: new Date('2026-06-02T02:00:00.000Z'),
      },
    ]);
    const controller = new GroupsController({
      listMembers,
    } as unknown as GroupsService);

    await expect(
      controller.listMembers(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
      ),
    ).resolves.toEqual({
      data: {
        members: [
          {
            id: 'mem_123',
            groupId: 'grp_123',
            userId: 'usr_member',
            role: 'member',
            user: {
              id: 'usr_member',
              emailAddress: 'member@example.com',
              firstName: 'Member',
              lastName: null,
              imageUrl: null,
            },
            joinedAt: '2026-06-02T00:00:00.000Z',
            createdAt: '2026-06-02T00:00:00.000Z',
            updatedAt: '2026-06-02T02:00:00.000Z',
          },
        ],
      },
    });
  });

  it('updates a member role through the controller', async () => {
    const updateMemberRole = jest.fn().mockResolvedValue({
      id: 'mem_123',
      groupId: 'grp_123',
      userId: 'usr_member',
      role: 'admin',
      user: {
        id: 'usr_member',
        emailAddress: null,
        firstName: 'Member',
        lastName: null,
        imageUrl: null,
      },
      joinedAt: new Date('2026-06-02T00:00:00.000Z'),
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T02:00:00.000Z'),
    });
    const controller = new GroupsController({
      updateMemberRole,
    } as unknown as GroupsService);

    await expect(
      controller.updateMemberRole(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        'mem_123',
        {
          role: 'admin',
        },
      ),
    ).resolves.toMatchObject({
      data: {
        member: {
          id: 'mem_123',
          role: 'admin',
        },
      },
    });

    expect(updateMemberRole).toHaveBeenCalledWith(
      'user_123',
      'grp_123',
      'mem_123',
      {
        role: 'admin',
      },
    );
  });

  it('rejects owner role updates through the controller', async () => {
    const controller = new GroupsController({
      updateMemberRole: jest.fn(),
    } as unknown as GroupsService);

    await expect(
      controller.updateMemberRole(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        'grp_123',
        'mem_123',
        {
          role: 'owner',
        } as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unsupported group settings', async () => {
    const controller = new GroupsController({
      createForUser: jest.fn(),
    } as unknown as GroupsService);

    await expect(
      controller.createGroup(
        {
          auth: {
            clerkUserId: 'user_123',
          },
        } as AuthenticatedRequest,
        {
          name: 'Foot 5',
          defaultLanguage: 'fr',
          playStyle: 'arcade',
          intensity: 'balanced',
          goalkeeperMode: 'rotating_goalkeeper',
          generatorStyle: 'fair_fresh',
        } as never,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
