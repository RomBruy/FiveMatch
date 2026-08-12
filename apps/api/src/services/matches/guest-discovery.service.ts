import { and, asc, eq, gte, isNull, lte, sql, type SQL } from 'drizzle-orm'
import { PublicMatchPreviewSchema, type PublicMatchPreview } from '@fivematch/types'
import { db } from '../../db'
import { matchCapacity, matches } from '../../db/schema'
import { publicSpotsRemaining } from './availability'
import { cursorMatchesSort, decodeCursor, encodeCursor } from '../../lib/cursor'

/**
 * Discovery for someone with no account (AF-001).
 *
 * A deliberately separate query from the authenticated one rather than a shared
 * function with a flag. The authenticated version selects exact address, venue
 * name, coordinates and host notes; a flag controlling whether those reach the
 * response is one refactor away from leaking them. Here they are never selected
 * at all, so there is nothing to filter.
 *
 * Two things a guest gets less of than a signed-in viewer:
 *
 * - **No host name.** The single-match preview shows one, but it requires
 *   knowing an unguessable match id. A list hands out every host's name in a
 *   city to anyone who asks, which is a different exposure entirely.
 * - **No exact location.** City only, which is enough to decide whether to look
 *   closer. The address is for people who have committed.
 */

export type GuestDiscoveryFilters = {
  latitude?: number
  longitude?: number
  radiusKm?: number
  city?: string
  limit: number
  cursor?: string
}

export type GuestDiscoveryPage = {
  matches: PublicMatchPreview[]
  /** Null when the list is exhausted. Opaque — pass it back verbatim. */
  nextCursor: string | null
}

const DEFAULT_RADIUS_KM = 15
const EARTH_RADIUS_KM = 6371
/** How far ahead a guest may browse. Beyond this is not a decision they can act on. */
const HORIZON_DAYS = 30

