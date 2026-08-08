import {
  PROFILE_VISIBILITY_FIELDS,
  ProfileFieldVisibilitySchema,
  type ProfileFieldVisibility,
  type ProfileVisibilityAudience,
} from '@fivematch/types'

export const DEFAULT_PROFILE_FIELD_VISIBILITY = Object.freeze(
  Object.fromEntries(PROFILE_VISIBILITY_FIELDS.map((field) => [field, 'private'])) as ProfileFieldVisibility,
)

export interface ProfileViewerScope {
  isOwner: boolean
  sharesActiveGroup: boolean
  sharesConfirmedMatch: boolean
}

export function normalizeProfileFieldVisibility(value: unknown): ProfileFieldVisibility {
  const source = value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
  const normalized = Object.fromEntries(PROFILE_VISIBILITY_FIELDS.map((field) => {
    const candidate = source[field]
    return [field, ['private', 'group', 'participants', 'public'].includes(String(candidate)) ? candidate : 'private']
  }))
  return ProfileFieldVisibilitySchema.parse(normalized)
}

export function canViewerSeeProfileField(
  audience: ProfileVisibilityAudience,
  scope: ProfileViewerScope,
): boolean {
  if (scope.isOwner) return true
  if (audience === 'public') return true
  if (audience === 'group') return scope.sharesActiveGroup
  if (audience === 'participants') return scope.sharesConfirmedMatch
  return false
}
