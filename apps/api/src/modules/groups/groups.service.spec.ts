import { GroupsService } from './groups.service';
import { PrismaService } from '../prisma/prisma.service';

describe('GroupsService', () => {
  it('creates a group with owner membership transactionally', async () => {
    const userUpsert = jest.fn().mockResolvedValue({
      id: 'usr_123',
    });
    const groupCreate = jest.fn().mockResolvedValue({
      id: 'grp_123',
      name: 'Foot 5 du mercredi soir',
      ownerUserId: 'usr_123',
      settings: {
        defaultLanguage: 'fr',
        playStyle: 'flexible',
        intensity: 'balanced',
        goalkeeperMode: 'rotating_goalkeeper',
        generatorStyle: 'fair_fresh',
      },
      members: [
        {
          role: 'owner',
        },
      ],
      createdAt: new Date('2026-05-31T00:00:00.000Z'),
      updatedAt: new Date('2026-05-31T01:00:00.000Z'),
    });
    const transaction = jest.fn((callback: (client: unknown) => unknown) =>
      callback({
        user: {
          upsert: userUpsert,
        },
        group: {
          create: groupCreate,
        },
      }),
    );

    const service = new GroupsService({
      $transaction: transaction,
    } as unknown as PrismaService);

    await expect(
      service.createForUser('user_123', {
        name: '  Foot 5 du mercredi soir  ',
        defaultLanguage: 'fr',
        playStyle: 'flexible',
        intensity: 'balanced',
        goalkeeperMode: 'rotating_goalkeeper',
        generatorStyle: 'fair_fresh',
      }),
    ).resolves.toMatchObject({
      id: 'grp_123',
      currentUserRole: 'owner',
      settings: {
        defaultLanguage: 'fr',
        playStyle: 'flexible',
      },
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(userUpsert).toHaveBeenCalledWith({
      where: {
        clerkUserId: 'user_123',
      },
      create: {
        clerkUserId: 'user_123',
      },
      update: {},
      select: {
        id: true,
      },
    });
    expect(groupCreate).toHaveBeenCalledWith({
      data: {
        name: 'Foot 5 du mercredi soir',
        ownerUserId: 'usr_123',
        settings: {
          create: {
            defaultLanguage: 'fr',
            playStyle: 'flexible',
            intensity: 'balanced',
            goalkeeperMode: 'rotating_goalkeeper',
            generatorStyle: 'fair_fresh',
          },
        },
        members: {
          create: {
            userId: 'usr_123',
            role: 'owner',
          },
        },
      },
      include: {
        settings: true,
        members: {
          where: {
            userId: 'usr_123',
          },
          take: 1,
        },
      },
    });
  });

  it('lists groups for the authenticated user memberships', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'usr_123',
    });
    const findMany = jest.fn().mockResolvedValue([
      {
        role: 'owner',
        group: {
          id: 'grp_123',
          name: 'Foot 5',
          ownerUserId: 'usr_123',
          settings: {
            defaultLanguage: 'en',
            playStyle: 'fixed',
            intensity: 'competitive',
            goalkeeperMode: 'fixed_goalkeeper',
            generatorStyle: 'max_fairness',
          },
          createdAt: new Date('2026-05-31T00:00:00.000Z'),
          updatedAt: new Date('2026-05-31T01:00:00.000Z'),
        },
      },
    ]);

    const service = new GroupsService({
      user: {
        findUnique,
      },
      groupMember: {
        findMany,
      },
    } as unknown as PrismaService);

    await expect(service.listForUser('user_123')).resolves.toEqual([
      {
        id: 'grp_123',
        name: 'Foot 5',
        ownerUserId: 'usr_123',
        currentUserRole: 'owner',
        settings: {
          defaultLanguage: 'en',
          playStyle: 'fixed',
          intensity: 'competitive',
          goalkeeperMode: 'fixed_goalkeeper',
          generatorStyle: 'max_fairness',
        },
        createdAt: new Date('2026-05-31T00:00:00.000Z'),
        updatedAt: new Date('2026-05-31T01:00:00.000Z'),
      },
    ]);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId: 'usr_123',
      },
      include: {
        group: {
          include: {
            settings: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });
  });

  it('creates an invitation when the user is a group admin', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'usr_123',
    });
    const findFirst = jest.fn().mockResolvedValue({
      role: 'admin',
    });
    const create = jest.fn().mockResolvedValue({
      id: 'inv_123',
      groupId: 'grp_123',
      createdByUserId: 'usr_123',
      token: 'invite-token',
      status: 'active',
      usageCount: 0,
      expiresAt: null,
      lastAcceptedAt: null,
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T01:00:00.000Z'),
      group: {
        name: 'Foot 5',
        settings: null,
      },
    });

    const service = new GroupsService({
      user: {
        findUnique,
      },
      groupMember: {
        findFirst,
      },
      invitation: {
        create,
      },
    } as unknown as PrismaService);

    await expect(
      service.createInvitation('user_123', 'grp_123'),
    ).resolves.toMatchObject({
      id: 'inv_123',
      groupId: 'grp_123',
      groupName: 'Foot 5',
      status: 'active',
      inviteUrl: 'fivematch://invite/invite-token',
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        groupId: 'grp_123',
        createdByUserId: 'usr_123',
        token: expect.any(String) as string,
        status: 'active',
      },
      include: {
        group: {
          include: {
            settings: true,
          },
        },
      },
    });
  });

  it('accepts an active invitation and creates member membership', async () => {
    const invitationFindUnique = jest.fn().mockResolvedValue({
      id: 'inv_123',
      groupId: 'grp_123',
      createdByUserId: 'usr_owner',
      token: 'invite-token',
      status: 'active',
      usageCount: 0,
      expiresAt: null,
      lastAcceptedAt: null,
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T01:00:00.000Z'),
      group: {
        id: 'grp_123',
        name: 'Foot 5',
        ownerUserId: 'usr_owner',
        settings: {
          defaultLanguage: 'fr',
          playStyle: 'flexible',
          intensity: 'balanced',
          goalkeeperMode: 'rotating_goalkeeper',
          generatorStyle: 'fair_fresh',
        },
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
        updatedAt: new Date('2026-06-02T01:00:00.000Z'),
      },
    });
    const userUpsert = jest.fn().mockResolvedValue({
      id: 'usr_joiner',
    });
    const membershipFindFirst = jest.fn().mockResolvedValue(null);
    const membershipCreate = jest.fn().mockResolvedValue({
      role: 'member',
    });
    const invitationUpdate = jest.fn().mockResolvedValue({
      id: 'inv_123',
      groupId: 'grp_123',
      createdByUserId: 'usr_owner',
      token: 'invite-token',
      status: 'active',
      usageCount: 1,
      expiresAt: null,
      lastAcceptedAt: new Date('2026-06-02T02:00:00.000Z'),
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T02:00:00.000Z'),
      group: {
        id: 'grp_123',
        name: 'Foot 5',
        ownerUserId: 'usr_owner',
        settings: {
          defaultLanguage: 'fr',
          playStyle: 'flexible',
          intensity: 'balanced',
          goalkeeperMode: 'rotating_goalkeeper',
          generatorStyle: 'fair_fresh',
        },
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
        updatedAt: new Date('2026-06-02T02:00:00.000Z'),
      },
    });
    const transaction = jest.fn((callback: (client: unknown) => unknown) =>
      callback({
        invitation: {
          findUnique: invitationFindUnique,
          update: invitationUpdate,
        },
        user: {
          upsert: userUpsert,
        },
        groupMember: {
          findFirst: membershipFindFirst,
          create: membershipCreate,
        },
      }),
    );

    const service = new GroupsService({
      $transaction: transaction,
    } as unknown as PrismaService);

    await expect(
      service.acceptInvitation(
        'user_joiner',
        'fivematch://invite/invite-token',
      ),
    ).resolves.toMatchObject({
      group: {
        id: 'grp_123',
        currentUserRole: 'member',
      },
      invitation: {
        usageCount: 1,
        inviteUrl: 'fivematch://invite/invite-token',
      },
      nextAction: 'create_player_profile',
    });

    expect(membershipCreate).toHaveBeenCalledWith({
      data: {
        groupId: 'grp_123',
        userId: 'usr_joiner',
        role: 'member',
      },
    });
    expect(invitationUpdate).toHaveBeenCalledWith({
      where: {
        id: 'inv_123',
      },
      data: {
        usageCount: {
          increment: 1,
        },
        lastAcceptedAt: expect.any(Date) as Date,
      },
      include: {
        group: {
          include: {
            settings: true,
          },
        },
      },
    });
  });

  it('updates group settings when the actor is an admin', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'usr_admin',
    });
    const findFirst = jest.fn().mockResolvedValue({
      role: 'admin',
    });
    const update = jest.fn().mockResolvedValue({
      id: 'grp_123',
      name: 'Foot 5',
      ownerUserId: 'usr_owner',
      settings: {
        defaultLanguage: 'fr',
        playStyle: 'fixed',
        intensity: 'competitive',
        goalkeeperMode: 'fixed_goalkeeper',
        generatorStyle: 'max_fairness',
      },
      members: [
        {
          role: 'admin',
        },
      ],
      createdAt: new Date('2026-06-02T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T02:00:00.000Z'),
    });

    const service = new GroupsService({
      user: {
        findUnique,
      },
      groupMember: {
        findFirst,
      },
      group: {
        update,
      },
    } as unknown as PrismaService);

    await expect(
      service.updateSettings('user_admin', 'grp_123', {
        playStyle: 'fixed',
        intensity: 'competitive',
        goalkeeperMode: 'fixed_goalkeeper',
        generatorStyle: 'max_fairness',
      }),
    ).resolves.toMatchObject({
      currentUserRole: 'admin',
      settings: {
        playStyle: 'fixed',
        intensity: 'competitive',
      },
    });

    expect(update).toHaveBeenCalledWith({
      where: {
        id: 'grp_123',
      },
      data: {
        settings: {
          update: {
            playStyle: 'fixed',
            intensity: 'competitive',
            goalkeeperMode: 'fixed_goalkeeper',
            generatorStyle: 'max_fairness',
          },
        },
      },
      include: {
        settings: true,
        members: {
          where: {
            userId: 'usr_admin',
          },
          take: 1,
        },
      },
    });
  });

  it('updates a non-owner member role when the actor is owner', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      id: 'usr_owner',
    });
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce({
        role: 'owner',
      })
      .mockResolvedValueOnce({
        id: 'mem_123',
        role: 'member',
        user: {
          id: 'usr_member',
          emailAddress: 'member@example.com',
          firstName: 'Member',
          lastName: null,
          imageUrl: null,
        },
      });
    const update = jest.fn().mockResolvedValue({
      id: 'mem_123',
      groupId: 'grp_123',
      userId: 'usr_member',
      role: 'admin',
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
    });

    const service = new GroupsService({
      user: {
        findUnique,
      },
      groupMember: {
        findFirst,
        update,
      },
    } as unknown as PrismaService);

    await expect(
      service.updateMemberRole('user_owner', 'grp_123', 'mem_123', {
        role: 'admin',
      }),
    ).resolves.toMatchObject({
      id: 'mem_123',
      role: 'admin',
      user: {
        firstName: 'Member',
      },
    });

    expect(update).toHaveBeenCalledWith({
      where: {
        id: 'mem_123',
      },
      data: {
        role: 'admin',
      },
      include: {
        user: {
          select: {
            id: true,
            emailAddress: true,
            firstName: true,
            lastName: true,
            imageUrl: true,
          },
        },
      },
    });
  });

  it('blocks member management when the actor is not owner', async () => {
    const service = new GroupsService({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'usr_admin',
        }),
      },
      groupMember: {
        findFirst: jest.fn().mockResolvedValue({
          role: 'admin',
        }),
      },
    } as unknown as PrismaService);

    await expect(
      service.updateMemberRole('user_admin', 'grp_123', 'mem_123', {
        role: 'member',
      }),
    ).rejects.toThrow('Owner role required.');
  });

  it('does not remove the owner membership', async () => {
    const service = new GroupsService({
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'usr_owner',
        }),
      },
      groupMember: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            role: 'owner',
          })
          .mockResolvedValueOnce({
            id: 'mem_owner',
            role: 'owner',
          }),
      },
    } as unknown as PrismaService);

    await expect(
      service.removeMember('user_owner', 'grp_123', 'mem_owner'),
    ).rejects.toThrow('Owner membership cannot be removed.');
  });
});
