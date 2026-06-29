import { describe, it, expect } from 'vitest'
import { RatingService } from './rating.service'

function makeTestClock(base: Date) {
  let current = base
  return {
    now: () => current,
    advance: (ms: number) => { current = new Date(current.getTime() + ms) },
  }
}

describe('RatingService', () => {
  const completedAt = new Date('2026-06-01T10:00:00.000Z')
  const WINDOW_MS = 48 * 60 * 60 * 1000

  it('returns true when clock is 1 minute before the 48h deadline', () => {
    const clock = makeTestClock(new Date(completedAt.getTime() + WINDOW_MS - 60_000))
    const service = new RatingService(clock)
    expect(service.isWindowOpen({ completedAt })).toBe(true)
  })

  it('returns false when clock is 1 minute past the 48h deadline', () => {
    const clock = makeTestClock(new Date(completedAt.getTime() + WINDOW_MS + 60_000))
    const service = new RatingService(clock)
    expect(service.isWindowOpen({ completedAt })).toBe(false)
  })

  it('returns false when completedAt is null', () => {
    const clock = makeTestClock(new Date())
    const service = new RatingService(clock)
    expect(service.isWindowOpen({ completedAt: null })).toBe(false)
  })
})
