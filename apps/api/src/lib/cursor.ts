/**
 * Keyset pagination cursors.
 *
 * Offset pagination drifts: rows are inserted and matches fill up between one
 * page and the next, so `OFFSET 20` silently skips or repeats fixtures. It also
 * degrades — the database counts and discards every skipped row. Discovery is
 * exactly the case where both matter, since the list changes while it is read.
 *
 * A keyset cursor names the last row seen and asks for what comes after it, so
 * a page boundary stays correct however the data moves underneath.
 */

export type CursorSort = 'time' | 'distance'

export type Cursor = {
  sort: CursorSort
  /** Ordering value of the last row: an ISO timestamp, or kilometres. */
  value: string | number
  /** Tiebreaker. Two matches can kick off at the same second. */
  id: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

/**
 * Decode a cursor, or return null if it is not one of ours.
 *
 * Opaque on purpose: clients pass back what they were given rather than
 * constructing one, so the encoding stays free to change. Anything unparseable
 * is treated as absent rather than as an error, because a stale cursor from an
 * old app version should start the list again, not break it.
 */
export function decodeCursor(raw: string | undefined | null): Cursor | null {
  if (!raw) return null

  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<Cursor>

    if (parsed.sort !== 'time' && parsed.sort !== 'distance') return null
    if (typeof parsed.id !== 'string' || !UUID_PATTERN.test(parsed.id)) return null

    if (parsed.sort === 'time') {
      if (typeof parsed.value !== 'string') return null
      if (Number.isNaN(Date.parse(parsed.value))) return null
    } else if (typeof parsed.value !== 'number' || !Number.isFinite(parsed.value)) {
      return null
    }

    return { sort: parsed.sort, value: parsed.value, id: parsed.id }
  } catch {
    return null
  }
}

/**
 * A cursor is only meaningful against the ordering it was produced by.
 *
 * Paging with a distance cursor into a time-ordered query would skip or repeat
 * arbitrary rows — the comparison would be against a value from a different
 * axis entirely. Mismatches restart the list rather than producing quietly
 * wrong pages.
 */
export function cursorMatchesSort(cursor: Cursor | null, sort: CursorSort): cursor is Cursor {
  return cursor !== null && cursor.sort === sort
}
