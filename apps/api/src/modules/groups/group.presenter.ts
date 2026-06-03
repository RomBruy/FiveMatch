import type {
  FootballGroup,
  FootballGroupInvitation,
  FootballGroupMember,
} from '@fit-five/shared';
import type {
  InternalFootballGroup,
  InternalFootballGroupInvitation,
  InternalFootballGroupMember,
} from './groups.service';

export function serializeFootballGroup(
  group: InternalFootballGroup,
): FootballGroup {
  return {
    id: group.id,
    name: group.name,
    ownerUserId: group.ownerUserId,
    currentUserRole: group.currentUserRole,
    settings: group.settings,
    createdAt: group.createdAt.toISOString(),
    updatedAt: group.updatedAt.toISOString(),
  };
}

export function serializeFootballGroupInvitation(
  invitation: InternalFootballGroupInvitation,
): FootballGroupInvitation {
  return {
    id: invitation.id,
    groupId: invitation.groupId,
    groupName: invitation.groupName,
    createdByUserId: invitation.createdByUserId,
    token: invitation.token,
    status: invitation.status,
    inviteUrl: invitation.inviteUrl,
    usageCount: invitation.usageCount,
    expiresAt: invitation.expiresAt?.toISOString() ?? null,
    lastAcceptedAt: invitation.lastAcceptedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
    updatedAt: invitation.updatedAt.toISOString(),
  };
}

export function serializeFootballGroupMember(
  member: InternalFootballGroupMember,
): FootballGroupMember {
  return {
    id: member.id,
    groupId: member.groupId,
    userId: member.userId,
    role: member.role,
    user: member.user,
    joinedAt: member.joinedAt.toISOString(),
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
  };
}
