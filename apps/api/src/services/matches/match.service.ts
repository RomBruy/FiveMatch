import { eq, and, isNull, sql, ne, gte, lte, asc, inArray, or, SQL } from 'drizzle-orm'
import { db } from '../../db'
import { ACTIVE_CREW_ROLES, matches, matchAttendances, matchSeries, players, groups, groupMemberships, matchParticipants, matchCapacity } from '../../db/schema'
import { notificationService } from '../notifications/notification.service'
import {
  MatchDetailResponseSchema,
  PublicMatchPreviewSchema,
  type MatchCapabilities,
} from '@fivematch/types'
import type { MatchRelation } from '../permissions/capability.service'
import { trustProjectionService } from '../trust/trust-projection.service'
import { publicSpotsRemaining } from './availability'

export interface MatchLocationInput {
  location?: string | null
  venueName?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface CreateMatchInput extends MatchLocationInput {
  /** Optional — a host with no crew publishes a standalone match. */
  groupId?: string | null
  scheduledAt: string
  durationMinutes?: number
  format: '5v5' | '6v6' | '7v7' | 'custom'
  playersPerTeam: number
  goalkeeperMode: 'fixed' | 'rotating' | 'none'
  generatorStyle?: 'pure_ovr' | 'position_aware' | 'mixed'
  visibility?: 'private' | 'public'
  /** Optional cap on published places. Null publishes whatever is left. */
  openSpots?: number | null
  /** When the crew's first refusal ends. Null with public = public now. */
  publicOpensAt?: string | null
  /** Default true — a five-a-side host is almost always playing (ADR-018). */
  hostPlays?: boolean
  skillLevel?: 'casual' | 'intermediate' | 'competitive'
  pricePerPlayer?: number | null
  notes?: string | null
  recurrence?: { frequency: 'weekly' | 'biweekly' } | null
}

export interface DiscoverFilters {
  latitude?: number
  longitude?: number
  radiusKm?: number
  city?: string
  from?: Date
  to?: Date
  format?: string
  skillLevel?: 'casual' | 'intermediate' | 'competitive'
  limit: number
}

// Occurrences are materialized this far ahead, extended lazily on read.
const MATERIALIZE_HORIZON_DAYS = 31
const FREQUENCY_DAYS = { weekly: 7, biweekly: 14 } as const
// Today's match stays listed a few hours past kickoff (it may be in progress).
const UPCOMING_GRACE_MS = 6 * 60 * 60 * 1000
const DEFAULT_RADIUS_KM = 15
const EARTH_RADIUS_KM = 6371

/** Wall-clock date arithmetic — setDate keeps the kickoff hour across DST. */
function addDays(base: Date, days: number): Date {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

type OccurrenceData = Omit<CreateMatchInput, 'scheduledAt' | 'recurrence' | 'groupId'>

/**
 * Insert one match with its seeded attendance rows. Shared by direct creation
 * and series materialization.
 *
 * Seeding only happens when the match has a crew behind it. A standalone match
 * starts with an empty sheet and fills entirely from discovery.
 */
async function insertOccurrence(
  tx: Tx,
  groupId: string | null,
  hostInternalId: string,
  data: OccurrenceData,
  scheduledAt: Date,
  seriesId: string | null,
) {
  const [newMatch] = await tx
    .insert(matches)
    .values({
      groupId,
      hostId: hostInternalId,
      seriesId,
      status: 'attendance_open',
      scheduledAt,
      durationMinutes: data.durationMinutes ?? 60,
      location: data.location ?? null,
      venueName: data.venueName ?? null,
      city: data.city ?? null,
      latitude: data.latitude != null ? String(data.latitude) : null,
      longitude: data.longitude != null ? String(data.longitude) : null,
      visibility: data.visibility ?? 'private',
      // Null means "publish whatever is left". Defaulting to 1 made a public
      // 5v5 look full to every stranger who saw it (ADR-033).
      openSpots: data.visibility === 'public' ? (data.openSpots ?? null) : null,
      publicOpensAt: data.publicOpensAt ? new Date(data.publicOpensAt) : null,
      hostPlays: data.hostPlays ?? true,
      skillLevel: data.skillLevel ?? 'casual',
      pricePerPlayer: data.pricePerPlayer != null ? String(data.pricePerPlayer) : null,
      notes: data.notes ?? null,
      format: data.format,
      playersPerTeam: data.playersPerTeam,
      goalkeeperMode: data.goalkeeperMode,
      generatorStyle: data.generatorStyle ?? 'pure_ovr',
    })
    .returning()

  if (groupId) {
    const crew = await tx
      .select({ playerId: players.id })
      .from(groupMemberships)
      .innerJoin(players, eq(players.userId, groupMemberships.userId))
      .where(and(
        eq(groupMemberships.groupId, groupId),
        inArray(groupMemberships.role, [...ACTIVE_CREW_ROLES]),
        isNull(groupMemberships.deletedAt),
        isNull(players.deletedAt),
      ))

    if (crew.length > 0) {
      await tx.insert(matchAttendances).values(
        crew.map((p) => ({
          matchId: newMatch.id,
          playerId: p.playerId,
          status: 'unknown' as const,
          source: 'crew' as const,
        })),
      )
    }
  }

  // Seed the host as confirmed unless they said they are not playing.
  //
  // They were never seeded before, so a host's own match started one place
  // short in every capacity calculation and the host had to RSVP to their own
  // fixture (ADR-018, AF-007).
  if (newMatch.hostPlays) {
    const [hostPlayer] = await tx
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.userId, hostInternalId), isNull(players.deletedAt)))
      .limit(1)

