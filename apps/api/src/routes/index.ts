import { Router } from 'express'
import { requireAuth } from '@clerk/express'
import { attachUser } from '../middleware/auth'
import { attachPlayer } from '../middleware/match-context'
import { asyncHandler } from '../middleware/async-handler'
import { db } from '../db'
import { ACTIVE_CREW_ROLES, groups, users, groupMemberships, matches, players, matchCapacity } from '../db/schema'
import { eq, and, inArray, isNull, count, sql } from 'drizzle-orm'
import { ErrorCode, PublicMatchPreviewSchema } from '@fivematch/types'
import authRouter from './auth'
import groupsRouter from './groups'
import usersRouter from './users'
import playersRouter from './players'
import ratingsRouter from './ratings'
import matchesRouter from './matches'
import cardsRouter from './cards'
import pronosRouter from './pronos'
import adminRouter from './admin'

const router = Router()

// Public — no auth required
router.get('/health', (_req, res) => res.json({ status: 'ok' }))

/**
 * Public preview of an open match. This is the acquisition surface: a host
 * pastes the link into WhatsApp and anyone can see what the game is before
 * installing. Deliberately thin — no player list, no ids beyond the match.
 */
router.get('/matches/:matchId/preview', asyncHandler(async (req, res) => {
  const matchId = req.params['matchId'] as string

  const [match] = await db
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
      visibility: matches.visibility,
      openSpots: matches.openSpots,
      hostId: matches.hostId,
      status: matches.status,
      confirmedCount: sql<number>`(
        SELECT COUNT(*)::int FROM match_attendances ma
        WHERE ma.match_id = ${matches.id} AND ma.status = 'in' AND ma.waitlist_position IS NULL
      )`,
      openConfirmedCount: sql<number>`(
        SELECT COUNT(*)::int FROM match_attendances ma
        WHERE ma.match_id = ${matches.id} AND ma.status = 'in'
          AND ma.waitlist_position IS NULL AND ma.source = 'open'
      )`,
    })
    .from(matches)
    .where(eq(matches.id, matchId))

  if (!match || match.visibility !== 'public') {
    return res.status(404).json({
      error: { code: ErrorCode.MATCH_NOT_FOUND, message: 'Match not found', statusCode: 404 },
    })
  }

  const [host] = await db
    .select({ displayName: players.displayName })
    .from(players)
    .where(eq(players.userId, match.hostId))

  const capacity = matchCapacity(match.playersPerTeam)
  const spotsRemaining = Math.max(0, Math.min(
    (match.openSpots ?? 0) - match.openConfirmedCount,
    capacity - match.confirmedCount,
  ))

  return res.json({
    data: PublicMatchPreviewSchema.parse({
      matchId: match.id,
      audience: 'public',
      scheduledAt: match.scheduledAt.toISOString(),
      durationMinutes: match.durationMinutes,
      city: match.city,
      format: match.format,
      skillLevel: match.skillLevel,
      pricePerPlayer: match.pricePerPlayer !== null ? Number(match.pricePerPlayer) : null,
      currency: match.currency,
      status: match.status,
      publication: { isPublic: true },
      availability: {
        confirmedCount: match.confirmedCount,
        capacity,
        spotsRemaining,
        canJoin: match.status === 'attendance_open' && spotsRemaining > 0,
        canWaitlist: match.status === 'attendance_open' && spotsRemaining === 0,
      },
      host: { displayName: host?.displayName ?? null },
    }),
  })
}))

router.get('/invite/:code', asyncHandler(async (req, res) => {
  const code = req.params['code'] as string

  const [group] = await db.select({
    id: groups.id,
    name: groups.name,
    organizerId: groups.organizerId,
  }).from(groups).where(eq(groups.inviteCode, code))

  if (!group) {
    return res.status(404).json({
      error: { code: ErrorCode.INVITE_CODE_NOT_FOUND, message: 'Invite code not found', statusCode: 404 },
    })
  }

  const [organizer] = await db.select({ name: users.name }).from(users).where(eq(users.id, group.organizerId))

  const [{ value: memberCount }] = await db
    .select({ value: count() })
    .from(groupMemberships)
    .where(and(
      eq(groupMemberships.groupId, group.id),
      inArray(groupMemberships.role, [...ACTIVE_CREW_ROLES]),
      isNull(groupMemberships.deletedAt),
    ))

  return res.json({
    data: {
      groupId: group.id,
      groupName: group.name,
      organizerDisplayName: organizer?.name ?? 'Organizer',
      memberCount: Number(memberCount),
    },
  })
}))

router.use(requireAuth(), attachUser)

// /auth is where a brand-new account gets its player row, so it runs before
// attachPlayer — everything after it can rely on req.user.internalId/playerId.
router.use('/auth', authRouter)
router.use(attachPlayer)

// Matches, players and cards are top-level: identity and games are global now.
router.use('/matches', matchesRouter)
router.use('/matches/:matchId/pronos', pronosRouter)
router.use('/players', playersRouter)
router.use('/players/:playerId/card-photo', cardsRouter)

// Crews keep their own namespace — roster, invites, leaderboard, initial ratings.
router.use('/groups', groupsRouter)
router.use('/groups/:groupId/ratings', ratingsRouter)

router.use('/users', usersRouter)
router.use('/admin', adminRouter)

export default router