export async function discoverPublicMatches(
  filters: GuestDiscoveryFilters,
): Promise<GuestDiscoveryPage> {
  const now = new Date()
  const horizon = new Date(now.getTime() + HORIZON_DAYS * 24 * 60 * 60 * 1000)

  const conditions: SQL[] = [
    eq(matches.visibility, 'public'),
    // Only matches a guest could actually join. A locked sheet is not an
    // invitation, and showing it is a wasted tap.
    eq(matches.status, 'attendance_open'),
    gte(matches.scheduledAt, now),
    lte(matches.scheduledAt, horizon),
    isNull(matches.voidedAt),
    // Crew-first matches stay out until their window opens (ADR-033).
    sql`(${matches.publicOpensAt} IS NULL OR ${matches.publicOpensAt} <= now())`,
  ]

  if (filters.city) conditions.push(sql`lower(${matches.city}) = lower(${filters.city})`)

  // Guests always page by kickoff time. Distance is a filter here, not an
  // ordering — and a distance cursor would be measured from wherever the caller
  // happened to be standing on the previous page.
  const cursor = decodeCursor(filters.cursor)
  if (cursorMatchesSort(cursor, 'time')) {
    // Row-value comparison: strictly after the last row seen, with the id
    // breaking ties between matches kicking off in the same second.
    conditions.push(sql`(${matches.scheduledAt}, ${matches.id}) > (${new Date(cursor.value as string)}, ${cursor.id})`)
  }

  const hasGeo = filters.latitude != null && filters.longitude != null
  const radiusKm = filters.radiusKm ?? DEFAULT_RADIUS_KM

  if (hasGeo) {
    // Bounding box first so the index does the work; 1° latitude ≈ 111km.
    const latDelta = radiusKm / 111
    const lngDelta = radiusKm / (111 * Math.max(0.01, Math.cos((filters.latitude! * Math.PI) / 180)))
    conditions.push(sql`${matches.latitude} BETWEEN ${filters.latitude! - latDelta} AND ${filters.latitude! + latDelta}`)
    conditions.push(sql`${matches.longitude} BETWEEN ${filters.longitude! - lngDelta} AND ${filters.longitude! + lngDelta}`)
  }

  // Distance is derived from coordinates that are never themselves returned:
  // "3km away" helps someone choose; the pitch's exact position does not.
  const distanceExpr = hasGeo
    ? sql<number>`(
        ${EARTH_RADIUS_KM} * acos(LEAST(1, GREATEST(-1,
          cos(radians(${filters.latitude})) * cos(radians(${matches.latitude}))
          * cos(radians(${matches.longitude}) - radians(${filters.longitude}))
          + sin(radians(${filters.latitude})) * sin(radians(${matches.latitude}))
        )))
      )`
    : sql<number>`NULL::float`

  const rows = await db
    .select({
      id: matches.id,
      scheduledAt: matches.scheduledAt,
      durationMinutes: matches.durationMinutes,
      city: matches.city,
      format: matches.format,
      playersPerTeam: matches.playersPerTeam,
      skillLevel: matches.skillLevel,
      pricePerPlayer: matches.pricePerPlayer,
      currency: matches.currency,
      status: matches.status,
      openSpots: matches.openSpots,
      distanceKm: distanceExpr,
      confirmedCount: sql<number>`(
        SELECT COUNT(*)::int FROM match_attendances ma
        WHERE ma.match_id = "matches"."id" AND ma.status = 'in' AND ma.waitlist_position IS NULL
      )`,
      openConfirmedCount: sql<number>`(
        SELECT COUNT(*)::int FROM match_attendances ma
        WHERE ma.match_id = "matches"."id" AND ma.status = 'in'
          AND ma.waitlist_position IS NULL AND ma.source = 'open'
      )`,
    })
    .from(matches)
    .where(and(...conditions))
    .orderBy(asc(matches.scheduledAt), asc(matches.id))
    // One extra row answers "is there another page?" without a second query
    // and without a count, which would have to scan the whole set.
    .limit(filters.limit + 1)

  const hasMore = rows.length > filters.limit
  const page = hasMore ? rows.slice(0, filters.limit) : rows
  const last = page[page.length - 1]

  const results = page
    .map((row) => {
      const capacity = matchCapacity(row.playersPerTeam)
      const spotsRemaining = publicSpotsRemaining({
        capacity,
        confirmed: row.confirmedCount,
        openConfirmed: row.openConfirmedCount,
        openSpots: row.openSpots,
        // Every row already satisfied the publication conditions above.
        publiclyOpen: true,
      })

      // Parsed through the strict public schema, so an added column cannot ride
      // out to an anonymous caller by accident — it throws instead.
      return PublicMatchPreviewSchema.parse({
        matchId: row.id,
        audience: 'public',
        scheduledAt: row.scheduledAt.toISOString(),
        durationMinutes: row.durationMinutes,
        city: row.city,
        format: row.format,
        skillLevel: row.skillLevel,
        pricePerPlayer: row.pricePerPlayer !== null ? Number(row.pricePerPlayer) : null,
        currency: row.currency,
        status: row.status,
        publication: { isPublic: true },
        availability: {
          confirmedCount: row.confirmedCount,
          capacity,
          spotsRemaining,
          canJoin: spotsRemaining > 0,
          canWaitlist: spotsRemaining === 0,
        },
        // Withheld on purpose — see the note at the top of this file.
        host: { displayName: null },
        distanceKm: row.distanceKm !== null ? Number(row.distanceKm) : null,
      })
    })
    // A full match is still worth showing: places open up constantly, and a
    // guest can queue once they have an account.
    .filter((match) => match.status === 'attendance_open')

  return {
    matches: results,
    // Built from the last row of the raw page, not of the filtered results: the
    // cursor marks where the scan reached, and dropping a row from the output
    // must not make the next page re-read it.
    nextCursor: hasMore && last
      ? encodeCursor({ sort: 'time', value: last.scheduledAt.toISOString(), id: last.id })
      : null,
  }
}

export const guestDiscoveryService = { discoverPublicMatches }
