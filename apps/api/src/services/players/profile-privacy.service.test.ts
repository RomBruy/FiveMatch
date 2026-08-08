import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROFILE_FIELD_VISIBILITY,
  canViewerSeeProfileField,
  normalizeProfileFieldVisibility,
} from './profile-privacy.service'

describe('profile field visibility', () => {
  it('defaults every missing or invalid setting to private', () => {
    const normalized = normalizeProfileFieldVisibility({ profilePhoto: 'public', specialSkill: 'invalid' })
    expect(normalized.profilePhoto).toBe('public')
    expect(normalized.specialSkill).toBe('private')
    expect(normalized.favoriteExcuse).toBe('private')
    expect(normalized).toEqual({ ...DEFAULT_PROFILE_FIELD_VISIBILITY, profilePhoto: 'public' })
  })

  it('treats group and participant audiences independently', () => {
    expect(canViewerSeeProfileField('group', { isOwner: false, sharesActiveGroup: true, sharesConfirmedMatch: false })).toBe(true)
    expect(canViewerSeeProfileField('group', { isOwner: false, sharesActiveGroup: false, sharesConfirmedMatch: true })).toBe(false)
    expect(canViewerSeeProfileField('participants', { isOwner: false, sharesActiveGroup: true, sharesConfirmedMatch: false })).toBe(false)
    expect(canViewerSeeProfileField('participants', { isOwner: false, sharesActiveGroup: false, sharesConfirmedMatch: true })).toBe(true)
  })

  it('always grants the owner and grants public fields to any viewer', () => {
    expect(canViewerSeeProfileField('private', { isOwner: true, sharesActiveGroup: false, sharesConfirmedMatch: false })).toBe(true)
    expect(canViewerSeeProfileField('public', { isOwner: false, sharesActiveGroup: false, sharesConfirmedMatch: false })).toBe(true)
  })
})

