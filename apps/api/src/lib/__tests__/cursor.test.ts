import { describe, expect, it } from 'vitest'
import { cursorMatchesSort, decodeCursor, encodeCursor } from '../cursor'

const ID = '11111111-1111-4111-8111-111111111111'
const WHEN = '2026-09-01T19:00:00.000Z'

describe('cursor encoding', () => {
  it('round-trips a time cursor', () => {
    const token = encodeCursor({ sort: 'time', value: WHEN, id: ID })
    expect(decodeCursor(token)).toEqual({ sort: 'time', value: WHEN, id: ID })
  })

  it('round-trips a distance cursor', () => {
    const token = encodeCursor({ sort: 'distance', value: 3.75, id: ID })
    expect(decodeCursor(token)).toEqual({ sort: 'distance', value: 3.75, id: ID })
  })

  it('is url-safe', () => {
    const token = encodeCursor({ sort: 'time', value: WHEN, id: ID })
    // Travels in a query string, so it must survive without escaping.
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('cursor decoding', () => {
  it('treats absence as the start of the list', () => {
    expect(decodeCursor(undefined)).toBeNull()
    expect(decodeCursor(null)).toBeNull()
    expect(decodeCursor('')).toBeNull()
  })

  it('treats an unparseable cursor as absent rather than an error', () => {
    // A stale cursor from an older app version should restart the list, not
    // break it.
    expect(decodeCursor('not-base64!!')).toBeNull()
    expect(decodeCursor(Buffer.from('not json').toString('base64url'))).toBeNull()
  })

  it('rejects an unknown sort', () => {
    const forged = Buffer.from(JSON.stringify({ sort: 'ovr', value: 1, id: ID })).toString('base64url')
    expect(decodeCursor(forged)).toBeNull()
  })

  it('rejects an id that is not a uuid', () => {
    const forged = Buffer.from(
      JSON.stringify({ sort: 'time', value: WHEN, id: '../../admin' }),
    ).toString('base64url')
    expect(decodeCursor(forged)).toBeNull()
  })

  it('rejects a value of the wrong shape for its sort', () => {
    const timeWithNumber = Buffer.from(
      JSON.stringify({ sort: 'time', value: 42, id: ID }),
    ).toString('base64url')
    const distanceWithString = Buffer.from(
      JSON.stringify({ sort: 'distance', value: WHEN, id: ID }),
    ).toString('base64url')

    expect(decodeCursor(timeWithNumber)).toBeNull()
    expect(decodeCursor(distanceWithString)).toBeNull()
  })

  it('rejects a non-finite distance', () => {
    // JSON has no Infinity, but a hand-built payload can carry null.
    const forged = Buffer.from(
      JSON.stringify({ sort: 'distance', value: null, id: ID }),
    ).toString('base64url')
    expect(decodeCursor(forged)).toBeNull()
  })

  it('rejects an unparseable timestamp', () => {
    const forged = Buffer.from(
      JSON.stringify({ sort: 'time', value: 'last tuesday', id: ID }),
    ).toString('base64url')
    expect(decodeCursor(forged)).toBeNull()
  })
})

describe('cursorMatchesSort', () => {
  it('refuses a cursor from a different ordering', () => {
    const distance = decodeCursor(encodeCursor({ sort: 'distance', value: 2, id: ID }))

    // Paging with a distance cursor into a time-ordered query would compare
    // against a value from a different axis and skip or repeat arbitrary rows.
    expect(cursorMatchesSort(distance, 'time')).toBe(false)
    expect(cursorMatchesSort(distance, 'distance')).toBe(true)
  })

  it('treats a missing cursor as no cursor', () => {
    expect(cursorMatchesSort(null, 'time')).toBe(false)
  })
})
