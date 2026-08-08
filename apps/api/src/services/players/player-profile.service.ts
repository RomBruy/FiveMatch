import { and, avg, count, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import {
  PrivatePlayerProfileSchema,
  PublicPlayerProfileSchema,
  type ProfileFieldVisibility,
  type PublicPlayerProfile,
} from '@fivematch/types'
import { PRONOS_STARTING_BANKROLL } from '@fivematch/types/algorithm-constants'
import { db } from '../../db'
import {
  matchParticipants,
  matches,
  playerMatchEligibilities,
  players,
  ratingEvents,
  ratings,
  users,
} from '../../db/schema'
import { trustProjectionService } from '../trust/trust-projection.service'
import { ovrService } from './ovr.service'
import {
  canViewerSeeProfileField,
  normalizeProfileFieldVisibility,
  type ProfileViewerScope,
} from './profile-privacy.service'

export const PUBLIC_RATING_AGGREGATE_MIN_SAMPLE = 4

const num = (value: string | null): number | null => value === null ? null : Number(value)

function trendOf(previous: string | null, current: string | null): 'up' | 'down' | 'stable' | null {
  const prev = num(previous)
  const curr = num(current)
  if (prev === null || curr === null) return null
  const trend = ovrService.computeTrend(prev, curr)
  return trend === 'Trending up' ? 'up' : trend === 'Trending down' ? 'down' : 'stable'
}

async function viewerScope(
  targetUserId: string,
  targetPlayerId: string,
  viewerInternalUserId: string,
  viewerPlayerId: string | undefined,
): Promise<ProfileViewerScope> {
  if (targetUserId === viewerInternalUserId) {
    return { isOwner: true, sharesActiveGroup: true, sharesConfirmedMatch: true }
  }

  const [sharedGroup, sharedMatch] = await Promise.all([
    db.execute(sql`
      SELECT 1
      FROM group_memberships subject
      JOIN group_memberships viewer ON viewer.group_id = subject.group_id
      WHERE subject.user_id = ${targetUserId}
        AND viewer.user_id = ${viewerInternalUserId}
        AND subject.role <> 'pending_member'
        AND viewer.role <> 'pending_member'
        AND subject.deleted_at IS NULL
        AND viewer.deleted_at IS NULL
      LIMIT 1
    `),
    viewerPlayerId
      ? db.execute(sql`
          SELECT 1
          WHERE EXISTS (
            SELECT 1 FROM match_participants subject
            JOIN match_participants viewer ON viewer.match_id = subject.match_id
            WHERE subject.player_id = ${targetPlayerId} AND viewer.player_id = ${viewerPlayerId}
          ) OR EXISTS (
            SELECT 1 FROM match_attendances subject
            JOIN match_attendances viewer ON viewer.match_id = subject.match_id
            WHERE subject.player_id = ${targetPlayerId}
              AND viewer.player_id = ${viewerPlayerId}
              AND subject.status = 'in' AND subject.waitlist_position IS NULL
              AND viewer.status = 'in' AND viewer.waitlist_position IS NULL
          )
          LIMIT 1
        `)
      : Promise.resolve({ rows: [] }),
  ])

  return {
    isOwner: false,
    sharesActiveGroup: sharedGroup.rows.length > 0,
    sharesConfirmedMatch: sharedMatch.rows.length > 0,
  }
}

async function ratingAggregate(playerId: string) {
  const [row] = await db
    .select({
      sampleCount: count(ratings.id),
      pace: avg(ratings.pace), technique: avg(ratings.technique), passing: avg(ratings.passing),
      defending: avg(ratings.defending), physicality: avg(ratings.physicality), effort: avg(ratings.effort),
    })
    .from(ratings)
    .where(and(
      eq(ratings.ratedPlayerId, playerId),
      eq(ratings.isInitial, false),
      isNotNull(ratings.matchId),
      isNotNull(ratings.raterPlayerId),
      sql`EXISTS (
        SELECT 1 FROM player_match_eligibilities target_e
        JOIN player_match_eligibilities rater_e
          ON rater_e.match_id = target_e.match_id
          AND rater_e.player_id = ${ratings.raterPlayerId}
          AND rater_e.invalidated_at IS NULL
        JOIN match_participants target_p
          ON target_p.match_id = target_e.match_id AND target_p.player_id = ${ratings.ratedPlayerId}
        JOIN match_participants rater_p
          ON rater_p.match_id = target_e.match_id AND rater_p.player_id = ${ratings.raterPlayerId}
        WHERE target_e.match_id = ${ratings.matchId}
          AND target_e.player_id = ${ratings.ratedPlayerId}
          AND target_e.invalidated_at IS NULL
          AND target_p.team_side <> rater_p.team_side
      )`,
    ))

  const sampleCount = Number(row?.sampleCount ?? 0)
  const attributes = sampleCount >= PUBLIC_RATING_AGGREGATE_MIN_SAMPLE && row?.pace !== null
    ? {
        pace: Number(row.pace), technique: Number(row.technique), passing: Number(row.passing),
        defending: Number(row.defending), physicality: Number(row.physicality), effort: Number(row.effort),
      }
    : null
  return { sampleCount, attributes }
}

async function loadBase(playerId: string) {
  const [row] = await db
    .select({
      playerId: players.id,
      userId: players.userId,
      displayName: players.displayName,
      cardState: players.cardState,
      skillLevel: players.skillLevel,
      commitmentCount: players.commitmentCount,
      noShowCount: players.noShowCount,
      playerTier: players.playerTier,
      ovrScoreFloat: players.ovrScoreFloat,
      previousOvrScoreFloat: players.previousOvrScoreFloat,
      profilePhotoCardUrl: players.profilePhotoCardUrl,
      pronosBalance: players.pronosBalance,
      profilePhotoUrl: users.profilePhotoUrl,
      currentClub: users.currentClub,
      formerClub: users.formerClub,
      preferredPosition: users.preferredPosition,
      strongFoot: users.strongFoot,
      playerStyle: users.playerStyle,
      specialSkill: users.specialSkill,
      favoriteExcuse: users.favoriteExcuse,
      badFaithLevel: users.badFaithLevel,
      lockerRoomStyle: users.lockerRoomStyle,
      thirdHalfProfile: users.thirdHalfProfile,
      profileFieldVisibility: users.profileFieldVisibility,
    })
    .from(players)
    .innerJoin(users, eq(users.id, players.userId))
    .where(and(eq(players.id, playerId), isNull(players.deletedAt), isNull(users.deletedAt)))
    .limit(1)
  if (!row) return null

  const [[eligibility], aggregate, [mvp]] = await Promise.all([
    db.select({ value: count() }).from(playerMatchEligibilities).where(and(
      eq(playerMatchEligibilities.playerId, playerId), isNull(playerMatchEligibilities.invalidatedAt),
    )),
    ratingAggregate(playerId),
    db.select({ id: matches.id }).from(matches).where(and(
      eq(matches.mvpPlayerId, playerId), eq(matches.status, 'completed'), isNotNull(matches.mvpVotingResolvedAt),
    )).limit(1),
  ])

  const eligibleMatchCount = Number(eligibility?.value ?? 0)
  const trust = await trustProjectionService.getProjection(playerId)
  return {
    ...row,
    trust,
    visibility: normalizeProfileFieldVisibility(row.profileFieldVisibility),
    eligibleMatchCount,
    ovrScore: ovrService.getOvrForDisplay(num(row.ovrScoreFloat), eligibleMatchCount),
    trend: trendOf(row.previousOvrScoreFloat, row.ovrScoreFloat),
    ratingAggregate: aggregate,
    isMvp: Boolean(mvp),
  }
}

function filteredPublicProfile(
  row: NonNullable<Awaited<ReturnType<typeof loadBase>>>,
  scope: ProfileViewerScope,
): PublicPlayerProfile {
  const visible = (field: keyof ProfileFieldVisibility) => canViewerSeeProfileField(row.visibility[field], scope)
  const footballIdentity = {
    ...(visible('currentClub') ? { currentClub: row.currentClub } : {}),
    ...(visible('formerClub') ? { formerClub: row.formerClub } : {}),
    ...(visible('preferredPosition') ? { preferredPosition: row.preferredPosition } : {}),
    ...(visible('strongFoot') ? { strongFoot: row.strongFoot } : {}),
    ...(visible('playerStyle') ? { playerStyle: row.playerStyle } : {}),
  }
  const personality = {
    ...(visible('specialSkill') ? { specialSkill: row.specialSkill } : {}),
    ...(visible('favoriteExcuse') ? { favoriteExcuse: row.favoriteExcuse } : {}),
    ...(visible('badFaithLevel') ? { badFaithLevel: row.badFaithLevel } : {}),
    ...(visible('lockerRoomStyle') ? { lockerRoomStyle: row.lockerRoomStyle } : {}),
    ...(visible('thirdHalfProfile') ? { thirdHalfProfile: row.thirdHalfProfile } : {}),
  }

  return PublicPlayerProfileSchema.parse({
    playerId: row.playerId,
    displayName: row.displayName,
    skillLevel: row.skillLevel,
    cardState: row.cardState,
    eligibleMatchCount: row.eligibleMatchCount,
    ovrScore: row.ovrScore,
    trend: row.trend,
    isReliable: row.trust.isReliable,
    ratingAggregate: row.ratingAggregate,
    ...(visible('profilePhoto') ? { photoUrl: row.profilePhotoUrl } : {}),
    ...(visible('generatedCardPhoto') ? { generatedCardPhotoUrl: row.profilePhotoCardUrl } : {}),
    playerTier: row.playerTier,
    isMvp: row.isMvp,
    ...(Object.keys(footballIdentity).length ? { footballIdentity } : {}),
    ...(Object.keys(personality).length ? { personality } : {}),
  })
}

async function getPublicProfile(
  playerId: string,
  viewerInternalUserId: string,
  viewerPlayerId: string | undefined,
) {
  const row = await loadBase(playerId)
  if (!row) return null
  const scope = await viewerScope(row.userId, row.playerId, viewerInternalUserId, viewerPlayerId)
  return filteredPublicProfile(row, scope)
}

async function getPrivateProfile(playerId: string, clerkUserId: string) {
  const row = await loadBase(playerId)
  if (!row) return null

  const [history, [tightestMatch]] = await Promise.all([
    db.select({
      matchId: ratingEvents.matchId,
      oldOvr: ratingEvents.oldOvr,
      newOvr: ratingEvents.newOvr,
      createdAt: ratingEvents.createdAt,
    }).from(ratingEvents).where(and(
      eq(ratingEvents.playerId, playerId), eq(ratingEvents.eventType, 'MATCH_UPDATE'),
    )).orderBy(desc(ratingEvents.createdAt)).limit(50),
    db.select({ scheduledAt: matches.scheduledAt, scoreA: matches.scoreA, scoreB: matches.scoreB })
      .from(matchParticipants)
      .innerJoin(matches, eq(matches.id, matchParticipants.matchId))
      .where(and(
        eq(matchParticipants.playerId, playerId), eq(matches.status, 'completed'),
        isNotNull(matches.scoreA), isNotNull(matches.scoreB),
      ))
      .orderBy(sql`ABS(${matches.scoreA} - ${matches.scoreB}) ASC`, desc(matches.scheduledAt))
      .limit(1),
  ])

  const adminIds = (process.env.ADMIN_USER_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean)
  const publicFields = filteredPublicProfile(row, { isOwner: true, sharesActiveGroup: true, sharesConfirmedMatch: true })
  return PrivatePlayerProfileSchema.parse({
    ...publicFields,
    isOwner: true,
    isAdmin: adminIds.includes(clerkUserId),
    visibility: row.visibility,
    ratingSampleCount: row.ratingAggregate.sampleCount,
    trust: {
      reliability: row.trust.reliability,
      fairPlay: row.trust.fairPlay,
      sampleCount: row.trust.sampleCount,
    },
    ovrHistory: history.map((event) => {
      const previous = Number(event.oldOvr ?? event.newOvr)
      const current = Number(event.newOvr)
      return {
        date: event.createdAt.toISOString().slice(0, 10),
        ovrScore: Math.round(current),
        direction: current > previous ? 'up' : current < previous ? 'down' : 'stable',
        matchId: event.matchId,
        category: 'match_update' as const,
      }
    }),
    bankroll: { balance: row.pronosBalance, startingBalance: PRONOS_STARTING_BANKROLL },
    memory: {
      tightestMatch: tightestMatch && tightestMatch.scoreA !== null && tightestMatch.scoreB !== null
        ? {
            scheduledAt: tightestMatch.scheduledAt.toISOString(),
            scoreA: tightestMatch.scoreA,
            scoreB: tightestMatch.scoreB,
          }
        : null,
    },
  })
}

async function updateVisibility(userId: string, visibility: ProfileFieldVisibility) {
  const normalized = normalizeProfileFieldVisibility(visibility)
  const [updated] = await db.update(users).set({ profileFieldVisibility: normalized }).where(eq(users.id, userId))
    .returning({ profileFieldVisibility: users.profileFieldVisibility })
  return updated ? normalizeProfileFieldVisibility(updated.profileFieldVisibility) : null
}

export const playerProfileService = { getPrivateProfile, getPublicProfile, updateVisibility }
