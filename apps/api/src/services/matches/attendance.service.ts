import { eq, and, isNull, isNotNull, sql, asc } from 'drizzle-orm'
import { db } from '../../db'
import { matches, matchAttendances, players, groupMemberships, matchCapacity } from '../../db/schema'
import type { Match } from '../../db/schema'
import { notificationService } from '../notifications/notification.service'
import { AttendanceResponseSchema, MATCH_MIN_PLAYABLE_TOTAL, type MatchCapabilities } from '@fivematch/types'
import type { MatchRelation } from '../permissions/capability.service'
import { isPubliclyOpen, publicSpotsRemaining } from './availability'
import { trustProjectionService } from '../trust/trust-projection.service'

type AttendanceSource = 'crew' | 'open'

function fail(code: string, statusCode: number, meta?: unknown) {
  return Object.assign(new Error(code), { code, statusCode, meta })
}

/**
 * Take the per-match lock.
 *
 * Every decision about who holds a seat — confirming, waitlisting, promoting —
 * must happen behind this. Reading a count and then acting on it is two
 * statements, and between them another request can take the last place. That is
 * how a match overfills and how two people land on the same waitlist position
 * (AF-004, AF-005; ADR-010 puts this boundary in PostgreSQL).
 */
async function lockMatch(tx: typeof db, matchId: string) {
  await tx.select({ id: matches.id }).from(matches).where(eq(matches.id, matchId)).for('update')
}

/** Confirmed IN and not waitlisted — the only count that means "has a seat". */
async function countConfirmed(tx: typeof db, matchId: string, source?: AttendanceSource) {
  const conditions = [
    eq(matchAttendances.matchId, matchId),
    eq(matchAttendances.status, 'in'),
    isNull(matchAttendances.waitlistPosition),
  ]
  if (source) conditions.push(eq(matchAttendances.source, source))

  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(matchAttendances)
    .where(and(...conditions))
  return Number(row?.count ?? 0)
}

/**
 * Respond to a match you already have a row on (crew members, or anyone who
 * previously joined). `groupId` is no longer a parameter — it comes off the
 * match, which may not have one at all.
 */
