import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_CANCELLATION_DEADLINE_HOURS } from '@fivematch/types'

vi.mock('../../../db', () => ({ db: {} }))

import { classifyOutcome, type OutcomeInput } from '../attendance-finalization.service'

const KICKOFF = new Date('2026-09-05T19:00:00.000Z')

/** Confirmed seat, turned up, nothing unusual. */
function base(overrides: Partial<OutcomeInput> = {}): OutcomeInput {
  return {
    status: 'in',
    waitlistPosition: null,
    cancelledAt: null,
    appeared: true,
    scheduledAt: KICKOFF,
    deadlineHours: DEFAULT_CANCELLATION_DEADLINE_HOURS,
    ...overrides,
  }
}

/** Hours before kickoff, as a timestamp. */
function hoursBefore(hours: number): Date {
  return new Date(KICKOFF.getTime() - hours * 60 * 60 * 1000)
}

describe('classifyOutcome', () => {
  it('records attendance for a player in the final snapshot', () => {
    expect(classifyOutcome(base())).toBe('attended')
  })

  it('treats a cancellation outside the deadline as excused', () => {
    expect(classifyOutcome(base({ appeared: false, cancelledAt: hoursBefore(24) }))).toBe('excused')
  })

  it('treats a cancellation inside the deadline as a late cancellation', () => {
    expect(classifyOutcome(base({ appeared: false, cancelledAt: hoursBefore(3) }))).toBe('late_cancel')
  })

  it('counts a cancellation exactly on the deadline as excused', () => {
    // The boundary favours the player: 12h means "twelve hours is enough notice",
    // not "twelve hours and one second".
    expect(classifyOutcome(base({ appeared: false, cancelledAt: hoursBefore(12) }))).toBe('excused')
  })

  it('records a no-show when a confirmed seat is never released and never used', () => {
    expect(classifyOutcome(base({ appeared: false }))).toBe('no_show')
  })

  it('lets turning up override a prior cancellation', () => {
    // Cancelled at the last minute, then came anyway. Penalising this would
    // teach players to stay home once they have cancelled.
    expect(classifyOutcome(base({ appeared: true, cancelledAt: hoursBefore(1) }))).toBe('attended')
  })

  it('assigns no outcome to a player who never claimed a seat', () => {
    expect(classifyOutcome(base({ status: 'out', appeared: false }))).toBeNull()
    expect(classifyOutcome(base({ status: 'unknown', appeared: false }))).toBeNull()
  })

  it('assigns no outcome to a player left on the waitlist', () => {
    // Never promoted, so never actually had a seat to honour.
    expect(classifyOutcome(base({ waitlistPosition: 2, appeared: false }))).toBeNull()
  })

  it('honours a crew deadline that differs from the platform default', () => {
    const cancelledAt = hoursBefore(18)
    expect(classifyOutcome(base({ appeared: false, cancelledAt, deadlineHours: 12 }))).toBe('excused')
    expect(classifyOutcome(base({ appeared: false, cancelledAt, deadlineHours: 24 }))).toBe('late_cancel')
  })

  it('is pure — the same inputs always give the same answer', () => {
    // The classification depends on stored facts and never on the current clock,
    // which is what makes history recomputable if the deadline is ever retuned.
    const input = base({ appeared: false, cancelledAt: hoursBefore(13) })
    expect(classifyOutcome(input)).toBe(classifyOutcome(input))
    expect(classifyOutcome(input)).toBe('excused')
  })
})
