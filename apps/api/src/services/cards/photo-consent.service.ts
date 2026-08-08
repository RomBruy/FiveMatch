import { and, desc, eq, isNull, isNotNull, inArray } from 'drizzle-orm'
import {
  PHOTO_CONSENT_POLICY_VERSION,
  PHOTO_PROCESSING_PURPOSE,
  PHOTO_RETENTION_DAYS_AFTER_WITHDRAWAL,
} from '@fivematch/types'
import { db, type Db } from '../../db'
import { cardPhotoJobs, photoConsents, players } from '../../db/schema'
import { createObjectStorageFromEnv } from '../../lib/object-storage'
import { logger } from '../../lib/logger'

type Transaction = Parameters<Parameters<Db['transaction']>[0]>[0]

export type ConsentState = {
  granted: boolean
  /** True only when granted, not withdrawn, and on the current policy version. */
  current: boolean
  policyVersion: string | null
  purpose: string | null
  retentionDays: number | null
  grantedAt: string | null
  withdrawnAt: string | null
  /** What the player would be agreeing to if they granted now. */
  currentPolicyVersion: string
}

async function latestConsent(playerId: string) {
  const [row] = await db
    .select()
    .from(photoConsents)
    .where(eq(photoConsents.playerId, playerId))
    .orderBy(desc(photoConsents.grantedAt))
    .limit(1)
  return row
}

/**
 * Consent must be explicit AND current (rule 35).
 *
 * A consent given under an older policy version is not current: the player
 * agreed to different terms. They are asked again rather than silently carried
 * forward, which is the entire reason the version is stored.
 */
export function isCurrentConsent(consent: {
  policyVersion: string
  withdrawnAt: Date | null
} | undefined): boolean {
  if (!consent) return false
  if (consent.withdrawnAt !== null) return false
  return consent.policyVersion === PHOTO_CONSENT_POLICY_VERSION
}

async function getState(playerId: string): Promise<ConsentState> {
  const consent = await latestConsent(playerId)
  return {
    granted: Boolean(consent) && consent!.withdrawnAt === null,
    current: isCurrentConsent(consent),
    policyVersion: consent?.policyVersion ?? null,
    purpose: consent?.purpose ?? null,
    retentionDays: consent?.retentionDays ?? null,
    grantedAt: consent?.grantedAt.toISOString() ?? null,
    withdrawnAt: consent?.withdrawnAt?.toISOString() ?? null,
    currentPolicyVersion: PHOTO_CONSENT_POLICY_VERSION,
  }
}

/**
 * Record a new consent. Always an insert, never an update — a grant after a
 * withdrawal is a separate fact, and overwriting would erase that the player
 * once said no.
 */
async function grant(playerId: string): Promise<ConsentState> {
  await db.insert(photoConsents).values({
    playerId,
    policyVersion: PHOTO_CONSENT_POLICY_VERSION,
    purpose: PHOTO_PROCESSING_PURPOSE,
    retentionDays: PHOTO_RETENTION_DAYS_AFTER_WITHDRAWAL,
  })

  // Mirrored onto the player row so existing consent checks keep working; the
  // consent table is the record of truth.
  await db.update(players).set({ photoConsentGiven: true }).where(eq(players.id, playerId))

  return getState(playerId)
}

/**
 * Collect the storage keys for a player's generated photos, so they can be
 * erased from the bucket rather than merely unlinked in the database.
 */
async function generatedStorageKeys(tx: Transaction, playerIds: string[]): Promise<string[]> {
  if (playerIds.length === 0) return []
  const rows = await tx
    .select({ storageKey: cardPhotoJobs.storageKey })
    .from(cardPhotoJobs)
    .where(and(
      inArray(cardPhotoJobs.playerId, playerIds),
      isNotNull(cardPhotoJobs.storageKey),
    ))
  return rows.map((row) => row.storageKey).filter((key): key is string => key !== null)
}

/**
 * Erase objects from the bucket. Failures are logged, never thrown: a storage
 * outage must not block a withdrawal or a GDPR purge. The database record of
 * what should be gone is what the next sweep would work from.
 */
async function deleteStoredObjects(keys: string[]): Promise<number> {
  if (keys.length === 0) return 0
  try {
    const storage = createObjectStorageFromEnv()
    return await storage.deleteMany(keys)
  } catch (err) {
    logger.error({ err, keyCount: keys.length }, 'failed to delete generated photo objects')
    return 0
  }
}

/**
 * Withdraw consent and destroy what was generated under it (rule 37).
 *
 * Withdrawal is not just a flag flip: the images exist because consent existed,
 * so removing the consent has to remove them too — from the bucket, not only
 * from the database.
 */
async function withdraw(playerId: string): Promise<{ state: ConsentState; deletedObjects: number }> {
  const keys = await db.transaction(async (tx) => {
    const storageKeys = await generatedStorageKeys(tx, [playerId])

    await tx
      .update(photoConsents)
      .set({ withdrawnAt: new Date() })
      .where(and(eq(photoConsents.playerId, playerId), isNull(photoConsents.withdrawnAt)))

    await tx.delete(cardPhotoJobs).where(eq(cardPhotoJobs.playerId, playerId))

    await tx
      .update(players)
      .set({ photoConsentGiven: false, profilePhotoCardUrl: null })
      .where(eq(players.id, playerId))

    return storageKeys
  })

  const deletedObjects = await deleteStoredObjects(keys)
  return { state: await getState(playerId), deletedObjects }
}

/**
 * Delete generated photos while keeping consent. "I dislike this portrait" is a
 * different request from "stop processing my face", and collapsing the two would
 * make the player re-consent to undo a bad generation.
 */
async function deleteGeneratedPhotos(playerId: string): Promise<{ deletedObjects: number }> {
  const keys = await db.transaction(async (tx) => {
    const storageKeys = await generatedStorageKeys(tx, [playerId])
    await tx.delete(cardPhotoJobs).where(eq(cardPhotoJobs.playerId, playerId))
    await tx.update(players).set({ profilePhotoCardUrl: null }).where(eq(players.id, playerId))
    return storageKeys
  })

  return { deletedObjects: await deleteStoredObjects(keys) }
}

export const photoConsentService = {
  getState,
  grant,
  withdraw,
  deleteGeneratedPhotos,
  isCurrentConsent,
  generatedStorageKeys,
  deleteStoredObjects,
}
