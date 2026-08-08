import { randomUUID } from 'crypto'
import { and, eq, inArray, isNull, or } from 'drizzle-orm'
import { db } from '../../db'
import { photoConsentService } from '../cards/photo-consent.service'
import { behaviourReports, cardPhotoJobs, photoConsents, groupMemberships, matchParticipants, players, pronoBets, pronos, ratings, rawInitialSeedRatings, teamGenerationPlayers, users } from '../../db/schema'

// Anonymize all match_participants rows for a deleted user.
// userId and playerId are set to null; displayName is replaced with a random placeholder
// so historical match statistics (goals, assists) are preserved without PII.
async function anonymizeMatchParticipants(userId: string): Promise<void> {
  const rows = await db
    .select({ id: matchParticipants.id })
    .from(matchParticipants)
    .where(eq(matchParticipants.userId, userId))

  for (const row of rows) {
    const anonName = `Joueur_${randomUUID().slice(0, 8).toUpperCase()}`
    await db
      .update(matchParticipants)
      .set({ userId: null, playerId: null, displayName: anonName })
      .where(eq(matchParticipants.id, row.id))
  }
}

// Hard-delete all ratings submitted by or given to the deleted user.
// ratings.raterPlayerId is already nullable (anonymization-ready).
// ratings where ratedPlayerId links to a deleted player are hard-deleted per GDPR.
async function deleteUserRatings(userId: string): Promise<void> {
  // Find the player IDs linked to this user (may span multiple groups)
  const userPlayers = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.userId, userId))

  for (const player of userPlayers) {
    // Hard-delete all ratings WHERE this player was the rated subject
    await db
      .delete(ratings)
      .where(eq(ratings.ratedPlayerId, player.id))
  }
}

// Anonymize seed ratings by setting raterUserId to null — preserves the rating value and ratingRef
// for audit integrity; only erases the identity of who gave the rating.
async function anonymizeSeedRatings(raterUserId: string): Promise<void> {
  await db
    .update(rawInitialSeedRatings)
    .set({ raterUserId: null })
    .where(eq(rawInitialSeedRatings.raterUserId, raterUserId))
}

// Soft-delete a user by setting deletedAt — triggered by Clerk user.deleted webhook.
// Idempotent: if the user does not exist, returns without error.
// The 30-day purge window starts from this timestamp (GdprPurgeJob uses it).
async function softDeleteUser(clerkUserId: string): Promise<void> {
  await db
    .update(users)
    .set({ deletedAt: new Date() })
    .where(eq(users.clerkUserId, clerkUserId))
}

// Soft-delete all group_memberships for a deleted user.
// Sets deletedAt on every active membership row — the 30-day purge job uses this
// to know which group_memberships to exclude from active member queries.
// Idempotent: rows where deletedAt is already set are not touched.
async function softDeleteGroupMemberships(userId: string): Promise<void> {
  await db
    .update(groupMemberships)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(groupMemberships.userId, userId),
        isNull(groupMemberships.deletedAt),
      ),
    )
}

// Atomically purge all data for a user after the 30-day retention window.
// Wraps every write in a single transaction so a mid-run crash cannot leave
// the user in a partially-anonymized state.
async function purgeUser(userId: string, purgedAt: Date): Promise<void> {
  const userPlayers = await db
    .select({ id: players.id })
    .from(players)
    .where(eq(players.userId, userId))

  const playerIds = userPlayers.map((p) => p.id)

  // Collected before the rows are deleted, or the keys go with them and the
  // images stay in the bucket forever — which is exactly what happened before
  // Phase 5 (rule 38).
  const storageKeys = playerIds.length > 0
    ? await photoConsentService.generatedStorageKeys(db as never, playerIds)
    : []

  await db.transaction(async (tx) => {
    // Anonymize match_participants — preserve stats, erase identity
    const participantRows = await tx
      .select({ id: matchParticipants.id })
      .from(matchParticipants)
      .where(eq(matchParticipants.userId, userId))
    for (const row of participantRows) {
      const anonName = `Joueur_${randomUUID().slice(0, 8).toUpperCase()}`
      await tx
        .update(matchParticipants)
        .set({ userId: null, playerId: null, displayName: anonName })
        .where(eq(matchParticipants.id, row.id))
    }

    if (playerIds.length > 0) {
      // Hard-delete all ratings (as rater or rated)
      await tx.delete(ratings).where(
        or(
          inArray(ratings.ratedPlayerId, playerIds),
          inArray(ratings.raterPlayerId, playerIds),
        ),
      )

      // Hard-delete team generation and card job rows
      await tx.delete(teamGenerationPlayers).where(inArray(teamGenerationPlayers.playerId, playerIds))
      await tx.delete(cardPhotoJobs).where(inArray(cardPhotoJobs.playerId, playerIds))

      // Consent records go with the person. Keeping proof that someone once
      // agreed to face processing, after erasing the person, would preserve the
      // thing the erasure was about.
      await tx.delete(photoConsents).where(inArray(photoConsents.playerId, playerIds))

      // Hard-delete Pronos bets — a wager carries no group-statistical value once its
      // owner is gone, so there is nothing to preserve by anonymizing (unlike match stats).
      await tx.delete(pronoBets).where(inArray(pronoBets.playerId, playerIds))

      // Hard-delete legacy flat-Pronos predictions. The table is retired (Story 11.7) but
      // deliberately retained rather than dropped, so its rows are still personal data and
      // an erasure request must reach them. Archiving is not an exemption.
      await tx.delete(pronos).where(inArray(pronos.playerId, playerIds))

      // Behaviour reports ABOUT this user are hard-deleted. A record of someone's
      // conduct has no value once that person is gone, and it is pure personal
      // data about them — there is nothing here worth preserving.
      await tx.delete(behaviourReports).where(inArray(behaviourReports.subjectPlayerId, playerIds))

      // Reports BY this user survive, detached. The subject's standing was built
      // from them and erasing one person must not silently rewrite another's
      // record — but the reporter's identity and their own words both go.
      // A detached row also stops counting toward corroboration, which is right:
      // an erased account should not keep vouching for anything.
      await tx
        .update(behaviourReports)
        .set({ reporterPlayerId: null, detail: null })
        .where(inArray(behaviourReports.reporterPlayerId, playerIds))

      await tx
        .update(behaviourReports)
        .set({ validatorPlayerId: null })
        .where(inArray(behaviourReports.validatorPlayerId, playerIds))
    }

    // Anonymize seed ratings (erase who gave the rating, keep the value)
    await tx
      .update(rawInitialSeedRatings)
      .set({ raterUserId: null })
      .where(eq(rawInitialSeedRatings.raterUserId, userId))

    // Soft-delete group memberships
    await tx
      .update(groupMemberships)
      .set({ deletedAt: new Date() })
      .where(and(eq(groupMemberships.userId, userId), isNull(groupMemberships.deletedAt)))

    // Mark purge complete — prevents reprocessing on next job run
    await tx
      .update(users)
      .set({ purgedAt })
      .where(eq(users.id, userId))
  })

  // After the transaction commits. A storage outage must not roll back an
  // erasure that has otherwise succeeded; the failure is logged and the objects
  // remain listed nowhere, so a later sweep is the remedy rather than a retry
  // that would have to redo the whole purge.
  await photoConsentService.deleteStoredObjects(storageKeys)
}

export const gdprService = {
  anonymizeMatchParticipants,
  deleteUserRatings,
  anonymizeSeedRatings,
  softDeleteUser,
  softDeleteGroupMemberships,
  purgeUser,
}