async function markAttendance(
  matchId: string,
  internalUserId: string,
  newStatus: 'in' | 'out' | 'unknown',
) {
  const [player] = await db
    .select()
    .from(players)
    .where(and(eq(players.userId, internalUserId), isNull(players.deletedAt)))
    .limit(1)

  if (!player) throw fail('PLAYER_NOT_FOUND', 403)

  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1)

  const isOpen = match?.status === 'attendance_open'
  const isLocked = match?.status === 'attendance_locked'

  if (!match || (!isOpen && !isLocked)) throw fail('ATTENDANCE_CLOSED', 422)
  // When locked, only 'out' is permitted — IN and unknown are rejected
  if (isLocked && newStatus !== 'out') throw fail('ATTENDANCE_CLOSED', 422)

  let [attendance] = await db
    .select()
    .from(matchAttendances)
    .where(and(eq(matchAttendances.matchId, matchId), eq(matchAttendances.playerId, player.id)))
    .limit(1)

  // Rows are seeded at match creation for the host's crew — players who joined
  // the crew after that have none. First response creates it instead of locking
  // them out. Anyone with no crew tie is arriving through an open spot.
  if (!attendance) {
    const source = await inferSource(match, internalUserId)
    ;[attendance] = await db
      .insert(matchAttendances)
      .values({ matchId, playerId: player.id, status: 'unknown', source })
      .returning()
  }
  if (!attendance) throw fail('NOT_IN_MATCH', 404)

  if (newStatus === 'in' && attendance.waitlistPosition !== null) {
    throw fail('ALREADY_ON_WAITLIST', 409)
  }

  // An outsider can only take a seat while the host is still publishing spots.
  if (newStatus === 'in' && attendance.source === 'open' && attendance.status !== 'in') {
    await assertOpenSpotAvailable(match)
  }

  let shouldNotifyFull = false
  let hostUserId: string | null = null
  let waitlistPromoteeUserId: string | null = null

  await db.transaction(async (tx) => {
    // Serialize every seat decision on this match.
    await lockMatch(tx as unknown as typeof db, matchId)

    if (newStatus === 'in') {
      const confirmedCount = await countConfirmed(tx as unknown as typeof db, matchId)
      const capacity = matchCapacity(match.playersPerTeam)

      if (confirmedCount >= capacity) {
        const [maxResult] = await tx
          .select({ max: sql<number>`COALESCE(MAX(waitlist_position), 0)` })
          .from(matchAttendances)
          .where(and(eq(matchAttendances.matchId, matchId), isNotNull(matchAttendances.waitlistPosition)))

        const nextPosition = Number(maxResult.max) + 1
        await tx
          .update(matchAttendances)
          // Coming back undoes the cancellation — you only let someone down if
          // the seat was still empty at kickoff.
          .set({
            status: 'in',
            waitlistPosition: nextPosition,
            respondedAt: new Date(),
            cancelledAt: null,
          })
          .where(eq(matchAttendances.id, attendance.id))
      } else {
        await tx
          .update(matchAttendances)
          .set({
            status: 'in',
            waitlistPosition: null,
            respondedAt: new Date(),
            cancelledAt: null,
          })
          .where(eq(matchAttendances.id, attendance.id))

        // Reliability numerator: every confirmed IN is a commitment made.
        if (attendance.status !== 'in') {
          await tx
            .update(players)
            .set({ commitmentCount: sql`${players.commitmentCount} + 1` })
            .where(eq(players.id, player.id))
        }

        if (confirmedCount + 1 >= capacity && !match.matchFullNotified) {
          await tx.update(matches).set({ matchFullNotified: true }).where(eq(matches.id, matchId))
          shouldNotifyFull = true
          hostUserId = match.hostId
        }
      }
    } else {
      // Releasing a confirmed seat is the fact reliability is built on. Recorded
      // whenever it happens, not only after lock — how late it was is decided at
      // finalization against the crew's deadline, not guessed here (ADR-028).
      const releasedConfirmedSeat =
        attendance.status === 'in' && attendance.waitlistPosition === null

      // 'out' or 'unknown' — clear waitlistPosition if set
      await tx
        .update(matchAttendances)
        .set({
          status: newStatus,
          waitlistPosition: null,
          respondedAt: new Date(),
          ...(releasedConfirmedSeat ? { cancelledAt: new Date() } : {}),
        })
        .where(eq(matchAttendances.id, attendance.id))

      // Backing out after attendance locked is the thing that hurts a group
      // that's counting on you. Withdrawing while it's still open is free.
      if (isLocked && attendance.status === 'in' && attendance.waitlistPosition === null) {
        await tx
          .update(players)
          .set({ noShowCount: sql`${players.noShowCount} + 1` })
          .where(eq(players.id, player.id))
      }

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

          waitlistPromoteeUserId = promoted?.userId ?? null

          // Announced inside the transaction that gave them the seat. Enqueueing
          // afterwards leaves a window where someone is promoted and never told,
          // which is the entire value of a waitlist place (7C).
          if (waitlistPromoteeUserId) {
            await notificationService.enqueue({
              type: 'WAITLIST_SPOT_OPEN',
              matchId,
              groupId: match.groupId,
              recipientUserId: waitlistPromoteeUserId,
            }, { tx })
          }
        }
      }
    }
  })

  if (shouldNotifyFull && hostUserId) {
    notificationService.send({
      type: 'MATCH_FULL',
      matchId,
      groupId: match.groupId,
      recipientUserId: hostUserId,
    })
  }

  // The promotion notification is enqueued inside the transaction above.
}

/** Crew if they belong to the match's group, otherwise they came off discovery. */
async function inferSource(match: Match, internalUserId: string): Promise<AttendanceSource> {
  if (!match.groupId) return match.hostId === internalUserId ? 'crew' : 'open'
  if (match.hostId === internalUserId) return 'crew'

  const [membership] = await db
    .select({ id: groupMemberships.id })
    .from(groupMemberships)
    .where(and(
      eq(groupMemberships.groupId, match.groupId),
      eq(groupMemberships.userId, internalUserId),
      isNull(groupMemberships.deletedAt),
    ))
    .limit(1)

  return membership ? 'crew' : 'open'
}

async function assertOpenSpotAvailable(match: Match) {
  if (!isPubliclyOpen(match)) throw fail('MATCH_NOT_PUBLIC', 422)

  const { spotsRemaining } = await getSpots(match)
  if (spotsRemaining <= 0) throw fail('NO_SPOTS_AVAILABLE', 409)
}

