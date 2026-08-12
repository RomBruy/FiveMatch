import { and, eq, gt, isNull, isNotNull, lt, ne, sql } from 'drizzle-orm'
import { db } from '../../db'
import { matchAttendances, matchParticipants, matches, ratings } from '../../db/schema'

/**
 * What is actually waiting on this person.
 *
 * One endpoint rather than four client-side queries, because "what do I need to
 * do" is a single question and answering it by assembling fragments in the UI
 * puts the ordering logic somewhere it cannot be tested.
 *
 * Ordered by how much someone else is blocked: a host who has not confirmed a
 * result is holding up everyone's ratings and cards, whereas an unanswered RSVP
 * only affects the person who has not answered.
 */

export type AttentionItem = {
  type: 'record_result' | 'finalize_attendance' | 'rate_opponents' | 'answer_rsvp'
  matchId: string
  scheduledAt: string
  venueName: string | null
  city: string | null
}

/** Recently enough that acting on it is still meaningful. */
const LOOKBACK_DAYS = 30

async function getAttention(internalUserId: string, playerId: string): Promise<AttentionItem[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const now = new Date()

  const shape = {
    matchId: matches.id,
    scheduledAt: matches.scheduledAt,
    venueName: matches.venueName,
    city: matches.city,
  }

  const [awaitingResult, awaitingFinalization, awaitingRatings, awaitingRsvp] = await Promise.all([
    // Kickoff has passed but no score exists. Nothing downstream can happen —
    // no ratings, no cards, no settled bets — until the host records it.
    db.select(shape).from(matches).where(and(
      eq(matches.hostId, internalUserId),
      lt(matches.scheduledAt, now),
      gt(matches.scheduledAt, since),
      ne(matches.status, 'cancelled'),
      isNull(matches.voidedAt),
      isNull(matches.scoreA),
    )),

    // Result recorded, sheet not settled. The automatic sweep will do it after
    // 48h (ADR-029), so this is a nudge rather than a blockage.
    db.select(shape).from(matches).where(and(
      eq(matches.hostId, internalUserId),
      eq(matches.status, 'completed'),
      gt(matches.scheduledAt, since),
      isNull(matches.voidedAt),
      isNotNull(matches.scoreA),
      sql`EXISTS (
        SELECT 1 FROM ${matchAttendances}
        WHERE ${matchAttendances.matchId} = ${matches.id}
          AND ${matchAttendances.finalizedAt} IS NULL
      )`,
    )),

    // Played, completed, and this player has rated nobody yet.
    db.select(shape).from(matches)
      .innerJoin(matchParticipants, eq(matchParticipants.matchId, matches.id))
      .where(and(
        eq(matchParticipants.playerId, playerId),
        eq(matches.status, 'completed'),
        gt(matches.scheduledAt, since),
        isNull(matches.voidedAt),
        isNotNull(matches.scoreA),
        sql`NOT EXISTS (
          SELECT 1 FROM ${ratings}
          WHERE ${ratings.matchId} = ${matches.id}
            AND ${ratings.raterPlayerId} = ${playerId}
        )`,
      )),

    // On the sheet for something upcoming and still has not said yes or no.
    db.select(shape).from(matches)
      .innerJoin(matchAttendances, eq(matchAttendances.matchId, matches.id))
      .where(and(
        eq(matchAttendances.playerId, playerId),
        eq(matchAttendances.status, 'unknown'),
        eq(matches.status, 'attendance_open'),
        gt(matches.scheduledAt, now),
      )),
  ])

  const toItems = (rows: typeof awaitingResult, type: AttentionItem['type']): AttentionItem[] =>
    rows.map((row) => ({
      type,
      matchId: row.matchId,
      scheduledAt: row.scheduledAt.toISOString(),
      venueName: row.venueName,
      city: row.city,
    }))

  // Deliberate order: most blocking to others first.
  return [
    ...toItems(awaitingResult, 'record_result'),
    ...toItems(awaitingFinalization, 'finalize_attendance'),
    ...toItems(awaitingRatings, 'rate_opponents'),
    ...toItems(awaitingRsvp, 'answer_rsvp'),
  ]
}

export const attentionService = { getAttention }
