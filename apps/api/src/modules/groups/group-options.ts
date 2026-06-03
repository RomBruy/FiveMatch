import type {
  GroupGeneratorStyle,
  GroupGoalkeeperMode,
  GroupIntensity,
  GroupInvitationStatus,
  GroupMemberRole,
  GroupPlayStyle,
  SupportedLocale,
} from '@fit-five/shared';

export const DEFAULT_GROUP_SETTINGS = {
  defaultLanguage: 'fr',
  playStyle: 'flexible',
  intensity: 'balanced',
  goalkeeperMode: 'rotating_goalkeeper',
  generatorStyle: 'fair_fresh',
  memberRole: 'owner',
} as const satisfies {
  defaultLanguage: SupportedLocale;
  playStyle: GroupPlayStyle;
  intensity: GroupIntensity;
  goalkeeperMode: GroupGoalkeeperMode;
  generatorStyle: GroupGeneratorStyle;
  memberRole: GroupMemberRole;
};

const supportedGroupLanguages = ['fr', 'en'] as const;
const supportedPlayStyles = [
  'fixed',
  'flexible',
  'rotating',
  'hybrid',
] as const;
const supportedIntensities = ['chill', 'balanced', 'competitive'] as const;
const supportedGoalkeeperModes = [
  'fixed_goalkeeper',
  'rotating_goalkeeper',
  'no_goalkeeper',
] as const;
const supportedGeneratorStyles = [
  'fair_fresh',
  'max_fairness',
  'more_variety',
] as const;
const supportedMemberRoles = ['owner', 'admin', 'member'] as const;
const supportedInvitationStatuses = ['active', 'revoked'] as const;

function isOneOf<const TValue extends readonly string[]>(
  value: unknown,
  values: TValue,
): value is TValue[number] {
  return typeof value === 'string' && values.includes(value);
}

export function isSupportedGroupLanguage(
  value: unknown,
): value is SupportedLocale {
  return isOneOf(value, supportedGroupLanguages);
}

export function isSupportedGroupPlayStyle(
  value: unknown,
): value is GroupPlayStyle {
  return isOneOf(value, supportedPlayStyles);
}

export function isSupportedGroupIntensity(
  value: unknown,
): value is GroupIntensity {
  return isOneOf(value, supportedIntensities);
}

export function isSupportedGroupGoalkeeperMode(
  value: unknown,
): value is GroupGoalkeeperMode {
  return isOneOf(value, supportedGoalkeeperModes);
}

export function isSupportedGroupGeneratorStyle(
  value: unknown,
): value is GroupGeneratorStyle {
  return isOneOf(value, supportedGeneratorStyles);
}

export function normalizeGroupLanguage(value: unknown): SupportedLocale {
  return isSupportedGroupLanguage(value)
    ? value
    : DEFAULT_GROUP_SETTINGS.defaultLanguage;
}

export function normalizeGroupPlayStyle(value: unknown): GroupPlayStyle {
  return isSupportedGroupPlayStyle(value)
    ? value
    : DEFAULT_GROUP_SETTINGS.playStyle;
}

export function normalizeGroupIntensity(value: unknown): GroupIntensity {
  return isSupportedGroupIntensity(value)
    ? value
    : DEFAULT_GROUP_SETTINGS.intensity;
}

export function normalizeGroupGoalkeeperMode(
  value: unknown,
): GroupGoalkeeperMode {
  return isSupportedGroupGoalkeeperMode(value)
    ? value
    : DEFAULT_GROUP_SETTINGS.goalkeeperMode;
}

export function normalizeGroupGeneratorStyle(
  value: unknown,
): GroupGeneratorStyle {
  return isSupportedGroupGeneratorStyle(value)
    ? value
    : DEFAULT_GROUP_SETTINGS.generatorStyle;
}

export function normalizeGroupMemberRole(value: unknown): GroupMemberRole {
  return isOneOf(value, supportedMemberRoles)
    ? value
    : DEFAULT_GROUP_SETTINGS.memberRole;
}

export function normalizeGroupInvitationStatus(
  value: unknown,
): GroupInvitationStatus {
  return isOneOf(value, supportedInvitationStatuses) ? value : 'active';
}

export function canManageGroupInvitations(role: GroupMemberRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canUpdateGroupSettings(role: GroupMemberRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageGroupMembers(role: GroupMemberRole): boolean {
  return role === 'owner';
}