    if (hostPlayer) {
      await tx
        .insert(matchAttendances)
        .values({
          matchId: newMatch.id,
          playerId: hostPlayer.id,
          status: 'in' as const,
          source: 'crew' as const,
          respondedAt: new Date(),
        })
        // A crew host already has a seeded row; promote it rather than collide.
        .onConflictDoUpdate({
          target: [matchAttendances.matchId, matchAttendances.playerId],
          set: { status: 'in' as const, respondedAt: new Date() },
        })
    }
  }

  return newMatch
}

async function createMatch(hostInternalId: string, data: CreateMatchInput) {
  const firstAt = new Date(data.scheduledAt)
  const groupId = data.groupId ?? null

  const match = await db.transaction(async (tx) => {
    let seriesId: string | null = null

    if (data.recurrence) {
      const [series] = await tx
        .insert(matchSeries)
        .values({
          groupId,
          hostId: hostInternalId,
          frequency: data.recurrence.frequency,
          location: data.location ?? null,
          venueName: data.venueName ?? null,
          city: data.city ?? null,
          latitude: data.latitude != null ? String(data.latitude) : null,
          longitude: data.longitude != null ? String(data.longitude) : null,
          visibility: data.visibility ?? 'private',
          // Null publishes whatever is left. This was missed when the default
          // changed in 6A, so recurring public matches still offered one place.
          openSpots: data.visibility === 'public' ? (data.openSpots ?? null) : null,
          skillLevel: data.skillLevel ?? 'casual',
          pricePerPlayer: data.pricePerPlayer != null ? String(data.pricePerPlayer) : null,
          format: data.format,
          playersPerTeam: data.playersPerTeam,
          goalkeeperMode: data.goalkeeperMode,
          generatorStyle: data.generatorStyle ?? 'pure_ovr',
          lastOccurrenceAt: firstAt,
        })
        .returning()
      seriesId = series.id
    }

    const newMatch = await insertOccurrence(tx, groupId, hostInternalId, data, firstAt, seriesId)

    // Materialize the rest of the first month up front; reads extend it later.
    if (seriesId && data.recurrence) {
      const horizon = addDays(new Date(), MATERIALIZE_HORIZON_DAYS)
      const step = FREQUENCY_DAYS[data.recurrence.frequency]
      let cursor = addDays(firstAt, step)
      while (cursor <= horizon) {
        await insertOccurrence(tx, groupId, hostInternalId, data, cursor, seriesId)
        cursor = addDays(cursor, step)
      }
      await tx
        .update(matchSeries)
        .set({ lastOccurrenceAt: addDays(cursor, -step) })
        .where(eq(matchSeries.id, seriesId))
    }

    return newMatch
  })

  // Fire-and-forget notifications AFTER the transaction commits. Only a crew
  // match has anyone to notify — a standalone match has no audience yet.
  if (groupId) {
    const [group] = await db.select({ name: groups.name }).from(groups).where(eq(groups.id, groupId))
    const crew = await db
      .select({ userId: groupMemberships.userId })
      .from(groupMemberships)
      .where(and(
        eq(groupMemberships.groupId, groupId),
        inArray(groupMemberships.role, [...ACTIVE_CREW_ROLES]),
        isNull(groupMemberships.deletedAt),
      ))
    const recipientUserIds = crew.map((p) => p.userId)

    if (group && recipientUserIds.length > 0) {
      notificationService.send({
        type: 'MATCH_CREATED',
        groupId,
        groupName: group.name,
        matchId: match.id,
        scheduledAt: match.scheduledAt.toISOString(),
        recipientUserIds,
      })
      notificationService.send({
        type: 'PRONOS_WINDOW_OPEN',
        matchId: match.id,
        groupId,
        recipientUserIds,
      })
    }
  }

  return match
}

