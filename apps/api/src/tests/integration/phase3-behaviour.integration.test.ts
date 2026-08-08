import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, inArray } from 'drizzle-orm'
import { BEHAVIOUR_REPORT_WINDOW_HOURS } from '@fivematch/types'
import { db } from '../../db'
import {
  behaviourReports,
  groupMemberships,
  groups,
  matchParticipants,
  matches,
  playerMatchEligibilities,
  players,
  users,
} from '../../db/schema'
import { behaviourReportService } from '../../services/matches/behaviour-report.service'
import { gdprService } from '../../services/gdpr/gdpr.service'
import { phase3Fixtures as fx, phase3SyntheticIdentity as identity } from '../fixtures/phase3-fixtures'

const ALL_USER_IDS = Object.values(fx.users)
const ALL_PLAYER_IDS = Object.values(fx.players)
const ALL_GROUP_IDS = Object.values(fx.groups)
const ALL_MATCH_IDS = Object.values(fx.matches)

const KICKOFF = new Date('2099-03-01T19:00:00.000Z')
const COMPLETED_AT = new Date('2099-03-01T21:00:00.000Z')

/**
 * Role names read better than fixture keys here. `host` is the crew organizer,
 * `attended`/`excused`/`lateCancel` are ordinary players, `noShow` is the
 * co-host, and `waitlisted` is the subject being reported about.
 */
const ORGANIZER = fx.players.host
const REPORTER_ONE = fx.players.attended
const REPORTER_TWO = fx.players.excused
const REPORTER_THREE = fx.players.lateCancel
const CO_HOST = fx.players.noShow
const SUBJECT = fx.players.waitlisted
const OUTSIDER = fx.players.neverIn

async function cleanup() {
  await db.delete(playerMatchEligibilities).where(inArray(playerMatchEligibilities.matchId, ALL_MATCH_IDS))
  await db.delete(behaviourReports).where(inArray(behaviourReports.matchId, ALL_MATCH_IDS))
  await db.delete(matchParticipants).where(inArray(matchParticipants.matchId, ALL_MATCH_IDS))
  await db.delete(matches).where(inArray(matches.id, ALL_MATCH_IDS))
  await db.delete(groupMemberships).where(inArray(groupMemberships.groupId, ALL_GROUP_IDS))
  await db.delete(players).where(inArray(players.id, ALL_PLAYER_IDS))
  await db.delete(groups).where(inArray(groups.id, ALL_GROUP_IDS))
  await db.delete(users).where(inArray(users.id, ALL_USER_IDS))
}

async function seedIdentities() {
  const keys = Object.keys(fx.users) as Array<keyof typeof fx.users>

  await db.insert(users).values(
    keys.map((key) => ({
      id: fx.users[key],
      clerkUserId: identity.clerkId(`b-${key}`),
      email: identity.email(`b-${key}`),
    })),
  )
  await db.insert(players).values(
    keys.map((key) => ({
      id: fx.players[key],
      userId: fx.users[key],
      displayName: identity.name(key),
      ovrScoreFloat: '65.000',
    })),
  )
  await db.insert(groups).values({
    id: fx.groups.standard,
    organizerId: fx.users.host,
    name: identity.name('crew'),
    formatPreset: '5v5',
    goalkeeperMode: 'none',
    generatorStyle: 'pure_ovr',
  })
  await db.insert(groupMemberships).values([
    { groupId: fx.groups.standard, userId: fx.users.host, role: 'organizer', joinedAt: KICKOFF },
    { groupId: fx.groups.standard, userId: fx.users.noShow, role: 'co_host', joinedAt: KICKOFF },
    { groupId: fx.groups.standard, userId: fx.users.attended, role: 'member', joinedAt: KICKOFF },
    { groupId: fx.groups.standard, userId: fx.users.excused, role: 'member', joinedAt: KICKOFF },
    { groupId: fx.groups.standard, userId: fx.users.lateCancel, role: 'member', joinedAt: KICKOFF },
    { groupId: fx.groups.standard, userId: fx.users.waitlisted, role: 'member', joinedAt: KICKOFF },
  ])
}

