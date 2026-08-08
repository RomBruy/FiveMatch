import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { PHOTO_CONSENT_POLICY_VERSION, PHOTO_PROCESSING_PURPOSE } from '@fivematch/types'
import { db } from '../../db'
import { cardPhotoJobs, photoConsents, players, users } from '../../db/schema'
import { photoConsentService } from '../../services/cards/photo-consent.service'
import { gdprService } from '../../services/gdpr/gdpr.service'
import { phase3Fixtures as fx, phase3SyntheticIdentity as identity } from '../fixtures/phase3-fixtures'

/**
 * Every object the storage layer was asked to delete, across a test. Phase 5's
 * central claim is that erasure reaches the bucket and not only the database,
 * so the assertions are about what deletion was actually asked to do.
 */
const deletedKeys: string[] = []
/** Flipped by the outage test; the mock storage then fails the way B2 would. */
let storageShouldFail = false

vi.mock('../../lib/object-storage', async () => {
  const actual = await vi.importActual<typeof import('../../lib/object-storage')>(
    '../../lib/object-storage',
  )
  return {
    ...actual,
    createObjectStorageFromEnv: () => ({
      publicUrl: (key: string) => `https://cdn.test/${key}`,
      put: async (key: string) => `https://cdn.test/${key}`,
      deleteMany: async (keys: string[]) => {
        if (storageShouldFail) throw new Error('storage unavailable')
        deletedKeys.push(...keys)
        return keys.length
      },
    }),
  }
})

const OWNER = fx.players.attended
const OWNER_USER = fx.users.attended
const ALL_USER_IDS = Object.values(fx.users)
const ALL_PLAYER_IDS = Object.values(fx.players)

async function cleanup() {
  await db.delete(photoConsents).where(inArray(photoConsents.playerId, ALL_PLAYER_IDS))
  await db.delete(cardPhotoJobs).where(inArray(cardPhotoJobs.playerId, ALL_PLAYER_IDS))
  await db.delete(players).where(inArray(players.id, ALL_PLAYER_IDS))
  await db.delete(users).where(inArray(users.id, ALL_USER_IDS))
}

async function seedIdentities() {
  const keys = Object.keys(fx.users) as Array<keyof typeof fx.users>
  await db.insert(users).values(keys.map((key) => ({
    id: fx.users[key], clerkUserId: identity.clerkId(`p5-${key}`), email: identity.email(`p5-${key}`),
  })))
  await db.insert(players).values(keys.map((key) => ({
    id: fx.players[key], userId: fx.users[key], displayName: identity.name(key), ovrScoreFloat: '65.000',
  })))
}

/** A completed generation, as the job would have left it. */
async function seedGeneratedPhoto(playerId: string, jobSuffix: string) {
  const storageKey = `card-photos/${jobSuffix}.png`
  const [job] = await db.insert(cardPhotoJobs).values({
    playerId,
    state: 'complete',
    idempotencyKey: `idem-${jobSuffix}`,
    generationMonth: '2099-01',
    photoUrl: `https://cdn.test/${storageKey}`,
    storageKey,
  }).returning()

  await db
    .update(players)
    .set({ profilePhotoCardUrl: `https://cdn.test/${storageKey}` })
    .where(eq(players.id, playerId))

  return { jobId: job.id, storageKey }
}

beforeEach(async () => {
  deletedKeys.length = 0
  storageShouldFail = false
  await cleanup()
  await seedIdentities()
})

afterEach(cleanup)

