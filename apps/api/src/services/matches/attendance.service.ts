import { eq, and, isNull, isNotNull, sql, asc } from 'drizzle-orm'
import { db } from '../../db'
import { matches, matchAttendances, players, groupMemberships } from '../../db/schema'
import { notificationService } from '../notifications/notification.service'

async function markAttendance(
  matchId: string,
  groupId: string,
  internalUserId: string,
  newStatus: 'in' | 'out' | 'unknown',
) {
  const [player] = await db
    .select()
    .from(players)
    .where(and(eq(players.userId, internalUserId), eq(players.groupId, groupId), isNull(players.deletedAt)))
    .limit(1)

  if (!player) {
    throw Object.assign(new Error('NOT_A_MEMBER'), { code: 'NOT_A_MEMBER', statusCode: 403 })
  }

  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1)

  const isOpen = match?.status === 'attendance_open'
  const isLocked = match?.status === 'attendance_locked'

  if (!match || (!isOpen && !isLocked)) {
    throw Object.assign(new Error('ATTENDANCE_CLOSED'), { code: 'ATTENDANCE_CLOSED', statusCode: 422 })
  }
  // When locked, only 'out' is permitted — IN and unknown are rejected
  if (isLocked && newStatus !== 'out') {
    throw Object.assign(new Error('ATTENDANCE_CLOSED'), { code: 'ATTENDANCE_CLOSED', statusCode: 422 })
  }

  let [attendance] = await db
    .select()
    .from(matchAttendances)
    .where(and(eq(matchAttendances.matchId, matchId), eq(matchAttendances.playerId, player.id)))
    .limit(1)

  // Rows are seeded at match creation — players who joined the group after
  // that have none. First response creates it instead of locking them out.
  if (!attendance) {
    ;[attendance] = await db
      .insert(matchAttendances)
      .values({ matchId, playerId: player.id, status: 'unknown' })
      .returning()
  }
  if (!attendance) {
    throw Object.assign(new Error('NOT_IN_MATCH'), { code: 'NOT_IN_MATCH', statusCode: 404 })
  }

  if (newStatus === 'in' && attendance.waitlistPosition !== null) {
    throw Object.assign(new Error('ALREADY_ON_WAITLIST'), { code: 'ALREADY_ON_WAITLIST', statusCode: 409 })
  }

  let shouldNotifyFull = false
  let organizerUserId: string | null = null
  let waitlistPromoteeUserId: string | null = null
  let waitlistPromoteePlayerId: string | null = null

  await db.transaction(async (tx) => {
    if (newStatus === 'in') {
      const [countResult] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(matchAttendances)
        .where(
          and(
            eq(matchAttendances.matchId, matchId),
            eq(matchAttendances.status, 'in'),
            isNull(matchAttendances.waitlistPosition),
          ),
        )

      const confirmedCount = Number(countResult.count)
      const capacity = match.playersPerTeam * 2

      if (confirmedCount >= capacity) {
        const [maxResult] = await tx
          .select({ max: sql<number>`COALESCE(MAX(waitlist_position), 0)` })
          .from(matchAttendances)
          .where(and(eq(matchAttendances.matchId, matchId), isNotNull(matchAttendances.waitlistPosition)))

        const nextPosition = Number(maxResult.max) + 1
        await tx
          .update(matchAttendances)
          .set({ status: 'in', waitlistPosition: nextPosition, respondedAt: new Date() })
          .where(eq(matchAttendances.id, attendance.id))
      } else {
        await tx
          .update(matchAttendances)
          .set({ status: 'in', waitlistPosition: null, respondedAt: new Date() })
          .where(eq(matchAttendances.id, attendance.id))

        if (confirmedCount + 1 >= capacity && !match.matchFullNotified) {
          await tx.update(matches).set({ matchFullNotified: true }).where(eq(matches.id, matchId))
          shouldNotifyFull = true

          const [organizer] = await tx
            .select({ userId: groupMemberships.userId })
            .from(groupMemberships)
            .where(
              and(
                eq(groupMemberships.groupId, groupId),
                eq(groupMemberships.role, 'organizer'),
                isNull(groupMemberships.deletedAt),
              ),
            )
            .limit(1)

          organizerUserId = organizer?.userId ?? null
        }
      }
    } else {
      // 'out' or 'unknown' — clear waitlistPosition if set
      await tx
        .update(matchAttendances)
        .set({ status: newStatus, waitlistPosition: null, respondedAt: new Date() })
        .where(eq(matchAttendances.id, attendance.id))

      // Post-lock: auto-promote the next waitlist player when a confirmed IN marks out
      if (isLocked && newStatus === 'out') {
        const [nextWaitlist] = await tx
          .select({ id: matchAttendances.id, playerId: matchAttendances.playerId })
          .from(matchAttendances)
          .where(and(eq(matchAttendances.matchId, matchId), isNotNull(matchAttendances.waitlistPosition)))
          .orderBy(asc(matchAttendances.waitlistPosition))
          .limit(1)

        if (nextWaitlist?.playerId) {
          await tx
            .update(matchAttendances)
            .set({ waitlistPosition: null, respondedAt: new Date() })
            .where(eq(matchAttendances.id, nextWaitlist.id))

          const [promoted] = await tx
            .select({ userId: players.userId })
            .from(players)
            .where(eq(players.id, nextWaitlist.playerId))
            .limit(1)

          waitlistPromoteePlayerId = nextWaitlist.playerId
          waitlistPromoteeUserId = promoted?.userId ?? null
        }
      }
    }
  })

  if (shouldNotifyFull && organizerUserId) {
    notificationService.send({
      type: 'MATCH_FULL',
      matchId,
      groupId,
      recipientUserId: organizerUserId,
    })
  }

  if (waitlistPromoteeUserId && waitlistPromoteePlayerId) {
    notificationService.send({
      type: 'WAITLIST_SPOT_OPEN',
      matchId,
      groupId,
      recipientUserId: waitlistPromoteeUserId,
    })
  }
}

