import { describe, expect, it } from 'vitest'
import { evaluateMatchCapabilities } from './capability.service'

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

describe('Phase 2 explicit match capability matrix', () => {
  it.each([
    ['out', { attendanceStatus: 'out' as const }],
    ['unknown', { attendanceStatus: 'unknown' as const }],
    ['waitlisted', { attendanceStatus: 'in' as const, isWaitlisted: true }],
  ])('%s does not become a participant', (_label, state) => {
    const result = evaluateMatchCapabilities({ ...base, ...state })
    expect(result.viewerRelation).toBe('viewer')
    expect(result.canViewExactLocation).toBe(false)
    expect(result.canViewParticipantRoster).toBe(false)
    expect(result.canRate).toBe(false)
    expect(result.canLeave).toBe('isWaitlisted' in state && state.isWaitlisted === true)
  })

  it('keeps an active group member distinct from a confirmed participant', () => {
    const result = evaluateMatchCapabilities({ ...base, isActiveGroupMember: true })
    expect(result.viewerRelation).toBe('crew')
    expect(result.canViewExactLocation).toBe(false)
    expect(result.canViewParticipantRoster).toBe(false)
    expect(result.canSubmitProno).toBe(true)
    expect(result.canRate).toBe(false)
  })

  it('grants participant details only to a confirmed seat or final snapshot', () => {
    for (const state of [{ hasConfirmedSeat: true }, { isFinalParticipant: true }]) {
      const result = evaluateMatchCapabilities({ ...base, ...state })
      expect(result.viewerRelation).toBe('participant')
      expect(result.canViewExactLocation).toBe(true)
      expect(result.canViewParticipantRoster).toBe(true)
    }
  })

  it('treats host, organizer and co-host as managers', () => {
    for (const state of [{ isHost: true }, { isActiveGroupOrganizer: true }, { isActiveGroupCoHost: true }]) {
      const result = evaluateMatchCapabilities({ ...base, ...state })
      expect(result.viewerRelation).toBe('host')
      expect(result.canManageAttendance).toBe(true)
      expect(result.canViewWaitlist).toBe(true)
      expect(result.canViewPendingGroupAttendance).toBe(true)
      expect(result.canViewPrivateNotes).toBe(true)
    }
  })
})

describe('Phase 3D dispute and reporting capabilities', () => {
  it('grants reporting only to a final participant of a completed match', () => {
    expect(evaluateMatchCapabilities({
      ...base, isFinalParticipant: true, matchStatus: 'completed',
    }).canReportAttendance).toBe(true)

    // A confirmed seat is an intention, not evidence you were there to see it.
    expect(evaluateMatchCapabilities({
      ...base, hasConfirmedSeat: true, matchStatus: 'completed',
    }).canReportAttendance).toBe(false)

    expect(evaluateMatchCapabilities({
      ...base, isFinalParticipant: true, matchStatus: 'attendance_open',
    }).canReportAttendance).toBe(false)
  })

  it('grants dispute authority to crew organizer and co-host only', () => {
    expect(evaluateMatchCapabilities({ ...base, isActiveGroupOrganizer: true }).canResolveDispute).toBe(true)
    expect(evaluateMatchCapabilities({ ...base, isActiveGroupCoHost: true }).canResolveDispute).toBe(true)
    expect(evaluateMatchCapabilities({ ...base, isActiveGroupMember: true }).canResolveDispute).toBe(false)
    expect(evaluateMatchCapabilities({ ...base, isFinalParticipant: true }).canResolveDispute).toBe(false)
  })

  it('gives a standalone host no dispute authority', () => {
    // No crew means no impartial authority exists. The host is not a substitute
    // for one — that is what corroboration and expiry are for (ADR-027).
    const result = evaluateMatchCapabilities({ ...base, isHost: true })
    expect(result.canManageAttendance).toBe(true)
    expect(result.canResolveDispute).toBe(false)
  })

  it('lets a non-playing host bet on their own standalone match', () => {
    // Neither participant nor crew member, and previously locked out entirely.
    const result = evaluateMatchCapabilities({ ...base, isHost: true })
    expect(result.canSubmitProno).toBe(true)
  })

  it('still denies pronos to an unrelated viewer', () => {
    expect(evaluateMatchCapabilities(base).canSubmitProno).toBe(false)
  })
})