describe('Phase 5 photo consent lifecycle', () => {
  it('records what the player agreed to, not merely that they did', async () => {
    const state = await photoConsentService.grant(OWNER)

    // Rule 36: timestamp, policy version, purpose and retention, all stored.
    expect(state.granted).toBe(true)
    expect(state.current).toBe(true)
    expect(state.policyVersion).toBe(PHOTO_CONSENT_POLICY_VERSION)
    expect(state.purpose).toBe(PHOTO_PROCESSING_PURPOSE)
    expect(state.retentionDays).not.toBeNull()
    expect(state.grantedAt).not.toBeNull()
    expect(state.withdrawnAt).toBeNull()
  })

  it('treats consent under an older policy version as not current', async () => {
    await db.insert(photoConsents).values({
      playerId: OWNER,
      policyVersion: 'legacy_boolean',
      purpose: PHOTO_PROCESSING_PURPOSE,
      retentionDays: 0,
    })

    const state = await photoConsentService.getState(OWNER)

    // They agreed to different terms, so they are asked again rather than
    // silently carried forward (rule 35).
    expect(state.granted).toBe(true)
    expect(state.current).toBe(false)
  })

  it('reports no consent for a player who never gave any', async () => {
    const state = await photoConsentService.getState(OWNER)
    expect(state.granted).toBe(false)
    expect(state.current).toBe(false)
    expect(state.currentPolicyVersion).toBe(PHOTO_CONSENT_POLICY_VERSION)
  })

  it('destroys generated photos from storage when consent is withdrawn', async () => {
    await photoConsentService.grant(OWNER)
    const { storageKey } = await seedGeneratedPhoto(OWNER, 'withdraw')

    const result = await photoConsentService.withdraw(OWNER)

    // The images exist because the consent existed, so removing the consent has
    // to remove them — from the bucket, not only the database (rule 37).
    expect(deletedKeys).toContain(storageKey)
    expect(result.deletedObjects).toBe(1)
    expect(result.state.granted).toBe(false)
    expect(result.state.withdrawnAt).not.toBeNull()

    const [player] = await db
      .select({ url: players.profilePhotoCardUrl })
      .from(players)
      .where(eq(players.id, OWNER))
    expect(player?.url).toBeNull()

    const jobs = await db.select().from(cardPhotoJobs).where(eq(cardPhotoJobs.playerId, OWNER))
    expect(jobs).toHaveLength(0)
  })

  it('keeps the withdrawal on record rather than erasing that consent was given', async () => {
    await photoConsentService.grant(OWNER)
    await photoConsentService.withdraw(OWNER)

    const rows = await db.select().from(photoConsents).where(eq(photoConsents.playerId, OWNER))

    expect(rows).toHaveLength(1)
    expect(rows[0]?.grantedAt).not.toBeNull()
    expect(rows[0]?.withdrawnAt).not.toBeNull()
  })

  it('treats a fresh grant after withdrawal as a separate fact', async () => {
    await photoConsentService.grant(OWNER)
    await photoConsentService.withdraw(OWNER)
    const state = await photoConsentService.grant(OWNER)

    const rows = await db.select().from(photoConsents).where(eq(photoConsents.playerId, OWNER))

    // Overwriting would erase that the player once said no.
    expect(rows).toHaveLength(2)
    expect(state.current).toBe(true)
  })

  it('deletes generated photos without touching consent', async () => {
    await photoConsentService.grant(OWNER)
    const { storageKey } = await seedGeneratedPhoto(OWNER, 'delete-only')

    await photoConsentService.deleteGeneratedPhotos(OWNER)

    expect(deletedKeys).toContain(storageKey)
    // Disliking a portrait is not the same request as stopping face processing.
    const state = await photoConsentService.getState(OWNER)
    expect(state.current).toBe(true)
  })

  it('erases stored objects during a GDPR purge', async () => {
    await photoConsentService.grant(OWNER)
    const { storageKey } = await seedGeneratedPhoto(OWNER, 'gdpr')

    await gdprService.purgeUser(OWNER_USER, new Date())

    // Before Phase 5 the job rows were deleted and the images stayed in the
    // bucket indefinitely — the exact leftover an erasure request is about.
    expect(deletedKeys).toContain(storageKey)

    const consents = await db.select().from(photoConsents).where(eq(photoConsents.playerId, OWNER))
    expect(consents).toHaveLength(0)
  })

  it('does not touch another player photos when one withdraws', async () => {
    await photoConsentService.grant(OWNER)
    await photoConsentService.grant(fx.players.excused)
    await seedGeneratedPhoto(OWNER, 'mine')
    const other = await seedGeneratedPhoto(fx.players.excused, 'theirs')

    await photoConsentService.withdraw(OWNER)

    expect(deletedKeys).not.toContain(other.storageKey)
    const remaining = await db
      .select()
      .from(cardPhotoJobs)
      .where(eq(cardPhotoJobs.playerId, fx.players.excused))
    expect(remaining).toHaveLength(1)
  })

  it('survives a storage failure without blocking the withdrawal', async () => {
    await photoConsentService.grant(OWNER)
    await seedGeneratedPhoto(OWNER, 'storage-down')
    storageShouldFail = true

    const result = await photoConsentService.withdraw(OWNER)

    // A storage outage must not leave a player unable to withdraw consent. The
    // database side still completes and the failure is logged, not thrown.
    expect(result.state.granted).toBe(false)
    expect(result.state.withdrawnAt).not.toBeNull()
    expect(result.deletedObjects).toBe(0)

    const jobs = await db.select().from(cardPhotoJobs).where(eq(cardPhotoJobs.playerId, OWNER))
    expect(jobs).toHaveLength(0)
  })
})
