import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { asyncHandler } from '../../middleware/async-handler'
import { db } from '../../db'
import { users } from '../../db/schema'
import { syncUserSchema, updateProfileSchema } from './schemas'

const router = Router()

// POST /v1/auth/sync — idempotent upsert; safe to call on every sign-in
router.post('/sync', asyncHandler(async (req, res) => {
  const body = syncUserSchema.parse(req.body)
  const { userId } = req.user

  // A returning sign-in often has no display name in its payload. Only update
  // optional profile fields when a real value was provided, otherwise a sign-in
  // would erase an already completed profile.
  const conflictSet: {
    email: string
    name?: string
    profilePhotoUrl?: string | null
  } = {
    email: body.email,
  }
  if (body.name) conflictSet.name = body.name
  if (body.profilePhotoUrl !== undefined) conflictSet.profilePhotoUrl = body.profilePhotoUrl

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
      set: conflictSet,
    })
    .returning()

  res.json({
    data: {
      userId: user.id,
      name: user.name,
      email: user.email,
      languagePreference: user.languagePreference,
      profilePhotoUrl: user.profilePhotoUrl,
      currentClub: user.currentClub,
      formerClub: user.formerClub,
      preferredPosition: user.preferredPosition,
      strongFoot: user.strongFoot,
      playerStyle: user.playerStyle,
      specialSkill: user.specialSkill,
      favoriteExcuse: user.favoriteExcuse,
      badFaithLevel: user.badFaithLevel,
      lockerRoomStyle: user.lockerRoomStyle,
      thirdHalfProfile: user.thirdHalfProfile,
      onboardingCompletedAt: user.onboardingCompletedAt,
    },
  })
}))

// PATCH /v1/auth/me — finish or edit the app-level player profile
router.patch('/me', asyncHandler(async (req, res) => {
  const body = updateProfileSchema.parse(req.body)
  const { userId } = req.user

  const [user] = await db
    .update(users)
    .set({
      name: body.name,
      languagePreference: body.languagePreference,
      profilePhotoUrl: body.profilePhotoUrl,
      currentClub: body.currentClub,
      formerClub: body.formerClub,
      preferredPosition: body.preferredPosition,
      strongFoot: body.strongFoot,
      playerStyle: body.playerStyle,
      specialSkill: body.specialSkill,
      favoriteExcuse: body.favoriteExcuse,
      badFaithLevel: body.badFaithLevel,
      lockerRoomStyle: body.lockerRoomStyle,
      thirdHalfProfile: body.thirdHalfProfile,
      onboardingCompletedAt: new Date(),
    })
    .where(eq(users.clerkUserId, userId))
    .returning()

  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found', statusCode: 404 } })
    return
  }

  res.json({
    data: {
      userId: user.id,
      name: user.name,
      email: user.email,
      languagePreference: user.languagePreference,
      profilePhotoUrl: user.profilePhotoUrl,
      currentClub: user.currentClub,
      formerClub: user.formerClub,
      preferredPosition: user.preferredPosition,
      strongFoot: user.strongFoot,
      playerStyle: user.playerStyle,
      specialSkill: user.specialSkill,
      favoriteExcuse: user.favoriteExcuse,
      badFaithLevel: user.badFaithLevel,
      lockerRoomStyle: user.lockerRoomStyle,
      thirdHalfProfile: user.thirdHalfProfile,
      onboardingCompletedAt: user.onboardingCompletedAt,
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
      currentClub: user.currentClub,
      formerClub: user.formerClub,
      preferredPosition: user.preferredPosition,
      strongFoot: user.strongFoot,
      playerStyle: user.playerStyle,
      specialSkill: user.specialSkill,
      favoriteExcuse: user.favoriteExcuse,
      badFaithLevel: user.badFaithLevel,
      lockerRoomStyle: user.lockerRoomStyle,
      thirdHalfProfile: user.thirdHalfProfile,
      onboardingCompletedAt: user.onboardingCompletedAt,
      isAdmin,
    },
  })
}))

export default router
