import { describe, expect, it } from 'vitest'
import { isPubliclyOpen, publicSpotsRemaining } from '../availability'

/**
 * This arithmetic lived in three copies. When 6A changed what a null
 * `openSpots` means, only one was updated — so a freshly created public match
 * advertised itself as full on its own shared link and on discovery.
 *
 * These tests exist so the shared version cannot drift back.
 */

const NOW = new Date('2026-09-01T12:00:00.000Z')
const hours = (h: number) => new Date(NOW.getTime() + h * 60 * 60 * 1000)

const spots = (over: Partial<Parameters<typeof publicSpotsRemaining>[0]> = {}) =>
  publicSpotsRemaining({
    capacity: 10,
    confirmed: 1,
    openConfirmed: 0,
    openSpots: null,
    publiclyOpen: true,
    ...over,
  })

describe('publicSpotsRemaining', () => {
  it('publishes everything left when there is no cap', () => {
    // The regression: `openSpots ?? 0` made this zero, so every new public
    // match looked full to everyone who saw it.
    expect(spots()).toBe(9)
  })

  it('applies a cap that is smaller than the remainder', () => {
    expect(spots({ openSpots: 3 })).toBe(3)
  })

  it('never exceeds what the sheet actually has', () => {
    // A cap larger than the real remainder must not conjure places.
    expect(spots({ openSpots: 50 })).toBe(9)
  })

  it('counts places already taken by outsiders against the cap', () => {
    expect(spots({ openSpots: 3, openConfirmed: 2, confirmed: 3 })).toBe(1)
  })

  it('is zero on a full sheet whatever the cap says', () => {
    expect(spots({ confirmed: 10, openSpots: 5 })).toBe(0)
  })

  it('never goes negative', () => {
    // Capacity can be reduced under a sheet that is already over it.
    expect(spots({ confirmed: 14 })).toBe(0)
    expect(spots({ openSpots: 2, openConfirmed: 5 })).toBe(0)
  })

  it('offers nothing when the match is not publicly open', () => {
    expect(spots({ publiclyOpen: false })).toBe(0)
    expect(spots({ publiclyOpen: false, openSpots: 5 })).toBe(0)
  })
})

describe('isPubliclyOpen', () => {
  it('is false for a private match', () => {
    expect(isPubliclyOpen({ visibility: 'private', publicOpensAt: null }, NOW)).toBe(false)
    expect(isPubliclyOpen({ visibility: 'private', publicOpensAt: hours(-5) }, NOW)).toBe(false)
  })

  it('is true immediately for a public match with no opening time', () => {
    expect(isPubliclyOpen({ visibility: 'public', publicOpensAt: null }, NOW)).toBe(true)
  })

  it('holds a crew-first match until its opening time', () => {
    expect(isPubliclyOpen({ visibility: 'public', publicOpensAt: hours(4) }, NOW)).toBe(false)
    expect(isPubliclyOpen({ visibility: 'public', publicOpensAt: hours(-4) }, NOW)).toBe(true)
  })

  it('opens exactly on the boundary', () => {
    expect(isPubliclyOpen({ visibility: 'public', publicOpensAt: NOW }, NOW)).toBe(true)
  })
})
