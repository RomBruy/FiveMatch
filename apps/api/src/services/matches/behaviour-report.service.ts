import { and, count, eq, inArray, isNull, lt, ne, sql } from 'drizzle-orm'
import {
  BEHAVIOUR_CORROBORATION_MIN_REPORTERS,
  BEHAVIOUR_NEGATIVE_WEIGHTS,
  BEHAVIOUR_REPORT_WINDOW_HOURS,
} from '@fivematch/types'
import { db, type Db } from '../../db'
import {
  behaviourReports,
  groupMemberships,
  matchParticipants,
  matches,
  players,
} from '../../db/schema'
import { hasPhase1EligibilityEvidence } from './eligibility.service'

type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0]

export type BehaviourCategory = keyof typeof BEHAVIOUR_NEGATIVE_WEIGHTS | 'good_spirit' | 'helped_organize'

export function isNegativeCategory(category: BehaviourCategory): boolean {
  return category in BEHAVIOUR_NEGATIVE_WEIGHTS
}

export class BehaviourReportError extends Error {
  constructor(public code: string, public statusCode: number) {
    super(code)
    this.name = 'BehaviourReportError'
  }
}

const fail = (code: string, statusCode: number) => new BehaviourReportError(code, statusCode)

/**
 * Who may settle this report.
 *
 * The impartiality rule is the whole point: never the reporter, never the
 * subject. A crew organizer or co-host qualifies otherwise. A standalone match
 * has no crew, so it has no validator at all and falls through to corroboration
 * or expiry — an authority nobody staffs is worse than an explicit expiry.
 */
export async function canResolve(
  tx: Transaction,
  report: { reporterPlayerId: string | null; subjectPlayerId: string; matchId: string },
  candidatePlayerId: string,
): Promise<boolean> {
  if (candidatePlayerId === report.reporterPlayerId) return false
  if (candidatePlayerId === report.subjectPlayerId) return false

  const [match] = await tx
    .select({ groupId: matches.groupId })
    .from(matches)
    .where(eq(matches.id, report.matchId))
    .limit(1)

  if (!match?.groupId) return false

  const [candidate] = await tx
    .select({ userId: players.userId })
    .from(players)
    .where(and(eq(players.id, candidatePlayerId), isNull(players.deletedAt)))
    .limit(1)

  if (!candidate) return false

  const [membership] = await tx
    .select({ role: groupMemberships.role })
    .from(groupMemberships)
    .where(and(
      eq(groupMemberships.groupId, match.groupId),
      eq(groupMemberships.userId, candidate.userId),
      isNull(groupMemberships.deletedAt),
    ))
    .limit(1)

  return membership?.role === 'organizer' || membership?.role === 'co_host'
}

async function assertBothPlayed(tx: Transaction, matchId: string, playerIds: string[]) {
  const rows = await tx
    .select({ playerId: matchParticipants.playerId })
    .from(matchParticipants)
    .where(and(
      eq(matchParticipants.matchId, matchId),
      inArray(matchParticipants.playerId, playerIds),
    ))

  const present = new Set(rows.map((row) => row.playerId))
  for (const playerId of playerIds) {
    if (!present.has(playerId)) throw fail('NOT_A_PARTICIPANT', 403)
  }
}

/**
 * Count distinct reporters who independently said the same thing about the same
 * player at the same match. Same category is required: "two people complained
 * about him" is not agreement if one meant a dangerous tackle and the other
 * meant sulking.
 */
async function corroboratingReporterCount(
  tx: Transaction,
  matchId: string,
  subjectPlayerId: string,
  category: BehaviourCategory,
): Promise<number> {
  const [row] = await tx
    .select({ total: count(sql`DISTINCT ${behaviourReports.reporterPlayerId}`) })
    .from(behaviourReports)
    .where(and(
      eq(behaviourReports.matchId, matchId),
      eq(behaviourReports.subjectPlayerId, subjectPlayerId),
      eq(behaviourReports.category, category),
      ne(behaviourReports.status, 'dismissed'),
    ))

  return Number(row?.total ?? 0)
}