/** Seats taken (confirmed IN, not waitlisted) and seats still purchasable from discovery. */
async function getSpotCounts(matchId: string, playersPerTeam: number, openSpots: number | null) {
  const rows = await db
    .select({
      source: matchAttendances.source,
      cnt: sql<number>`count(*)::int`,
    })
    .from(matchAttendances)
    .where(and(
      eq(matchAttendances.matchId, matchId),
      eq(matchAttendances.status, 'in'),
      isNull(matchAttendances.waitlistPosition),
    ))
    .groupBy(matchAttendances.source)

  const bySource = Object.fromEntries(rows.map((r) => [r.source, Number(r.cnt)]))
  const confirmed = (bySource['crew'] ?? 0) + (bySource['open'] ?? 0)
  const capacity = matchCapacity(playersPerTeam)
  const takenFromOpen = bySource['open'] ?? 0

  // A published spot is only real if the pitch still has room for it.
  const remaining = publicSpotsRemaining({
    capacity,
    confirmed,
    openConfirmed: takenFromOpen,
    openSpots,
    // The caller has already established this match is being published.
    publiclyOpen: true,
  })

  return { confirmed, capacity, spotsRemaining: remaining }
}

async function getMatch(
  matchId: string,
  capabilities: MatchCapabilities,
  viewerRelation: MatchRelation,
) {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId))
  if (!match) return null

  const summaryRows = await db
    .select({ status: matchAttendances.status, cnt: sql<number>`count(*)::int` })
    .from(matchAttendances)
    .where(eq(matchAttendances.matchId, matchId))
    .groupBy(matchAttendances.status)

  const [waitlistRow] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(matchAttendances)
    .where(and(eq(matchAttendances.matchId, matchId), sql`${matchAttendances.waitlistPosition} IS NOT NULL`))

  const countByStatus: Record<string, number> = {}
  for (const row of summaryRows) countByStatus[row.status] = Number(row.cnt)

  const spots = await getSpotCounts(matchId, match.playersPerTeam, match.openSpots)

  const [host] = await db
    .select({
      id: players.id,
      displayName: players.displayName,
    })
    .from(players)
    .where(eq(players.userId, match.hostId))

  const audience = capabilities.canManageAttendance
    ? 'manager'
    : capabilities.canViewParticipantRoster
      ? 'participant'
      : viewerRelation === 'crew'
        ? 'group'
        : 'viewer'
  const responseCapabilities: MatchCapabilities = {
    canViewPrivateMatchDetails: capabilities.canViewPrivateMatchDetails,
    canViewExactLocation: capabilities.canViewExactLocation,
    canViewParticipantRoster: capabilities.canViewParticipantRoster,
    canViewWaitlist: capabilities.canViewWaitlist,
    canViewPendingGroupAttendance: capabilities.canViewPendingGroupAttendance,
    canManageAttendance: capabilities.canManageAttendance,
    canViewPrivateNotes: capabilities.canViewPrivateNotes,
    canRate: capabilities.canRate,
    canReportAttendance: capabilities.canReportAttendance,
    canResolveDispute: capabilities.canResolveDispute,
    canSubmitProno: capabilities.canSubmitProno,
    canLeave: capabilities.canLeave,
    canJoin: capabilities.canJoin,
    canJoinWaitlist: capabilities.canJoinWaitlist,
  }

  const base = {
    matchId: match.id,
    audience,
    status: match.status,
    completedAt: match.completedAt?.toISOString() ?? null,
    publication: { isPublic: match.visibility === 'public' },
    scheduledAt: match.scheduledAt.toISOString(),
    durationMinutes: match.durationMinutes,
    city: match.city,
    skillLevel: match.skillLevel,
    pricePerPlayer: match.pricePerPlayer !== null ? Number(match.pricePerPlayer) : null,
    currency: match.currency,
    format: match.format,
    availability: {
      confirmedCount: spots.confirmed,
      capacity: spots.capacity,
      spotsRemaining: spots.spotsRemaining,
      canJoin: capabilities.canJoin,
      canWaitlist: capabilities.canJoinWaitlist,
    },
    host: {
      displayName: host?.displayName ?? null,
      isReliable: host?.id
        ? ((await trustProjectionService.getReliableFlags([host.id])).get(host.id) ?? false)
        : false,
    },
    viewerRelation,
    capabilities: responseCapabilities,
  }

  const group = match.groupId && audience !== 'viewer'
    ? (await db.select({ groupId: groups.id, name: groups.name }).from(groups).where(eq(groups.id, match.groupId)).limit(1))[0] ?? null
    : null

  const participantRows = capabilities.canViewParticipantRoster
    ? await db
      .select({
        playerId: matchParticipants.playerId,
        displayName: matchParticipants.displayName,
        teamSide: matchParticipants.teamSide,
        goalsScored: matchParticipants.goalsScored,
        assists: matchParticipants.assists,
      })
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, matchId))
    : []

  const result = match.status === 'completed'
    ? { scoreA: match.scoreA, scoreB: match.scoreB }
    : undefined

  if (audience === 'manager') {
    return MatchDetailResponseSchema.parse({
      ...base,
      audience,
      group,
      exactLocation: {
        location: match.location,
        venueName: match.venueName,
        latitude: match.latitude !== null ? Number(match.latitude) : null,
        longitude: match.longitude !== null ? Number(match.longitude) : null,
      },
      participants: participantRows,
      privateNotes: match.notes,
      configuration: {
        playersPerTeam: match.playersPerTeam,
        goalkeeperMode: match.goalkeeperMode,
        generatorStyle: match.generatorStyle,
        generationCount: match.generationCount,
        seriesId: match.seriesId,
        visibility: match.visibility,
        openSpots: match.openSpots,
      },
      attendanceSummary: {
        in: countByStatus['in'] ?? 0,
        out: countByStatus['out'] ?? 0,
        unknown: countByStatus['unknown'] ?? 0,
        waitlist: Number(waitlistRow?.cnt ?? 0),
      },
      ...(result ? { result } : {}),
    })
  }

  if (audience === 'participant') {
    return MatchDetailResponseSchema.parse({
      ...base,
      audience,
      group,
      exactLocation: {
        location: match.location,
        venueName: match.venueName,
        latitude: match.latitude !== null ? Number(match.latitude) : null,
        longitude: match.longitude !== null ? Number(match.longitude) : null,
      },
      participants: participantRows,
      ...(result ? { result } : {}),
    })
  }

  if (audience === 'group' && group) {
    return MatchDetailResponseSchema.parse({
      ...base,
      audience,
      group,
      ...(result ? { result } : {}),
    })
  }

  return MatchDetailResponseSchema.parse({ ...base, audience: 'viewer' })
}

