import { Router } from 'express'
import { eq } from 'drizzle-orm'
import { asyncHandler } from '../../middleware/async-handler'
import { db } from '../../db'
import { users, players } from '../../db/schema'
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

  // Optional fields are only written when present, so the short onboarding path
  // and a later "spice up your card" pass can both PATCH here without one
  // clearing what the other set.
  const optional = <T>(value: T | undefined) => (value === undefined ? undefined : value)

  const [user] = await db
    .update(users)
    .set({
      name: body.name,
      languagePreference: body.languagePreference,
      preferredPosition: body.preferredPosition,
      profilePhotoUrl: optional(body.profilePhotoUrl),
      currentClub: optional(body.currentClub),
      formerClub: optional(body.formerClub),
      strongFoot: optional(body.strongFoot),
      playerStyle: optional(body.playerStyle),
      specialSkill: optional(body.specialSkill),
      favoriteExcuse: optional(body.favoriteExcuse),
      badFaithLevel: optional(body.badFaithLevel),
      lockerRoomStyle: optional(body.lockerRoomStyle),
      thirdHalfProfile: optional(body.thirdHalfProfile),
      onboardingCompletedAt: new Date(),
    })
    .where(eq(users.clerkUserId, userId))
    .returning()

  if (!user) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found', statusCode: 404 } })
    return
  }

  // The global player identity is created here, at the end of onboarding —
  // it is what everything downstream (attendance, OVR, bankroll) keys off, and
  // it must exist before the user can join anything.
  await db
    .insert(players)
    .values({
      userId: user.id,
      displayName: user.name ?? 'Player',
      skillLevel: body.skillLevel,
    })
    .onConflictDoUpdate({
      target: players.userId,
      set: { displayName: user.name ?? 'Player', skillLevel: body.skillLevel },
    })

  res.json({
    data: {
      userId: user.id,
      skillLevel: body.skillLevel,
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

  // Level lives on the player row, but onboarding and profile editing read it
  // from here alongside the rest of the identity.
  const [player] = await db
    .select({ skillLevel: players.skillLevel })
    .from(players)
    .where(eq(players.userId, user.id))
    .limit(1)

  res.json({
    data: {
      userId: user.id,
      skillLevel: player?.skillLevel ?? null,
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