/**
 * Take a published spot on someone else's match. The one path in the product
 * where a stranger writes to a match they have no prior tie to, so it re-checks
 * everything rather than trusting the caller: match is public, kickoff is ahead,
 * attendance is open, a spot is genuinely free.
 */
async function joinOpenMatch(matchId: string, internalUserId: string) {
  const [player] = await db
    .select()
    .from(players)
    .where(and(eq(players.userId, internalUserId), isNull(players.deletedAt)))
    .limit(1)
  if (!player) throw fail('PLAYER_NOT_FOUND', 403)

  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1)
  if (!match) throw fail('MATCH_NOT_FOUND', 404)
  if (match.status !== 'attendance_open') throw fail('ATTENDANCE_CLOSED', 422)
  if (match.scheduledAt.getTime() <= Date.now()) throw fail('MATCH_STARTED', 422)

  const [existing] = await db
    .select({ id: matchAttendances.id, status: matchAttendances.status })
    .from(matchAttendances)
    .where(and(eq(matchAttendances.matchId, matchId), eq(matchAttendances.playerId, player.id)))
    .limit(1)

  if (existing?.status === 'in') throw fail('ALREADY_JOINED', 409)

  const source = await inferSource(match, internalUserId)
  if (source === 'open') await assertOpenSpotAvailable(match)

  if (existing) {
    await markAttendance(matchId, internalUserId, 'in')
  } else {
    await db.insert(matchAttendances).values({
      matchId,
      playerId: player.id,
      status: 'unknown',
      source,
    })
    await markAttendance(matchId, internalUserId, 'in')
  }

  const spots = await getSpots(match)

  // The host cares much more about a stranger arriving than about a crew RSVP.
  if (source === 'open') {
    notificationService.send({
      type: 'SPOT_CLAIMED',
      matchId,
      groupId: match.groupId,
      playerDisplayName: player.displayName,
      spotsRemaining: spots.spotsRemaining,
      recipientUserId: match.hostId,
    })
  }

  return spots
}

/**
 * Availability, always derived from the real sheet.
 *
 * `openSpots` caps how many of the remaining places are offered publicly; it is
 * never a separate pool. Previously a public match defaulted to one open place,
 * so a host advertising a 5v5 looked full to everyone — the opposite of what
 * publishing is for (ADR-033, AF-007).
 */
async function getSpots(match: Match) {
  const confirmed = await countConfirmed(db, match.id)
  const openConfirmed = await countConfirmed(db, match.id, 'open')
  const capacity = matchCapacity(match.playersPerTeam)

  return {
    confirmed,
    capacity,
    spotsRemaining: publicSpotsRemaining({
      capacity,
      confirmed,
      openConfirmed,
      openSpots: match.openSpots,
      publiclyOpen: isPubliclyOpen(match),
    }),
  }
}

/** Give up a seat. Equivalent to marking out, kept as its own verb for the UI. */
async function leaveMatch(matchId: string, internalUserId: string) {
  await markAttendance(matchId, internalUserId, 'out')
}

async function lockAttendance(matchId: string) {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1)

  if (!match) throw fail('MATCH_NOT_FOUND', 404)
  if (match.status !== 'attendance_open') throw fail('ATTENDANCE_CLOSED', 422)

  const confirmedCount = await countConfirmed(db, matchId)

  // The host decides whether the game is on (ADR-032). Locking used to demand a
  // full sheet, which does not match how five-a-side is played — a 5v5 that ends
  // up 4v4 is a normal Wednesday, not a failed match. Below four there is no
  // game to play, which is the only reason a floor exists.
  if (confirmedCount < MATCH_MIN_PLAYABLE_TOTAL) {
    throw fail('INSUFFICIENT_PLAYERS', 422, {
      confirmed: confirmedCount,
      required: MATCH_MIN_PLAYABLE_TOTAL,
      nominal: matchCapacity(match.playersPerTeam),
    })
  }

  await db
    .update(matches)
    .set({ status: 'attendance_locked', updatedAt: new Date() })
    .where(eq(matches.id, matchId))
}