/** `groupId: null` produces a standalone match — no crew, so no validator. */
async function seedMatch(matchId: string, groupId: string | null, withResult = true) {
  await db.insert(matches).values({
    id: matchId,
    groupId,
    hostId: fx.users.host,
    status: withResult ? 'completed' : 'in_progress',
    scheduledAt: KICKOFF,
    completedAt: withResult ? COMPLETED_AT : null,
    format: '5v5',
    playersPerTeam: 5,
    goalkeeperMode: 'none',
    generatorStyle: 'pure_ovr',
    scoreA: withResult ? 3 : null,
    scoreB: withResult ? 2 : null,
  })

  const everyone = [ORGANIZER, REPORTER_ONE, REPORTER_TWO, REPORTER_THREE, CO_HOST, SUBJECT]
  await db.insert(matchParticipants).values(
    everyone.map((playerId, index) => ({
      matchId,
      playerId,
      userId: ALL_USER_IDS[index],
      displayName: identity.name(`p-${index}`),
      teamSide: (index % 2 === 0 ? 'A' : 'B') as 'A' | 'B',
    })),
  )
}

async function statusesFor(matchId: string, subjectPlayerId: string) {
  const rows = await db
    .select({ id: behaviourReports.id, status: behaviourReports.status })
    .from(behaviourReports)
    .where(and(
      eq(behaviourReports.matchId, matchId),
      eq(behaviourReports.subjectPlayerId, subjectPlayerId),
    ))
  return rows.map((row) => row.status).sort()
}

beforeEach(async () => {
  await cleanup()
  await seedIdentities()
})

afterEach(cleanup)