/**
 * Discovery — upcoming public matches with at least one spot left.
 *
 * Distance is a bounding-box prefilter (index-friendly) followed by haversine
 * for the exact figure and the sort. Plain numerics, no PostGIS: at neighbourhood
 * radii the error is irrelevant and the operational cost is zero.
 */
async function discoverMatches(filters: DiscoverFilters, viewerPlayerId: string | undefined) {
  const from = filters.from ?? new Date(Date.now() - UPCOMING_GRACE_MS)
  const conditions: SQL[] = [
    eq(matches.visibility, 'public'),
    inArray(matches.status, ['attendance_open', 'attendance_locked', 'teams_generated']),
    gte(matches.scheduledAt, from),
    // A crew-first match is private until its window opens. Without this it was
    // listed in discovery immediately, which is the opposite of first refusal
    // (ADR-033).
    sql`(${matches.publicOpensAt} IS NULL OR ${matches.publicOpensAt} <= now())`,
    isNull(matches.voidedAt),
  ]

  if (filters.to) conditions.push(lte(matches.scheduledAt, filters.to))
  if (filters.format) conditions.push(eq(matches.format, filters.format as '5v5'))
  if (filters.skillLevel) conditions.push(eq(matches.skillLevel, filters.skillLevel))
  if (filters.city) conditions.push(sql`lower(${matches.city}) = lower(${filters.city})`)

  const hasGeo = filters.latitude != null && filters.longitude != null
  const radiusKm = filters.radiusKm ?? DEFAULT_RADIUS_KM

  if (hasGeo) {
    // 1° latitude ≈ 111km; longitude shrinks with the cosine of the latitude.
    const latDelta = radiusKm / 111
    const lngDelta = radiusKm / (111 * Math.max(0.01, Math.cos((filters.latitude! * Math.PI) / 180)))
    conditions.push(sql`${matches.latitude} BETWEEN ${filters.latitude! - latDelta} AND ${filters.latitude! + latDelta}`)
    conditions.push(sql`${matches.longitude} BETWEEN ${filters.longitude! - lngDelta} AND ${filters.longitude! + lngDelta}`)
  }

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
      groupId: matches.groupId,
      hostId: matches.hostId,
      scheduledAt: matches.scheduledAt,
      durationMinutes: matches.durationMinutes,
      location: matches.location,
      venueName: matches.venueName,
      city: matches.city,
      latitude: matches.latitude,
      longitude: matches.longitude,
      format: matches.format,
      playersPerTeam: matches.playersPerTeam,
      skillLevel: matches.skillLevel,
      pricePerPlayer: matches.pricePerPlayer,
      currency: matches.currency,
      openSpots: matches.openSpots,
      notes: matches.notes,
      distanceKm: distanceExpr,
      confirmedCount: sql<number>`(
        SELECT COUNT(*)::int FROM match_attendances ma
        WHERE ma.match_id = "matches"."id" AND ma.status = 'in' AND ma.waitlist_position IS NULL
      )`,
      openTakenCount: sql<number>`(
        SELECT COUNT(*)::int FROM match_attendances ma
        WHERE ma.match_id = "matches"."id" AND ma.status = 'in'
          AND ma.waitlist_position IS NULL AND ma.source = 'open'
      )`,
      viewerJoined: viewerPlayerId
        ? sql<boolean>`EXISTS (
            SELECT 1 FROM match_attendances ma
            WHERE ma.match_id = "matches"."id" AND ma.player_id = ${viewerPlayerId} AND ma.status = 'in'
          )`
        : sql<boolean>`false`,
    })
    .from(matches)
    .where(and(...conditions))
    .orderBy(hasGeo ? asc(distanceExpr) : asc(matches.scheduledAt))
    .limit(filters.limit)

  // Host names in one round trip rather than N.
  const hostIds = [...new Set(rows.map((r) => r.hostId))]
  const hostRows = hostIds.length > 0
    ? await db
        .select({ userId: players.userId, displayName: players.displayName, skillLevel: players.skillLevel })
        .from(players)
        .where(inArray(players.userId, hostIds))
    : []
  const hostMap = new Map(hostRows.map((h) => [h.userId, h]))

  return rows
    .map((row) => {
      const capacity = matchCapacity(row.playersPerTeam)
      const spotsRemaining = Math.max(
        0,
        Math.min((row.openSpots ?? 0) - row.openTakenCount, capacity - row.confirmedCount),
      )
      return PublicMatchPreviewSchema.parse({
        matchId: row.id,
        audience: 'viewer',
        scheduledAt: row.scheduledAt.toISOString(),
        durationMinutes: row.durationMinutes,
        city: row.city,
        distanceKm: row.distanceKm !== null ? Math.round(Number(row.distanceKm) * 10) / 10 : null,
        format: row.format,
        skillLevel: row.skillLevel,
        pricePerPlayer: row.pricePerPlayer !== null ? Number(row.pricePerPlayer) : null,
        currency: row.currency,
        status: 'attendance_open',
        publication: { isPublic: true },
        availability: {
          confirmedCount: row.confirmedCount,
          capacity,
          spotsRemaining,
          canJoin: spotsRemaining > 0 && !row.viewerJoined,
          canWaitlist: spotsRemaining === 0 && !row.viewerJoined,
        },
        host: { displayName: hostMap.get(row.hostId)?.displayName ?? null },
        viewerJoined: Boolean(row.viewerJoined),
      })
    })
    // A full match is noise on a discovery feed — unless the viewer is in it.
    .filter((m) => m.availability.spotsRemaining > 0 || m.viewerJoined)
}

