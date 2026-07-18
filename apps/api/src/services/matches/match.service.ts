import { eq, and, isNull, sql, ne, gte, asc } from 'drizzle-orm'
import { db } from '../../db'
import { matches, matchAttendances, matchSeries, players, groups, matchParticipants } from '../../db/schema'
import { notificationService } from '../notifications/notification.service'

export interface CreateMatchInput {
  scheduledAt: string
  location?: string | null
  format: '5v5' | '6v6' | '7v7' | 'custom'
  playersPerTeam: number
  goalkeeperMode: 'fixed' | 'rotating' | 'none'
  generatorStyle?: 'pure_ovr' | 'position_aware' | 'mixed'
  recurrence?: { frequency: 'weekly' | 'biweekly' } | null
}

// Occurrences are materialized this far ahead, extended lazily on read.
const MATERIALIZE_HORIZON_DAYS = 31
const FREQUENCY_DAYS = { weekly: 7, biweekly: 14 } as const

/** Wall-clock date arithmetic — setDate keeps the kickoff hour across DST. */
function addDays(base: Date, days: number): Date {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Insert one match with its seeded attendance rows. Shared by direct creation and series materialization. */
async function insertOccurrence(
  tx: Tx,
  groupId: string,
  organizerInternalId: string,
  data: Omit<CreateMatchInput, 'scheduledAt' | 'recurrence'>,
  scheduledAt: Date,
  seriesId: string | null,
) {
  const [newMatch] = await tx
    .insert(matches)
    .values({
      groupId,
      organizerId: organizerInternalId,
      seriesId,
      status: 'attendance_open',
      scheduledAt,
      location: data.location ?? null,
      format: data.format,
      playersPerTeam: data.playersPerTeam,
      goalkeeperMode: data.goalkeeperMode,
      generatorStyle: data.generatorStyle ?? 'pure_ovr',
    })
    .returning()

  const activePlayers = await tx
    .select({ id: players.id })
    .from(players)
    .where(and(eq(players.groupId, groupId), isNull(players.deletedAt)))

  if (activePlayers.length > 0) {
    await tx.insert(matchAttendances).values(
      activePlayers.map((p) => ({
        matchId: newMatch.id,
        playerId: p.id,
        status: 'unknown' as const,
      })),
    )
  }

  return newMatch
}

async function createMatch(groupId: string, organizerInternalId: string, data: CreateMatchInput) {
  const firstAt = new Date(data.scheduledAt)

  const match = await db.transaction(async (tx) => {
    let seriesId: string | null = null

    if (data.recurrence) {
      const [series] = await tx
        .insert(matchSeries)
        .values({
          groupId,
          organizerId: organizerInternalId,
          frequency: data.recurrence.frequency,
          location: data.location ?? null,
          format: data.format,
          playersPerTeam: data.playersPerTeam,
          goalkeeperMode: data.goalkeeperMode,
          generatorStyle: data.generatorStyle ?? 'pure_ovr',
          lastOccurrenceAt: firstAt,
        })
        .returning()
      seriesId = series.id
    }

    const newMatch = await insertOccurrence(tx, groupId, organizerInternalId, data, firstAt, seriesId)

    // Materialize the rest of the first month up front; reads extend it later.
    if (seriesId && data.recurrence) {
      const horizon = addDays(new Date(), MATERIALIZE_HORIZON_DAYS)
      const step = FREQUENCY_DAYS[data.recurrence.frequency]
      let cursor = addDays(firstAt, step)
      while (cursor <= horizon) {
        await insertOccurrence(tx, groupId, organizerInternalId, data, cursor, seriesId)
        cursor = addDays(cursor, step)
      }
      await tx
        .update(matchSeries)
        .set({ lastOccurrenceAt: addDays(cursor, -step) })
        .where(eq(matchSeries.id, seriesId))
    }

    return newMatch
  })

  // Fire-and-forget notification AFTER transaction commits
  const [group] = await db.select({ name: groups.name }).from(groups).where(eq(groups.id, groupId))
  const allPlayers = await db
    .select({ userId: players.userId })
    .from(players)
    .where(and(eq(players.groupId, groupId), isNull(players.deletedAt)))

  if (group && allPlayers.length > 0) {
    notificationService.send({
      type: 'MATCH_CREATED',
      groupId,
      groupName: group.name,
      matchId: match.id,
      scheduledAt: match.scheduledAt.toISOString(),
      recipientUserIds: allPlayers.map((p) => p.userId),
    })
  }

  if (allPlayers.length > 0) {
    notificationService.send({
      type: 'PRONOS_WINDOW_OPEN',
      matchId: match.id,
      groupId,
      recipientUserIds: allPlayers.map((p) => p.userId),
    })
  }

  return match
}

async function getMatch(matchId: string, groupId: string) {
  const [match] = await db
    .select()
    .from(matches)
    .where(and(eq(matches.id, matchId), eq(matches.groupId, groupId)))

  if (!match) return null

  const summaryRows = await db.execute<{ status: string; cnt: string }>(
    sql`
      SELECT status, COUNT(*)::int AS cnt
      FROM match_attendances
      WHERE match_id = ${matchId}
      GROUP BY status
    `,
  )

  const waitlistRow = await db.execute<{ cnt: string }>(
    sql`
      SELECT COUNT(*)::int AS cnt
      FROM match_attendances
      WHERE match_id = ${matchId}
        AND waitlist_position IS NOT NULL
    `,
  )

  const countByStatus: Record<string, number> = {}
  for (const row of summaryRows.rows) {
    countByStatus[row.status] = Number(row.cnt)
  }

  const base = {
    matchId: match.id,
    status: match.status,
    scheduledAt: match.scheduledAt,
    location: match.location,
    format: match.format,
    playersPerTeam: match.playersPerTeam,
    goalkeeperMode: match.goalkeeperMode,
    generatorStyle: match.generatorStyle,
    generationCount: match.generationCount,
    completedAt: match.completedAt ?? undefined,
    attendanceSummary: {
      in: countByStatus['in'] ?? 0,
      out: countByStatus['out'] ?? 0,
      unknown: countByStatus['unknown'] ?? 0,
      waitlist: Number(waitlistRow.rows[0]?.cnt ?? 0),
    },
  }

  if (match.status === 'completed') {
    const participantRows = await db
      .select({
        playerId: matchParticipants.playerId,
        displayName: matchParticipants.displayName,
        teamSide: matchParticipants.teamSide,
        goalsScored: matchParticipants.goalsScored,
        assists: matchParticipants.assists,
      })
      .from(matchParticipants)
      .where(eq(matchParticipants.matchId, matchId))

    return {
      ...base,
      result: { scoreA: match.scoreA, scoreB: match.scoreB },
      participants: participantRows,
    }
  }

  return base
}

async function getActiveMatch(groupId: string) {
  const [match] = await db
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.groupId, groupId),
        ne(matches.status, 'completed'),
        ne(matches.status, 'cancelled'),
      ),
    )
    .orderBy(asc(matches.scheduledAt))
    .limit(1)

  if (!match) return null

  return {
    matchId: match.id,
    status: match.status,
    scheduledAt: match.scheduledAt,
    location: match.location,
    format: match.format,
    playersPerTeam: match.playersPerTeam,
  }
}