describe('Phase 3B behaviour reports', () => {
  it('keeps a single uncorroborated report inert', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)

    const report = await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: SUBJECT,
      category: 'unsporting',
    })

    // One person must never be able to move another player's standing alone.
    expect(report.status).toBe('pending')
    expect(await statusesFor(fx.matches.completed, SUBJECT)).toEqual(['pending'])
  })

  it('finalizes the whole set once two independent reporters agree', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)

    await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: SUBJECT,
      category: 'aggression',
    })
    const second = await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_TWO,
      subjectPlayerId: SUBJECT,
      category: 'aggression',
    })

    // The earlier report must not be left pending behind the corroborator.
    expect(await statusesFor(fx.matches.completed, SUBJECT)).toEqual(['finalized', 'finalized'])
    expect(second.category).toBe('aggression')
  })

  it('does not treat different categories as agreement', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)

    await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: SUBJECT,
      category: 'dangerous_play',
    })
    await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_TWO,
      subjectPlayerId: SUBJECT,
      category: 'unsporting',
    })

    // Two complaints, but about different things — that is not corroboration.
    expect(await statusesFor(fx.matches.completed, SUBJECT)).toEqual(['pending', 'pending'])
  })

  it('refuses a second report from the same reporter', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)

    await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: SUBJECT,
      category: 'aggression',
    })

    // Otherwise one person could manufacture their own corroboration.
    await expect(behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: SUBJECT,
      category: 'aggression',
    })).rejects.toMatchObject({ code: 'ALREADY_REPORTED' })

    expect(await statusesFor(fx.matches.completed, SUBJECT)).toEqual(['pending'])
  })

  it('rejects a self-report', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)

    await expect(behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: SUBJECT,
      subjectPlayerId: SUBJECT,
      category: 'unsporting',
    })).rejects.toMatchObject({ code: 'CANNOT_REPORT_SELF' })
  })

  it('rejects a report from someone who did not play', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)

    await expect(behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: OUTSIDER,
      subjectPlayerId: SUBJECT,
      category: 'unsporting',
    })).rejects.toMatchObject({ code: 'NOT_A_PARTICIPANT' })
  })

  it('rejects a report on a match with no result', async () => {
    await seedMatch(fx.matches.noResult, fx.groups.standard, false)

    await expect(behaviourReportService.submitReport({
      matchId: fx.matches.noResult,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: SUBJECT,
      category: 'unsporting',
    })).rejects.toMatchObject({ code: 'WRONG_MATCH_STATUS' })
  })

  it('finalizes praise immediately without corroboration', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)

    const report = await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: SUBJECT,
      category: 'good_spirit',
    })

    // Requiring two witnesses before a compliment counts would suppress it.
    expect(report.status).toBe('finalized')
  })

  it('lets an impartial organizer finalize a pending report', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)
    const report = await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: SUBJECT,
      category: 'dangerous_play',
    })

    const resolved = await behaviourReportService.resolveReport(report.id, ORGANIZER, 'finalized')

    expect(resolved?.status).toBe('finalized')
    expect(resolved?.validatorPlayerId).toBe(ORGANIZER)
  })

  it('lets a co-host resolve a report the organizer is party to', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)
    const report = await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: ORGANIZER,
      subjectPlayerId: SUBJECT,
      category: 'aggression',
    })

    // This is exactly why co_host exists.
    await expect(behaviourReportService.resolveReport(report.id, ORGANIZER, 'finalized'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })

    const resolved = await behaviourReportService.resolveReport(report.id, CO_HOST, 'dismissed')
    expect(resolved?.status).toBe('dismissed')
  })

  it('never lets the subject resolve a report about themselves', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)
    // Make the subject an organizer too — authority must not override the
    // impartiality rule.
    await db
      .update(groupMemberships)
      .set({ role: 'organizer' })
      .where(and(
        eq(groupMemberships.groupId, fx.groups.standard),
        eq(groupMemberships.userId, fx.users.waitlisted),
      ))

    const report = await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: SUBJECT,
      category: 'aggression',
    })

    await expect(behaviourReportService.resolveReport(report.id, SUBJECT, 'dismissed'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('gives an ordinary member no resolution authority', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)
    const report = await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: SUBJECT,
      category: 'aggression',
    })

    await expect(behaviourReportService.resolveReport(report.id, REPORTER_THREE, 'finalized'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('leaves a standalone match with no validator at all', async () => {
    await seedMatch(fx.matches.strictDeadline, null)
    const report = await behaviourReportService.submitReport({
      matchId: fx.matches.strictDeadline,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: SUBJECT,
      category: 'aggression',
    })

    // No crew, so nobody holds authority — not even the host.
    await expect(behaviourReportService.resolveReport(report.id, ORGANIZER, 'finalized'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(behaviourReportService.resolveReport(report.id, CO_HOST, 'finalized'))
      .rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('still finalizes a standalone report by corroboration', async () => {
    await seedMatch(fx.matches.strictDeadline, null)

    await behaviourReportService.submitReport({
      matchId: fx.matches.strictDeadline,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: SUBJECT,
      category: 'aggression',
    })
    await behaviourReportService.submitReport({
      matchId: fx.matches.strictDeadline,
      reporterPlayerId: REPORTER_TWO,
      subjectPlayerId: SUBJECT,
      category: 'aggression',
    })

    expect(await statusesFor(fx.matches.strictDeadline, SUBJECT)).toEqual(['finalized', 'finalized'])
  })

  it('expires a report nobody resolved, permanently', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)
    const report = await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: SUBJECT,
      category: 'aggression',
    })

    const afterWindow = new Date(
      COMPLETED_AT.getTime() + (BEHAVIOUR_REPORT_WINDOW_HOURS + 1) * 60 * 60 * 1000,
    )
    const expiredCount = await behaviourReportService.expireStaleReports(afterWindow)

    expect(expiredCount).toBe(1)
    expect(await statusesFor(fx.matches.completed, SUBJECT)).toEqual(['expired'])

    // Expired is terminal — a late validator cannot revive it.
    await expect(behaviourReportService.resolveReport(report.id, ORGANIZER, 'finalized'))
      .rejects.toMatchObject({ code: 'REPORT_ALREADY_RESOLVED' })
  })

  it('is idempotent on resolution and on expiry sweeps', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)
    const report = await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: SUBJECT,
      category: 'aggression',
    })

    await behaviourReportService.resolveReport(report.id, ORGANIZER, 'finalized')
    await expect(behaviourReportService.resolveReport(report.id, CO_HOST, 'dismissed'))
      .rejects.toMatchObject({ code: 'REPORT_ALREADY_RESOLVED' })

    // A resolved report is not pending, so no sweep can touch it.
    const swept = await behaviourReportService.expireStaleReports(
      new Date(COMPLETED_AT.getTime() + 1000 * 60 * 60 * 1000),
    )
    expect(swept).toBe(0)
    expect(await statusesFor(fx.matches.completed, SUBJECT)).toEqual(['finalized'])
  })

  it('erases reports about a purged user and detaches the ones they filed', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)

    const aboutSubject = await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: SUBJECT,
      category: 'aggression',
      detail: 'reporter free text',
    })
    await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: SUBJECT,
      subjectPlayerId: REPORTER_TWO,
      category: 'unsporting',
      detail: 'written by the purged user',
    })

    await gdprService.purgeUser(fx.users.waitlisted, new Date())

    // Nothing about them survives.
    expect(await statusesFor(fx.matches.completed, SUBJECT)).toEqual([])

    // What they wrote about someone else survives, stripped of them.
    const [filedByThem] = await db
      .select()
      .from(behaviourReports)
      .where(eq(behaviourReports.subjectPlayerId, REPORTER_TWO))

    expect(filedByThem).toBeDefined()
    expect(filedByThem?.reporterPlayerId).toBeNull()
    expect(filedByThem?.detail).toBeNull()
    expect(aboutSubject.detail).toBe('reporter free text')
  })

  it('never hands reporter identity to a validator queue', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)
    await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: SUBJECT,
      category: 'aggression',
      detail: 'context for the validator',
    })

    const queue = await behaviourReportService.getPendingForMatch(fx.matches.completed, ORGANIZER)

    expect(queue).toHaveLength(1)
    // A validator judges the account, not its author — and is often in the same
    // crew as both parties.
    expect(Object.keys(queue[0]!)).not.toContain('reporterPlayerId')
    expect(JSON.stringify(queue)).not.toContain(REPORTER_ONE)
    // The account itself still reaches them, or there is nothing to judge.
    expect(queue[0]!.detail).toBe('context for the validator')
  })

  it('hides reports the validator is party to from their own queue', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)
    await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: ORGANIZER,
      subjectPlayerId: SUBJECT,
      category: 'aggression',
    })
    await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: ORGANIZER,
      category: 'unsporting',
    })

    const queue = await behaviourReportService.getPendingForMatch(fx.matches.completed, ORGANIZER)

    // One they filed, one about them — neither is theirs to settle, so neither
    // should appear as actionable work.
    expect(queue).toHaveLength(0)

    // The co-host, party to neither, sees both.
    const coHostQueue = await behaviourReportService.getPendingForMatch(fx.matches.completed, CO_HOST)
    expect(coHostQueue).toHaveLength(2)
  })

  it('exposes only finalized reports to a fair-play projection', async () => {
    await seedMatch(fx.matches.completed, fx.groups.standard)

    const pending = await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_ONE,
      subjectPlayerId: SUBJECT,
      category: 'unsporting',
    })
    const toDismiss = await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_TWO,
      subjectPlayerId: SUBJECT,
      category: 'dangerous_play',
    })
    await behaviourReportService.resolveReport(toDismiss.id, ORGANIZER, 'dismissed')
    await behaviourReportService.submitReport({
      matchId: fx.matches.completed,
      reporterPlayerId: REPORTER_THREE,
      subjectPlayerId: SUBJECT,
      category: 'good_spirit',
    })

    const visible = await behaviourReportService.getFinalizedReportsForPlayer(SUBJECT)

    // Pending and dismissed contribute nothing; only the finalized praise shows.
    expect(visible).toHaveLength(1)
    expect(visible[0]?.category).toBe('good_spirit')
    expect(pending.status).toBe('pending')
  })
})