/**
 * Every match the user has a stake in: hosting, on the sheet, or in the crew
 * that owns it. Replaces the old group-scoped upcoming list.
 */
async function getMyMatches(
  internalUserId: string,
  playerId: string | undefined,
  scope: 'upcoming' | 'past',
  limit: number,
) {
  await extendDueSeriesForUser(internalUserId)

  const myGroupIds = (
    await db
      .select({ groupId: groupMemberships.groupId })
      .from(groupMemberships)
      .where(and(
        eq(groupMemberships.userId, internalUserId),
        inArray(groupMemberships.role, [...ACTIVE_CREW_ROLES]),
        isNull(groupMemberships.deletedAt),
      ))
  ).map((r) => r.groupId)

  const stake: SQL[] = [eq(matches.hostId, internalUserId)]
  if (myGroupIds.length > 0) stake.push(inArray(matches.groupId, myGroupIds))
  if (playerId) {
    stake.push(sql`EXISTS (
      SELECT 1 FROM match_attendances ma
      WHERE ma.match_id = "matches"."id" AND ma.player_id = ${playerId}
    )`)
  }

  const timeWindow = scope === 'upcoming'
    ? and(
        ne(matches.status, 'completed'),
        ne(matches.status, 'cancelled'),
        gte(matches.scheduledAt, new Date(Date.now() - UPCOMING_GRACE_MS)),
      )
    : eq(matches.status, 'completed')

  const rows = await db
    .select({
      id: matches.id,
      groupId: matches.groupId,
      hostId: matches.hostId,
      status: matches.status,
      scheduledAt: matches.scheduledAt,
      location: matches.location,
      venueName: matches.venueName,
      city: matches.city,
      format: matches.format,
      playersPerTeam: matches.playersPerTeam,
      visibility: matches.visibility,
      openSpots: matches.openSpots,
      skillLevel: matches.skillLevel,
      seriesId: matches.seriesId,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      completedAt: matches.completedAt,
      mvpPlayerId: matches.mvpPlayerId,
      confirmedCount: sql<number>`(
        SELECT COUNT(*)::int FROM match_attendances ma
        WHERE ma.match_id = "matches"."id" AND ma.status = 'in' AND ma.waitlist_position IS NULL
      )`,
      myStatus: playerId
        ? sql<string | null>`(
            SELECT ma.status FROM match_attendances ma
            WHERE ma.match_id = "matches"."id" AND ma.player_id = ${playerId} LIMIT 1
          )`
        : sql<string | null>`NULL`,
      myWaitlistPosition: playerId
        ? sql<number | null>`(
            SELECT ma.waitlist_position FROM match_attendances ma
            WHERE ma.match_id = "matches"."id" AND ma.player_id = ${playerId} LIMIT 1
          )`
        : sql<number | null>`NULL`,
      myTeamSide: playerId
        ? sql<string | null>`(
            SELECT mp.team_side FROM match_participants mp
            WHERE mp.match_id = ${matches.id} AND mp.player_id = ${playerId} LIMIT 1
          )`
        : sql<string | null>`NULL`,
    })
    .from(matches)
    .where(and(or(...stake), timeWindow))
    .orderBy(scope === 'upcoming' ? asc(matches.scheduledAt) : sql`${matches.completedAt} DESC`)
    .limit(limit)

  return rows.map((row) => {
    const isGroupMember = row.groupId !== null && myGroupIds.includes(row.groupId)
    const isConfirmed = row.myStatus === 'in' && row.myWaitlistPosition === null
    const canSeeResult = row.hostId === internalUserId || isGroupMember || isConfirmed || row.myTeamSide !== null
    const scoreA = canSeeResult ? row.scoreA : null
    const scoreB = canSeeResult ? row.scoreB : null
    const userResult = row.myTeamSide && scoreA !== null && scoreB !== null
      ? scoreA === scoreB
        ? 'draw'
        : (row.myTeamSide === 'A' ? scoreA > scoreB : scoreB > scoreA) ? 'win' : 'loss'
      : null
    return {
    matchId: row.id,
    status: row.status,
    scheduledAt: row.scheduledAt.toISOString(),
    city: row.city,
    format: row.format,
    playersPerTeam: row.playersPerTeam,
    capacity: matchCapacity(row.playersPerTeam),
    confirmedCount: row.confirmedCount,
    visibility: row.visibility,
    openSpots: row.openSpots,
    skillLevel: row.skillLevel,
    seriesId: row.seriesId,
    scoreA,
    scoreB,
    completedAt: row.completedAt,
    isHost: row.hostId === internalUserId,
    myStatus: row.myStatus,
    userResult,
    }
  })
}