async function submitReportInTransaction(
  tx: Transaction,
  input: {
    matchId: string
    reporterPlayerId: string
    subjectPlayerId: string
    category: BehaviourCategory
    detail?: string | null
  },
) {
  const { matchId, reporterPlayerId, subjectPlayerId, category, detail } = input

  if (reporterPlayerId === subjectPlayerId) throw fail('CANNOT_REPORT_SELF', 422)

  const [match] = await tx
    .select({
      status: matches.status,
      scoreA: matches.scoreA,
      scoreB: matches.scoreB,
      completedAt: matches.completedAt,
    })
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1)

  if (!match) throw fail('MATCH_NOT_FOUND', 404)
  // Same evidence bar as ratings and the card ledger: no result, no report.
  if (!hasPhase1EligibilityEvidence(match)) throw fail('WRONG_MATCH_STATUS', 422)

  await assertBothPlayed(tx, matchId, [reporterPlayerId, subjectPlayerId])

  const expiresAt = new Date(
    (match.completedAt ?? new Date()).getTime() + BEHAVIOUR_REPORT_WINDOW_HOURS * 60 * 60 * 1000,
  )

  // Praise cannot harm anyone, and requiring two witnesses before a compliment
  // counts would simply suppress it. The +10 cap in ADR-019 bounds any gaming.
  const positive = !isNegativeCategory(category)

  const [created] = await tx
    .insert(behaviourReports)
    .values({
      matchId,
      reporterPlayerId,
      subjectPlayerId,
      category,
      detail: detail ?? null,
      expiresAt,
      status: positive ? 'finalized' : 'pending',
      resolvedAt: positive ? new Date() : null,
    })
    .onConflictDoNothing()
    .returning()

  if (!created) throw fail('ALREADY_REPORTED', 409)
  if (positive) return created

  // Enough independent voices now agree — finalize the whole set together so a
  // late corroborator does not leave earlier identical reports pending forever.
  const reporters = await corroboratingReporterCount(tx, matchId, subjectPlayerId, category)
  if (reporters >= BEHAVIOUR_CORROBORATION_MIN_REPORTERS) {
    await tx
      .update(behaviourReports)
      .set({ status: 'finalized', resolvedAt: new Date() })
      .where(and(
        eq(behaviourReports.matchId, matchId),
        eq(behaviourReports.subjectPlayerId, subjectPlayerId),
        eq(behaviourReports.category, category),
        eq(behaviourReports.status, 'pending'),
      ))
  }

  return created
}

async function submitReport(input: Parameters<typeof submitReportInTransaction>[1]) {
  return db.transaction((tx) => submitReportInTransaction(tx, input))
}

/**
 * Settle a pending report as a validator. Idempotent via the `pending` guard —
 * a replay finds nothing to update and changes nothing.
 */
async function resolveReport(
  reportId: string,
  validatorPlayerId: string,
  decision: 'finalized' | 'dismissed',
) {
  return db.transaction(async (tx) => {
    const [report] = await tx
      .select({
        id: behaviourReports.id,
        matchId: behaviourReports.matchId,
        reporterPlayerId: behaviourReports.reporterPlayerId,
        subjectPlayerId: behaviourReports.subjectPlayerId,
        status: behaviourReports.status,
        expiresAt: behaviourReports.expiresAt,
      })
      .from(behaviourReports)
      .where(eq(behaviourReports.id, reportId))
      .limit(1)

    if (!report) throw fail('REPORT_NOT_FOUND', 404)
    if (report.status !== 'pending') throw fail('REPORT_ALREADY_RESOLVED', 409)
    if (report.expiresAt.getTime() <= Date.now()) throw fail('REPORT_EXPIRED', 409)

    if (!(await canResolve(tx, report, validatorPlayerId))) throw fail('FORBIDDEN', 403)

    const [updated] = await tx
      .update(behaviourReports)
      .set({ status: decision, validatorPlayerId, resolvedAt: new Date() })
      .where(and(eq(behaviourReports.id, reportId), eq(behaviourReports.status, 'pending')))
      .returning()

    return updated
  })
}

/**
 * Retire reports nobody resolved in time. Safe to run repeatedly; expired
 * reports are permanently inert and never reach fair play.
 */
async function expireStaleReports(now: Date = new Date()): Promise<number> {
  const expired = await db
    .update(behaviourReports)
    .set({ status: 'expired', resolvedAt: now })
    .where(and(eq(behaviourReports.status, 'pending'), lt(behaviourReports.expiresAt, now)))
    .returning({ id: behaviourReports.id })

  return expired.length
}

/**
 * A validator's queue for one match.
 *
 * Reporter identity is never selected — not even for the validator, who needs to
 * judge the account rather than its author, and who may well be in the same crew
 * as both parties. Reports the caller is party to are excluded here as well as
 * refused at write time, so an unresolvable report never appears as actionable.
 */
async function getPendingForMatch(matchId: string, validatorPlayerId: string) {
  const rows = await db
    .select({
      id: behaviourReports.id,
      subjectPlayerId: behaviourReports.subjectPlayerId,
      category: behaviourReports.category,
      detail: behaviourReports.detail,
      expiresAt: behaviourReports.expiresAt,
      createdAt: behaviourReports.createdAt,
      reporterPlayerId: behaviourReports.reporterPlayerId,
    })
    .from(behaviourReports)
    .where(and(
      eq(behaviourReports.matchId, matchId),
      eq(behaviourReports.status, 'pending'),
    ))

  return rows
    .filter((row) => row.reporterPlayerId !== validatorPlayerId)
    .filter((row) => row.subjectPlayerId !== validatorPlayerId)
    .map(({ reporterPlayerId: _reporterPlayerId, ...safe }) => safe)
}

/** Finalized reports only — the sole input a fair-play projection may read. */
async function getFinalizedReportsForPlayer(subjectPlayerId: string) {
  return db
    .select({
      matchId: behaviourReports.matchId,
      category: behaviourReports.category,
      resolvedAt: behaviourReports.resolvedAt,
    })
    .from(behaviourReports)
    .where(and(
      eq(behaviourReports.subjectPlayerId, subjectPlayerId),
      eq(behaviourReports.status, 'finalized'),
    ))
}

export const behaviourReportService = {
  submitReport,
  submitReportInTransaction,
  resolveReport,
  expireStaleReports,
  getPendingForMatch,
  getFinalizedReportsForPlayer,
  canResolve,
  isNegativeCategory,
}
