import { Router } from 'express'
import { eq, and, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { asyncHandler } from '../../middleware/async-handler'
import { db } from '../../db'
import { groupMemberships, groups, users, pushTokens, notificationPreferences, NOTIFICATION_TYPES } from '../../db/schema'
import { updateNotificationPreferenceSchema } from './schemas'

const router = Router()

const registerPushTokenSchema = z.object({
  token: z.string().min(1),
})

// GET /v1/users/me/groups — list all groups the authenticated user belongs to (not pending)
router.get(
  '/me/groups',
  asyncHandler(async (req, res) => {
    const clerkUserId = req.user.userId
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.clerkUserId, clerkUserId))
    if (!user) {
      return res.json({ data: { items: [] } })
    }

    const memberships = await db
      .select({ group: groups, role: groupMemberships.role })
      .from(groupMemberships)
      .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
      .where(
        and(
          eq(groupMemberships.userId, user.id),
          inArray(groupMemberships.role, ['member', 'organizer']),
        ),
      )

    return res.json({
      data: {
        items: memberships.map((m) => ({ ...m.group, userRole: m.role })),
      },
    })
  }),
)

// POST /v1/users/me/push-token — store or upsert push token for current user
router.post(
  '/me/push-token',
  asyncHandler(async (req, res) => {
    const { token } = registerPushTokenSchema.parse(req.body)
    const clerkUserId = req.user.userId

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1)

    if (!user) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found', statusCode: 404 },
      })
    }

    await db
      .insert(pushTokens)
      .values({ userId: user.id, token, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [pushTokens.userId, pushTokens.token],
        set: { updatedAt: new Date() },
      })

    return res.json({ data: { registered: true } })
  }),
)

// GET /v1/users/me/notification-preferences
router.get(
  '/me/notification-preferences',
  asyncHandler(async (req, res) => {
    const clerkUserId = req.user.userId
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1)

    if (!user) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found', statusCode: 404 },
      })
    }

    const stored = await db
      .select({ type: notificationPreferences.type, enabled: notificationPreferences.enabled })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, user.id))

    const storedMap = new Map(stored.map((p) => [p.type, p.enabled]))

    const preferences = NOTIFICATION_TYPES.map((type) => ({
      type,
      enabled: storedMap.has(type) ? storedMap.get(type) : true,
    }))

    return res.json({ data: { preferences } })
  }),
)

// PATCH /v1/users/me/notification-preferences
router.patch(
  '/me/notification-preferences',
  asyncHandler(async (req, res) => {
    const { type, enabled } = updateNotificationPreferenceSchema.parse(req.body)
    const clerkUserId = req.user.userId

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkUserId, clerkUserId))
      .limit(1)

    if (!user) {
      return res.status(404).json({
        error: { code: 'USER_NOT_FOUND', message: 'User not found', statusCode: 404 },
      })
    }

    await db
      .insert(notificationPreferences)
      .values({ userId: user.id, type, enabled, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: [notificationPreferences.userId, notificationPreferences.type],
        set: { enabled, updatedAt: new Date() },
      })

    return res.json({ data: { type, enabled } })
  }),
)

export default router