async function lockAttendance(matchId: string) {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1)

  if (!match) {
    throw Object.assign(new Error('MATCH_NOT_FOUND'), { code: 'MATCH_NOT_FOUND', statusCode: 404 })
  }
  if (match.status !== 'attendance_open') {
    throw Object.assign(new Error('ATTENDANCE_CLOSED'), { code: 'ATTENDANCE_CLOSED', statusCode: 422 })
  }

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matchAttendances)
    .where(
      and(
        eq(matchAttendances.matchId, matchId),
        eq(matchAttendances.status, 'in'),
        isNull(matchAttendances.waitlistPosition),
      ),
    )

  const confirmedCount = Number(countResult.count)
  const required = match.playersPerTeam * 2

  if (confirmedCount < required) {
    throw Object.assign(
      new Error('INSUFFICIENT_PLAYERS'),
      { code: 'INSUFFICIENT_PLAYERS', statusCode: 422, meta: { confirmed: confirmedCount, required } },
    )
  }

  await db
    .update(matches)
    .set({ status: 'attendance_locked', updatedAt: new Date() })
    .where(eq(matches.id, matchId))
}

async function getAttendances(matchId: string, internalUserId?: string) {
  const rows = await db
    .select({
      playerId: matchAttendances.playerId,
      displayName: players.displayName,
      status: matchAttendances.status,
      waitlistPosition: matchAttendances.waitlistPosition,
      playerUserId: players.userId,
    })
    .from(matchAttendances)
    .leftJoin(players, eq(players.id, matchAttendances.playerId))
    .where(eq(matchAttendances.matchId, matchId))

  const myRow = internalUserId ? rows.find((r) => r.playerUserId === internalUserId) : undefined
  const myPlayerId = myRow?.playerId ?? null

  const confirmed = rows
    .filter((r) => r.status === 'in' && r.waitlistPosition === null)
    .map((r) => ({ playerId: r.playerId, displayName: r.displayName, status: r.status }))

  const waitlist = rows
    .filter((r) => r.waitlistPosition !== null)
    .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0))
    .map((r) => ({ playerId: r.playerId, displayName: r.displayName, waitlistPosition: r.waitlistPosition }))

  return { confirmed, waitlist, myPlayerId }
}

async function checkAndTriggerReminder(matchId: string) {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1)
  if (!match || match.attendanceReminderSent || match.status !== 'attendance_open') return

  const now = new Date()
  const hoursUntil = (match.scheduledAt.getTime() - now.getTime()) / (1000 * 60 * 60)

  if (hoursUntil <= 24 && hoursUntil > 0) {
    const unknownRows = await db
      .select({ userId: players.userId })
      .from(matchAttendances)
      .innerJoin(players, eq(players.id, matchAttendances.playerId))
      .where(and(eq(matchAttendances.matchId, matchId), eq(matchAttendances.status, 'unknown')))

    if (unknownRows.length > 0) {
      await db.update(matches).set({ attendanceReminderSent: true }).where(eq(matches.id, matchId))

      for (const row of unknownRows) {
        if (row.userId) {
          notificationService.send({
            type: 'ATTENDANCE_REMINDER',
            matchId,
            groupId: match.groupId,
            recipientUserId: row.userId,
          })
        }
      }
    }
  }
}

export const attendanceService = {
  markAttendance,
  getAttendances,
  checkAndTriggerReminder,
  lockAttendance,
}