/** Materialize any live series the user can see, up to the rolling horizon. */
async function extendDueSeriesForUser(internalUserId: string) {
  const myGroupIds = (
    await db
      .select({ groupId: groupMemberships.groupId })
      .from(groupMemberships)
      .where(and(
        eq(groupMemberships.userId, internalUserId),
        inArray(groupMemberships.role, [...ACTIVE_CREW_ROLES]),
        isNull(groupMemberships.deletedAt),
      ))
  ).map((r) => r.groupId)

  const scope: SQL[] = [eq(matchSeries.hostId, internalUserId)]
  if (myGroupIds.length > 0) scope.push(inArray(matchSeries.groupId, myGroupIds))

  const dueSeries = await db
    .select()
    .from(matchSeries)
    .where(and(isNull(matchSeries.endedAt), or(...scope)))

  const horizon = addDays(new Date(), MATERIALIZE_HORIZON_DAYS)

  for (const series of dueSeries) {
    const step = FREQUENCY_DAYS[series.frequency]
    if (addDays(series.lastOccurrenceAt, step) > horizon) continue

    await db.transaction(async (tx) => {
      let cursor = addDays(series.lastOccurrenceAt, step)
      let last = series.lastOccurrenceAt
      while (cursor <= horizon) {
        await insertOccurrence(
          tx,
          series.groupId,
          series.hostId,
          {
            location: series.location,
            venueName: series.venueName,
            city: series.city,
            latitude: series.latitude !== null ? Number(series.latitude) : null,
            longitude: series.longitude !== null ? Number(series.longitude) : null,
            visibility: series.visibility,
            openSpots: series.openSpots,
            skillLevel: series.skillLevel,
            pricePerPlayer: series.pricePerPlayer !== null ? Number(series.pricePerPlayer) : null,
            format: series.format,
            playersPerTeam: series.playersPerTeam,
            goalkeeperMode: series.goalkeeperMode,
            generatorStyle: series.generatorStyle,
          },
          cursor,
          series.id,
        )
        last = cursor
        cursor = addDays(cursor, step)
      }
      await tx.update(matchSeries).set({ lastOccurrenceAt: last }).where(eq(matchSeries.id, series.id))
    })
  }
}

