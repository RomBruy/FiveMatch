import { eq, and, isNull, sql, ne } from 'drizzle-orm'
import { db } from '../../db'
import { matches, matchAttendances, players, groups, matchParticipants } from '../../db/schema'
import { notificationService } from '../notifications/notification.service'

export interface CreateMatchInput {
  scheduledAt: string
  location?: string | null
  format: '5v5' | '6v6' | '7v7' | 'custom'
  playersPerTeam: number
  goalkeeperMode: 'fixed' | 'rotating' | 'none'
  generatorStyle?: 'pure_ovr' | 'position_aware' | 'mixed'
}

async function createMatch(groupId: string, organizerInternalId: string, data: CreateMatchInput) {
  const match = await db.transaction(async (tx) => {
    const [newMatch] = await tx
      .insert(matches)
      .values({
        groupId,
        organizerId: organizerInternalId,
        status: 'attendance_open',
        scheduledAt: new Date(data.scheduledAt),
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

export const matchService = {
  createMatch,
  getMatch,
  getActiveMatch,
}
