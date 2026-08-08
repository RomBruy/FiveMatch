import { describe, expect, it, vi } from 'vitest'
import { MATCH_MIN_PLAYABLE_TOTAL } from '@fivematch/types'

vi.mock('../../../db', () => ({ db: {} }))
vi.mock('../../notifications/notification.service', () => ({
  notificationService: { send: vi.fn() },
}))
vi.mock('../../trust/trust-projection.service', () => ({
  trustProjectionService: { getReliableFlags: vi.fn() },
}))

import { isPubliclyOpen } from '../attendance.service'
import { evaluateMatchCapabilities } from '../../permissions/capability.service'

const NOW = new Date('2026-09-01T12:00:00.000Z')
const hoursFromNow = (h: number) => new Date(NOW.getTime() + h * 60 * 60 * 1000)

describe('isPubliclyOpen', () => {
  it('is closed for a private match whatever the opening time says', () => {
    expect(isPubliclyOpen({ visibility: 'private', publicOpensAt: null }, NOW)).toBe(false)
    expect(isPubliclyOpen({ visibility: 'private', publicOpensAt: hoursFromNow(-1) }, NOW)).toBe(false)
  })

  it('is open immediately when public with no opening time', () => {
    // How every existing public match already behaves, so the new column
    // changes nothing for them.
    expect(isPubliclyOpen({ visibility: 'public', publicOpensAt: null }, NOW)).toBe(true)
  })

  it('holds a crew-first match private until its opening time', () => {
    expect(isPubliclyOpen({ visibility: 'public', publicOpensAt: hoursFromNow(6) }, NOW)).toBe(false)
    expect(isPubliclyOpen({ visibility: 'public', publicOpensAt: hoursFromNow(-6) }, NOW)).toBe(true)
  })

  it('opens exactly on the boundary', () => {
    // The crew's first refusal ends at the stated moment, not a second later.
    expect(isPubliclyOpen({ visibility: 'public', publicOpensAt: NOW }, NOW)).toBe(true)
  })
})

const base = {
  isHost: false,
  isActiveGroupOrganizer: false,
  isActiveGroupCoHost: false,
  isActiveGroupMember: false,
  hasConfirmedSeat: false,
  isFinalParticipant: false,
  isWaitlisted: false,
  attendanceStatus: null,
  matchVisibility: 'public' as const,
  matchStatus: 'attendance_open' as const,
  hasPublishedSpots: true,
  hasAvailableSpot: true,
}

describe('joining a published match', () => {
  it('lets an outsider join an open public match with room', () => {
    expect(evaluateMatchCapabilities(base).canJoin).toBe(true)
  })

  it('refuses an outsider before the crew-first window opens', () => {
    // The crew gets first refusal on their own fixture.
    const beforeOpening = { ...base, hasPublishedSpots: false }
    expect(evaluateMatchCapabilities(beforeOpening).canJoin).toBe(false)
    expect(evaluateMatchCapabilities(beforeOpening).canJoinWaitlist).toBe(false)
  })

  it('offers the waitlist rather than nothing when a published match is full', () => {
    const full = { ...base, hasAvailableSpot: false }
    expect(evaluateMatchCapabilities(full).canJoin).toBe(false)
    expect(evaluateMatchCapabilities(full).canJoinWaitlist).toBe(true)
  })

  it('does not offer joining to someone already in', () => {
    expect(evaluateMatchCapabilities({ ...base, hasConfirmedSeat: true }).canJoin).toBe(false)
    expect(evaluateMatchCapabilities({ ...base, isWaitlisted: true }).canJoin).toBe(false)
  })
})

describe('minimum playable size', () => {
  it('is four, not nominal capacity', () => {
    // A 5v5 that ends up 4v4 is a normal Wednesday. The host decides whether the
    // game is on; the app only refuses when there is no game to play (ADR-032).
    expect(MATCH_MIN_PLAYABLE_TOTAL).toBe(4)
  })
})
