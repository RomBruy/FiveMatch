import { describe, expect, it } from 'vitest'
import {
  AttendanceResponseSchema,
  MatchDetailResponseSchema,
  PrivatePlayerProfileSchema,
  PublicMatchPreviewSchema,
  PublicPlayerProfileSchema,
} from '@fivematch/types'
import { findForbiddenResponseFields } from './contract-assertions'

const publicMatch = {
  matchId: 'match-1',
  audience: 'public',
  scheduledAt: '2026-08-10T18:30:00.000Z',
  durationMinutes: 60,
  city: 'Geneva',
  format: '5v5',
  skillLevel: 'intermediate',
  pricePerPlayer: 12.5,
  currency: 'CHF',
  status: 'attendance_open',
  publication: { isPublic: true },
  availability: { confirmedCount: 7, capacity: 10, spotsRemaining: 3, canJoin: true, canWaitlist: false },
  host: { displayName: 'Host' },
}

describe('Phase 2 strict public schemas', () => {
  it('rejects exact location, internal IDs, notes, configuration and attendance identity', () => {
    expect(PublicMatchPreviewSchema.safeParse(publicMatch).success).toBe(true)
    for (const [key, value] of [
      ['venueName', 'Private Arena'], ['location', '1 Secret Street'], ['latitude', 46.2],
      ['groupId', 'group-1'], ['hostId', 'user-1'], ['notes', 'door code'],
      ['config', { generatorStyle: 'mixed' }], ['waitlist', [{ playerId: 'player-1' }]],
    ] as const) {
      expect(PublicMatchPreviewSchema.safeParse({ ...publicMatch, [key]: value }).success, key).toBe(false)
    }
  })

  it('keeps public and owner profile schemas structurally separate', () => {
    const publicProfile = {
      playerId: 'player-1', displayName: 'Player', skillLevel: 'casual', cardState: 'not_started',
      eligibleMatchCount: 0, ovrScore: null, trend: null, isReliable: false, ratingAggregate: null,
    }
    expect(PublicPlayerProfileSchema.safeParse(publicProfile).success).toBe(true)
    expect(PublicPlayerProfileSchema.safeParse({ ...publicProfile, visibility: { specialSkill: 'public' } }).success).toBe(false)
    expect(PrivatePlayerProfileSchema.safeParse(publicProfile).success).toBe(false)
  })

  it('never lets a raw trust score reach a public profile', () => {
    const publicProfile = {
      playerId: 'player-1', displayName: 'Player', skillLevel: 'casual', cardState: 'not_started',
      eligibleMatchCount: 12, ovrScore: null, trend: null, isReliable: true, ratingAggregate: null,
    }

    // A stranger gets the earned mark and nothing else. These three fields are
    // the exposure ADR-019 rejects: a visible negative excludes people at a cost
    // out of proportion to missing recreational football.
    expect(PublicPlayerProfileSchema.safeParse({ ...publicProfile, reliability: 42 }).success).toBe(false)
    expect(PublicPlayerProfileSchema.safeParse({ ...publicProfile, fairPlay: 30 }).success).toBe(false)
    expect(PublicPlayerProfileSchema.safeParse({ ...publicProfile, trust: { reliability: 42 } }).success).toBe(false)
  })

  it('accepts only an explicit match-detail and attendance audience variant', () => {
    expect(MatchDetailResponseSchema.safeParse(publicMatch).success).toBe(true)
    expect(AttendanceResponseSchema.safeParse({
      audience: 'viewer', counts: { confirmed: 7, waitlist: 1, pending: 2 }, self: null,
    }).success).toBe(true)
    expect(AttendanceResponseSchema.safeParse({
      audience: 'viewer', counts: { confirmed: 7, waitlist: 1, pending: 2 }, self: null,
      waitlist: [{ playerId: 'player-1', displayName: 'Hidden' }],
    }).success).toBe(false)
  })

  it('recursively detects cross-surface internal and identity-bearing fields', () => {
    const unsafe = {
      group: { organizer: { user_id: 'internal-user' } },
      match: { privateNotes: 'code', coordinates: { latitude: 1, longitude: 2 } },
      report: { reporterPlayerId: 'reporter' },
    }
    expect(findForbiddenResponseFields(unsafe)).toEqual([
      '$.group.organizer.user_id',
      '$.match.privateNotes',
      '$.match.coordinates.latitude',
      '$.match.coordinates.longitude',
      '$.report.reporterPlayerId',
    ])
  })
})
