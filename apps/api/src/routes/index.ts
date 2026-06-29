import { Router } from 'express'
import { requireAuth } from '@clerk/express'
import { attachUser } from '../middleware/auth'
import { asyncHandler } from '../middleware/async-handler'
import { db } from '../db'
import { groups, users, groupMemberships } from '../db/schema'
import { eq, and, inArray, isNull, count } from 'drizzle-orm'
import { ErrorCode } from '@fivematch/types'
import authRouter from './auth'
import groupsRouter from './groups'
import usersRouter from './users'
import playersRouter from './players'
import ratingsRouter from './ratings'
import generationRouter from './generation'
import matchesRouter from './matches'
import cardsRouter from './cards'
import pronosRouter from './pronos'
import adminRouter from './admin'

const router = Router()

// Public — no auth required
router.get('/health', (_req, res) => res.json({ status: 'ok' }))

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
      inArray(groupMemberships.role, ['member', 'organizer']),
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

router.use('/auth', authRouter)
router.use('/groups', groupsRouter)
router.use('/groups/:groupId/players', playersRouter)
router.use('/groups/:groupId/ratings', ratingsRouter)
router.use('/groups/:groupId/team-generator', generationRouter)
router.use('/groups/:groupId/matches', matchesRouter)
router.use('/groups/:groupId/players/:playerId/card-photo', cardsRouter)
router.use('/groups/:groupId/matches/:matchId/pronos', pronosRouter)
router.use('/users', usersRouter)
router.use('/admin', adminRouter)

export default router