/** Publish or unpublish a match's open spots. Host only — enforced at the route. */
async function setVisibility(matchId: string, visibility: 'private' | 'public', openSpots: number | null) {
  const [updated] = await db
    .update(matches)
    .set({
      visibility,
      openSpots: visibility === 'public' ? Math.max(1, openSpots ?? 1) : null,
      updatedAt: new Date(),
    })
    .where(eq(matches.id, matchId))
    .returning({ id: matches.id, visibility: matches.visibility, openSpots: matches.openSpots })

  return updated ?? null
}

/**
 * Stop a recurring series: no further occurrences are materialized, and
 * already-created future matches are cancelled — except those someone has
 * confirmed IN for, which stay on the calendar.
 */
async function endSeries(hostInternalId: string, seriesId: string) {
  const [series] = await db
    .select()
    .from(matchSeries)
    .where(and(eq(matchSeries.id, seriesId), eq(matchSeries.hostId, hostInternalId), isNull(matchSeries.endedAt)))

  if (!series) return null

  const cancelledCount = await db.transaction(async (tx) => {
    await tx.update(matchSeries).set({ endedAt: new Date() }).where(eq(matchSeries.id, seriesId))

    const future = await tx
      .select({ id: matches.id })
      .from(matches)
      .where(
        and(
          eq(matches.seriesId, seriesId),
          gte(matches.scheduledAt, new Date()),
          inArray(matches.status, ['planning', 'attendance_open']),
        ),
      )

    if (future.length === 0) return 0
    const futureIds = future.map((m) => m.id)

    const confirmedRows = await tx
      .select({ matchId: matchAttendances.matchId })
      .from(matchAttendances)
      .where(and(inArray(matchAttendances.matchId, futureIds), eq(matchAttendances.status, 'in')))

    const keep = new Set(confirmedRows.map((r) => r.matchId))
    const toCancel = futureIds.filter((id) => !keep.has(id))

    if (toCancel.length > 0) {
      await tx.update(matches).set({ status: 'cancelled' }).where(inArray(matches.id, toCancel))
    }
    return toCancel.length
  })

  return { seriesId, cancelledCount }
}