async function getAttendances(
  matchId: string,
  internalUserId: string | undefined,
  capabilities: MatchCapabilities,
  relation: MatchRelation,
) {
  const rows = await db
    .select({
      playerId: matchAttendances.playerId,
      displayName: players.displayName,
      status: matchAttendances.status,
      source: matchAttendances.source,
      waitlistPosition: matchAttendances.waitlistPosition,
      playerUserId: players.userId,
      // Trust signals travel with the sheet — a host vetting a stranger sees
      // them right where the decision happens.
      matchCount: players.matchCount,
      skillLevel: players.skillLevel,
      finalizedAt: matchAttendances.finalizedAt,
    })
    .from(matchAttendances)
    .leftJoin(players, eq(players.id, matchAttendances.playerId))
    .where(eq(matchAttendances.matchId, matchId))

  const myRow = internalUserId ? rows.find((r) => r.playerUserId === internalUserId) : undefined

  // The earned mark only — a host vetting a stranger gets a positive signal or
  // nothing, never a visible negative (ADR-019).
  const reliableFlags = await trustProjectionService.getReliableFlags(
    rows.map((r) => r.playerId).filter((id): id is string => Boolean(id)),
  )
  const toEntry = (r: (typeof rows)[number]) => ({
    playerId: r.playerId,
    displayName: r.displayName,
    skillLevel: r.skillLevel,
    matchCount: r.matchCount ?? 0,
    isReliable: r.playerId ? (reliableFlags.get(r.playerId) ?? false) : false,
  })

  const confirmed = rows
    .filter((r) => r.status === 'in' && r.waitlistPosition === null)
    .map(toEntry)

  const waitlist = rows
    .filter((r) => r.waitlistPosition !== null)
    .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0))
    .map((r) => ({ ...toEntry(r), waitlistPosition: r.waitlistPosition }))

  const pending = rows
    .filter((r) => r.status === 'unknown')
    .map(toEntry)

  const counts = {
    confirmed: confirmed.length,
    waitlist: waitlist.length,
    pending: pending.length,
  }
  const self = myRow
    ? { playerId: myRow.playerId!, status: myRow.status, waitlistPosition: myRow.waitlistPosition }
    : null

  if (capabilities.canManageAttendance) {
    const withSource = (r: (typeof rows)[number]) => ({ ...toEntry(r), source: r.source })
    const confirmedRows = rows.filter((r) => r.status === 'in' && r.waitlistPosition === null)
    return AttendanceResponseSchema.parse({
      audience: 'manager',
      counts,
      self,
      // One boolean, never per-player outcomes: the host needs to know the job
      // is done, not to be handed a list of who let them down (ADR-019).
      attendanceFinalized: confirmedRows.length > 0
        && confirmedRows.every((r) => r.finalizedAt !== null),
      confirmed: rows.filter((r) => r.status === 'in' && r.waitlistPosition === null).map(withSource),
      waitlist: rows.filter((r) => r.waitlistPosition !== null)
        .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0))
        .map((r) => ({ ...withSource(r), waitlistPosition: r.waitlistPosition })),
      pending: rows.filter((r) => r.status === 'unknown').map(withSource),
      out: rows.filter((r) => r.status === 'out').map(withSource),
    })
  }

  if (capabilities.canViewParticipantRoster) {
    return AttendanceResponseSchema.parse({ audience: 'participant', counts, self, confirmed })
  }

  return AttendanceResponseSchema.parse({
    audience: relation === 'crew' ? 'group' : 'viewer',
    counts,
    self,
  })
}

/*
 * `reliabilityOf` lived here: honoured / committed from the players counters.
 * Removed in Phase 3C. It read RSVP intent rather than finalized outcomes, could
 * not tell an excused absence from a no-show, and had no recency at all — one
 * bad month followed you forever. `trustProjectionService` replaces it.
 * The counters it read are now a cache, not a source of truth.
 */

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

/**
 * Join the waitlist for a full published match.
 *
 * An outsider hitting a full match used to get a flat refusal, which is the
 * worst possible answer: the match is exactly the one they want and places open
 * up constantly as people cancel (AF-008).
 *
 * Position assignment sits behind the per-match lock, so two people joining at
 * the same instant get two positions rather than one shared one.
 */
