import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { asyncHandler } from '../../middleware/async-handler'
import { db } from '../../db'
import { users } from '../../db/schema'
import { syncUserSchema } from './schemas'

const router = Router()

// POST /v1/auth/sync — idempotent upsert; safe to call on every sign-in
router.post('/sync', asyncHandler(async (req, res) => {
  const body = syncUserSchema.parse(req.body)
  const { userId } = req.user

  const [user] = await db
    .insert(users)
    .values({
      clerkUserId: userId,
      name: body.name ?? null,
      email: body.email,
      profilePhotoUrl: body.profilePhotoUrl ?? null,
      languagePreference: body.languagePreference,
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        name: body.name ?? null,
        email: body.email,
        profilePhotoUrl: body.profilePhotoUrl ?? null,
        languagePreference: body.languagePreference,
      },
    })
    .returning()

  res.json({
    data: {
      userId: user.id,
      name: user.name,
      email: user.email,
      languagePreference: user.languagePreference,
      profilePhotoUrl: user.profilePhotoUrl,
    },
  })
}))

// GET /v1/auth/me
router.get('/me', asyncHandler(async (req, res) => {
  const { userId } = req.user
  const [user] = await db.select().from(users).where(eq(users.clerkUserId, userId)).limit(1)

  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found', statusCode: 404 } })
    return
  }

  const adminIds = (process.env.ADMIN_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  const isAdmin = adminIds.length > 0 && adminIds.includes(userId)

  res.json({
    data: {
      userId: user.id,
      name: user.name,
      email: user.email,
      languagePreference: user.languagePreference,
      profilePhotoUrl: user.profilePhotoUrl,
      isAdmin,
    },
  })
}))

export default router
