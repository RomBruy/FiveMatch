import type { SupportedLocale } from "../localization/index.js";
import type { ApiSuccessResponse } from "./responses.js";

export const groupPlayStyles = [
  "fixed",
  "flexible",
  "rotating",
  "hybrid",
] as const;
export const groupIntensities = ["chill", "balanced", "competitive"] as const;
export const groupGoalkeeperModes = [
  "fixed_goalkeeper",
  "rotating_goalkeeper",
  "no_goalkeeper",
] as const;
export const groupGeneratorStyles = [
  "fair_fresh",
  "max_fairness",
  "more_variety",
] as const;
export const groupMemberRoles = ["owner", "admin", "member"] as const;
export const groupInvitationStatuses = ["active", "revoked"] as const;
export const groupInviteAcceptNextActions = ["create_player_profile"] as const;

export type GroupPlayStyle = (typeof groupPlayStyles)[number];
export type GroupIntensity = (typeof groupIntensities)[number];
export type GroupGoalkeeperMode = (typeof groupGoalkeeperModes)[number];
export type GroupGeneratorStyle = (typeof groupGeneratorStyles)[number];
export type GroupMemberRole = (typeof groupMemberRoles)[number];
export type GroupInvitationStatus = (typeof groupInvitationStatuses)[number];
export type GroupInviteAcceptNextAction =
  (typeof groupInviteAcceptNextActions)[number];

export type FootballGroupSettings = {
  defaultLanguage: SupportedLocale;
  playStyle: GroupPlayStyle;
  intensity: GroupIntensity;
  goalkeeperMode: GroupGoalkeeperMode;
  generatorStyle: GroupGeneratorStyle;
};

export type FootballGroup = {
  id: string;
  name: string;
  ownerUserId: string;
  currentUserRole: GroupMemberRole;
  settings: FootballGroupSettings;
  createdAt: string;
  updatedAt: string;
};

export type CreateFootballGroupInput = {
  name: string;
} & FootballGroupSettings;

export type UpdateFootballGroupSettingsInput = Pick<
  FootballGroupSettings,
  "playStyle" | "intensity" | "goalkeeperMode" | "generatorStyle"
>;

export type FootballGroupMember = {
  id: string;
  groupId: string;
  userId: string;
  role: GroupMemberRole;
  user: {
    id: string;
    emailAddress: string | null;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  };
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type UpdateFootballGroupMemberRoleInput = {
  role: Exclude<GroupMemberRole, "owner">;
};

export type FootballGroupMembersResponse = ApiSuccessResponse<{
  members: FootballGroupMember[];
}>;

export type UpdateFootballGroupSettingsResponse = ApiSuccessResponse<{
  group: FootballGroup;
}>;

export type UpdateFootballGroupMemberRoleResponse = ApiSuccessResponse<{
  member: FootballGroupMember;
}>;

export type RemoveFootballGroupMemberResponse = ApiSuccessResponse<{
  removedMemberId: string;
}>;

export type FootballGroupInvitation = {
  id: string;
  groupId: string;
  groupName: string;
  createdByUserId: string;
  token: string;
  status: GroupInvitationStatus;
  inviteUrl: string;
  usageCount: number;
  expiresAt: string | null;
  lastAcceptedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateFootballGroupInvitationResponse = ApiSuccessResponse<{
  invitation: FootballGroupInvitation;
}>;

export type AcceptFootballGroupInvitationResponse = ApiSuccessResponse<{
  invitation: FootballGroupInvitation;
  group: FootballGroup;
  nextAction: GroupInviteAcceptNextAction;
}>;

export type FootballGroupsResponse = ApiSuccessResponse<{
  groups: FootballGroup[];
}>;

export type CreateFootballGroupResponse = ApiSuccessResponse<{
  group: FootballGroup;
}>;