async function joinWaitlist(matchId: string, internalUserId: string) {
  const [player] = await db
    .select()
    .from(players)
    .where(and(eq(players.userId, internalUserId), isNull(players.deletedAt)))
    .limit(1)
  if (!player) throw fail('PLAYER_NOT_FOUND', 403)

  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1)
  if (!match) throw fail('MATCH_NOT_FOUND', 404)
  if (match.status !== 'attendance_open') throw fail('ATTENDANCE_CLOSED', 422)
  if (match.scheduledAt.getTime() <= Date.now()) throw fail('MATCH_STARTED', 422)
  if (!isPubliclyOpen(match)) throw fail('MATCH_NOT_PUBLIC', 422)

  return db.transaction(async (tx) => {
    await lockMatch(tx as unknown as typeof db, matchId)

    const [existing] = await tx
      .select({
        id: matchAttendances.id,
        status: matchAttendances.status,
        waitlistPosition: matchAttendances.waitlistPosition,
      })
      .from(matchAttendances)
      .where(and(eq(matchAttendances.matchId, matchId), eq(matchAttendances.playerId, player.id)))
      .limit(1)

    if (existing?.status === 'in' && existing.waitlistPosition === null) {
      throw fail('ALREADY_JOINED', 409)
    }
    if (existing?.waitlistPosition !== null && existing?.waitlistPosition !== undefined) {
      // Already waiting — return their place rather than moving them to the back.
      return { waitlistPosition: existing.waitlistPosition }
    }

    const [maxRow] = await tx
      .select({ max: sql<number>`COALESCE(MAX(waitlist_position), 0)` })
      .from(matchAttendances)
      .where(and(eq(matchAttendances.matchId, matchId), isNotNull(matchAttendances.waitlistPosition)))

    const nextPosition = Number(maxRow?.max ?? 0) + 1
    const source = await inferSource(match, internalUserId)

    if (existing) {
      await tx
        .update(matchAttendances)
        .set({ status: 'in', waitlistPosition: nextPosition, respondedAt: new Date() })
        .where(eq(matchAttendances.id, existing.id))
    } else {
      await tx.insert(matchAttendances).values({
        matchId,
        playerId: player.id,
        status: 'in',
        source,
        waitlistPosition: nextPosition,
        respondedAt: new Date(),
      })
    }

    return { waitlistPosition: nextPosition }
  })
}

/**
 * Promote a specific waitlisted player, by the host's choice rather than by
 * queue order.
 *
 * Automatic promotion takes the next in line, which is right when a seat frees
 * itself. A host promoting by hand is usually solving something the queue cannot
 * see — a goalkeeper, someone who can bring the ball — so the choice is theirs.
 */
async function promoteFromWaitlist(matchId: string, playerId: string) {
  return db.transaction(async (tx) => {
    await lockMatch(tx as unknown as typeof db, matchId)

    const [match] = await tx.select().from(matches).where(eq(matches.id, matchId)).limit(1)
    if (!match) throw fail('MATCH_NOT_FOUND', 404)

    const [row] = await tx
      .select({ id: matchAttendances.id, waitlistPosition: matchAttendances.waitlistPosition })
      .from(matchAttendances)
      .where(and(eq(matchAttendances.matchId, matchId), eq(matchAttendances.playerId, playerId)))
      .limit(1)

    if (!row || row.waitlistPosition === null) throw fail('NOT_ON_WAITLIST', 404)

    // Capacity is re-checked under the lock: a host may be looking at a stale
    // screen from before the sheet filled up.
    const confirmed = await countConfirmed(tx as unknown as typeof db, matchId)
    if (confirmed >= matchCapacity(match.playersPerTeam)) throw fail('NO_SPOTS_AVAILABLE', 409)

    await tx
      .update(matchAttendances)
      .set({ status: 'in', waitlistPosition: null, respondedAt: new Date() })
      .where(eq(matchAttendances.id, row.id))

    const [promoted] = await tx
      .select({ userId: players.userId })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1)

    return { promotedUserId: promoted?.userId ?? null, groupId: match.groupId }
  })
}

export { isPubliclyOpen }

export const attendanceService = {
  joinWaitlist,
  promoteFromWaitlist,
  markAttendance,
  joinOpenMatch,
  leaveMatch,
  getAttendances,
  checkAndTriggerReminder,
  lockAttendance,
  getSpots,
}