/** Materialize any live series of the group up to the rolling horizon. */
async function extendDueSeries(groupId: string) {
  const horizon = addDays(new Date(), MATERIALIZE_HORIZON_DAYS)

  const dueSeries = await db
    .select()
    .from(matchSeries)
    .where(and(eq(matchSeries.groupId, groupId), isNull(matchSeries.endedAt)))

  for (const series of dueSeries) {
    const step = FREQUENCY_DAYS[series.frequency]
    if (addDays(series.lastOccurrenceAt, step) > horizon) continue

    await db.transaction(async (tx) => {
      let cursor = addDays(series.lastOccurrenceAt, step)
      let last = series.lastOccurrenceAt
      while (cursor <= horizon) {
        await insertOccurrence(
          tx,
          groupId,
          series.organizerId,
          {
            location: series.location,
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

// Today's match stays listed a few hours past kickoff (it may be in progress).
const UPCOMING_GRACE_MS = 6 * 60 * 60 * 1000

async function getUpcomingMatches(groupId: string, limit: number) {
  await extendDueSeries(groupId)

  const rows = await db
    .select()
    .from(matches)
    .where(
      and(
        eq(matches.groupId, groupId),
        ne(matches.status, 'completed'),
        ne(matches.status, 'cancelled'),
        gte(matches.scheduledAt, new Date(Date.now() - UPCOMING_GRACE_MS)),
      ),
    )
    .orderBy(asc(matches.scheduledAt))
    .limit(limit)

  return rows.map((match) => ({
    matchId: match.id,
    status: match.status,
    scheduledAt: match.scheduledAt,
    location: match.location,
    format: match.format,
    playersPerTeam: match.playersPerTeam,
    seriesId: match.seriesId,
  }))
}

export const matchService = {
  createMatch,
  getMatch,
  getActiveMatch,
  getUpcomingMatches,
}
