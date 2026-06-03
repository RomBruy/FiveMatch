import type { AuthenticatedRequest } from '../auth/auth.types';
import { GroupsService } from './groups.service';
import { InvitationsController } from './invitations.controller';

describe('InvitationsController', () => {
  it('accepts an invitation for the authenticated user', async () => {
    const acceptInvitation = jest.fn().mockResolvedValue({
      invitation: {
        id: 'inv_123',
        groupId: 'grp_123',
        groupName: 'Foot 5',
        createdByUserId: 'usr_owner',
        token: 'invite-token',
        status: 'active',
        inviteUrl: 'fivematch://invite/invite-token',
        usageCount: 1,
        expiresAt: null,
        lastAcceptedAt: new Date('2026-06-02T02:00:00.000Z'),
        createdAt: new Date('2026-06-02T00:00:00.000Z'),
        updatedAt: new Date('2026-06-02T02:00:00.000Z'),
      },
      group: {
        id: 'grp_123',
        name: 'Foot 5',
        ownerUserId: 'usr_owner',
        currentUserRole: 'member',
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
      nextAction: 'create_player_profile',
    });
    const controller = new InvitationsController({
      acceptInvitation,
    } as unknown as GroupsService);

    await expect(
      controller.acceptInvitation(
        {
          auth: {
            clerkUserId: 'user_joiner',
          },
        } as AuthenticatedRequest,
        'invite-token',
      ),
    ).resolves.toEqual({
      data: {
        invitation: {
          id: 'inv_123',
          groupId: 'grp_123',
          groupName: 'Foot 5',
          createdByUserId: 'usr_owner',
          token: 'invite-token',
          status: 'active',
          inviteUrl: 'fivematch://invite/invite-token',
          usageCount: 1,
          expiresAt: null,
          lastAcceptedAt: '2026-06-02T02:00:00.000Z',
          createdAt: '2026-06-02T00:00:00.000Z',
          updatedAt: '2026-06-02T02:00:00.000Z',
        },
        group: {
          id: 'grp_123',
          name: 'Foot 5',
          ownerUserId: 'usr_owner',
          currentUserRole: 'member',
          settings: {
            defaultLanguage: 'fr',
            playStyle: 'flexible',
            intensity: 'balanced',
            goalkeeperMode: 'rotating_goalkeeper',
            generatorStyle: 'fair_fresh',
          },
          createdAt: '2026-06-02T00:00:00.000Z',
          updatedAt: '2026-06-02T01:00:00.000Z',
        },
        nextAction: 'create_player_profile',
      },
    });

    expect(acceptInvitation).toHaveBeenCalledWith(
      'user_joiner',
      'invite-token',
    );
  });
});