/** Everyone who should hear that a match changed or was called off. */
async function affectedUserIds(matchId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: players.userId })
    .from(matchAttendances)
    .innerJoin(players, eq(players.id, matchAttendances.playerId))
    .where(and(
      eq(matchAttendances.matchId, matchId),
      eq(matchAttendances.status, 'in'),
      isNull(players.deletedAt),
    ))

  return [...new Set(rows.map((row) => row.userId))]
}

/**
 * Edit a match that has not happened yet.
 *
 * Format, players per team and goalkeeper mode are deliberately not editable:
 * they decide capacity and team shape, so changing them after people commit
 * silently invalidates the sheet they said yes to. Everything else — time,
 * place, price, notes, publication — is fair game.
 *
 * Changing kickoff is safe for reliability scoring: cancellations store their
 * timestamp and the excused/late decision is derived at finalization, so moving
 * the time simply re-derives against the new one (ADR-028).
 */
async function editMatch(matchId: string, input: Record<string, unknown>) {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1)
  if (!match) return null

  // Nothing to edit once it has been played or called off.
  if (match.status === 'completed' || match.status === 'cancelled') return { conflict: true as const }

  const patch: Record<string, unknown> = { updatedAt: new Date() }
  const copy = [
    'durationMinutes', 'location', 'venueName', 'city',
    'notes', 'visibility', 'openSpots', 'hostPlays',
  ] as const
  for (const key of copy) {
    if (input[key] !== undefined) patch[key] = input[key]
  }
  if (input.scheduledAt !== undefined) patch.scheduledAt = new Date(input.scheduledAt as string)
  if (input.publicOpensAt !== undefined) {
    patch.publicOpensAt = input.publicOpensAt ? new Date(input.publicOpensAt as string) : null
  }
  for (const key of ['latitude', 'longitude', 'pricePerPlayer'] as const) {
    if (input[key] !== undefined) patch[key] = input[key] === null ? null : String(input[key])
  }

  const [updated] = await db.update(matches).set(patch).where(eq(matches.id, matchId)).returning()

  // Only worth interrupting people for a change to when or where.
  const materialChange = input.scheduledAt !== undefined
    || input.location !== undefined
    || input.venueName !== undefined
    || input.city !== undefined

  if (materialChange) {
    const recipientUserIds = await affectedUserIds(matchId)
    if (recipientUserIds.length > 0) {
      notificationService.send({
        type: 'MATCH_UPDATED',
        matchId,
        groupId: updated.groupId,
        scheduledAt: updated.scheduledAt.toISOString(),
        recipientUserIds,
      })
    }
  }

  return { match: updated }
}

/**
 * Call a match off.
 *
 * Distinct from voiding (Phase 4): cancelled means it never happened, voided
 * means it happened but stops counting. A cancelled match produces no
 * eligibility, so nothing needs invalidating.
 */
async function cancelMatch(matchId: string, reason?: string) {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1)
  if (!match) return null
  if (match.status === 'completed' || match.status === 'cancelled') return { conflict: true as const }

  // Gathered before the update, while the sheet still says who was coming.
  const recipientUserIds = await affectedUserIds(matchId)

  const [updated] = await db
    .update(matches)
    .set({ status: 'cancelled', notes: reason ? `${match.notes ?? ''}\n[annulé] ${reason}`.trim() : match.notes, updatedAt: new Date() })
    .where(eq(matches.id, matchId))
    .returning()

  if (recipientUserIds.length > 0) {
    notificationService.send({
      type: 'MATCH_CANCELLED',
      matchId,
      groupId: updated.groupId,
      scheduledAt: updated.scheduledAt.toISOString(),
      recipientUserIds,
    })
  }

  return { match: updated }
}

export const matchService = {
  editMatch,
  cancelMatch,
  createMatch,
  getMatch,
  getSpotCounts,
  discoverMatches,
  getMyMatches,
  setVisibility,
  endSeries,
}
