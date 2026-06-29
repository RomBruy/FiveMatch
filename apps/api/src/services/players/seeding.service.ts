import { eq } from 'drizzle-orm'
import { db } from '../../db'
import { rawInitialSeedRatings, ratingEvents, players } from '../../db/schema'
import {
  TARGET_SEED_WEIGHT,
  ORGANIZER_SEED_WEIGHT,
  SEED_PRIOR_OVR_FALLBACK,
  SEED_SINGLE_RATER_AGREEMENT_FACTOR,
} from '@fivematch/types/algorithm-constants'
import type { InitialSeedBreakdown } from '@fivematch/types'

export type SeedInput = {
  playerId: string
  groupId: string
  organizerRating: number | null
  organizerUserId: string | null   // null when organizerRating is null
  peerRatings: { raterUserId: string; rating: number }[]
  groupMedianUnlockedOvr: number | null
}

export type SeedContext = {
  priorOvr: number
  observedWeight: number
  priorWeight: number
  totalWeight: number
  rawWeightedMean: number
  seededOvr: number
  seedStatus: 'PROVISIONAL' | 'CONFIDENT'
  seedRatingStdDev: number | null
  countFactor: number
  agreementFactor: number
  seedConfidence: number
}

function computeStdDevOneTenScale(ovrScaleValues: number[]): number | null {
  if (ovrScaleValues.length < 2) return null
  // Convert to 1-10 scale for stdDev computation (thresholds 0.75 and 2.50 are on 1-10 scale)
  const scaled = ovrScaleValues.map((v) => v / 10)
  const mean = scaled.reduce((s, v) => s + v, 0) / scaled.length
  const variance = scaled.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scaled.length
  return Math.sqrt(variance)
}

function computeAgreementFactor(stdDev: number | null, totalRaterCount: number): number {
  if (totalRaterCount <= 1) return SEED_SINGLE_RATER_AGREEMENT_FACTOR
  if (stdDev === null) return SEED_SINGLE_RATER_AGREEMENT_FACTOR
  if (stdDev <= 0.75) return 1.00
  if (stdDev >= 2.50) return 0.60
  return 1.00 - 0.40 * (stdDev - 0.75) / (2.50 - 0.75)
}

export function buildSeedContext(params: SeedInput): SeedContext {
  const priorOvr = params.groupMedianUnlockedOvr ?? SEED_PRIOR_OVR_FALLBACK

  const organizerWeight = params.organizerRating !== null ? ORGANIZER_SEED_WEIGHT : 0
  const peerWeight = params.peerRatings.length
  const observedWeight = organizerWeight + peerWeight
  const priorWeight = Math.max(0, TARGET_SEED_WEIGHT - observedWeight)
  const totalWeight = observedWeight + priorWeight

  const observedWeightedSum =
    (params.organizerRating !== null ? params.organizerRating * ORGANIZER_SEED_WEIGHT : 0) +
    params.peerRatings.reduce((s, p) => s + p.rating, 0)

  const rawWeightedMean = observedWeight > 0 ? observedWeightedSum / observedWeight : priorOvr
  const seededOvr = (observedWeightedSum + priorOvr * priorWeight) / totalWeight

  const seedStatus: 'PROVISIONAL' | 'CONFIDENT' = observedWeight < TARGET_SEED_WEIGHT ? 'PROVISIONAL' : 'CONFIDENT'

  const allRatingValues = [
    ...(params.organizerRating !== null ? [params.organizerRating] : []),
    ...params.peerRatings.map((p) => p.rating),
  ]
  const totalRaterCount = allRatingValues.length
  const seedRatingStdDev = computeStdDevOneTenScale(allRatingValues)
  const countFactor = Math.min(1, observedWeight / TARGET_SEED_WEIGHT)
  const agreementFactor = computeAgreementFactor(seedRatingStdDev, totalRaterCount)
  const seedConfidence = countFactor * agreementFactor

  return {
    priorOvr,
    observedWeight,
    priorWeight,
    totalWeight,
    rawWeightedMean,
    seededOvr,
    seedStatus,
    seedRatingStdDev,
    countFactor,
    agreementFactor,
    seedConfidence,
  }
}

async function computeInitialSeed(
  params: SeedInput,
): Promise<{ seededOvr: number; seedStatus: 'PROVISIONAL' | 'CONFIDENT' }> {
  const ctx = buildSeedContext(params)

  const ratingRowsToInsert: (typeof rawInitialSeedRatings.$inferInsert)[] = [
    ...(params.organizerRating !== null
      ? [{
          playerId: params.playerId,
          raterUserId: params.organizerUserId,
          rating: params.organizerRating,
          sourceType: 'ORGANIZER' as const,
          weight: ORGANIZER_SEED_WEIGHT,
        }]
      : []),
    ...params.peerRatings.map((p) => ({
      playerId: params.playerId,
      raterUserId: p.raterUserId,
      rating: p.rating,
      sourceType: 'PEER' as const,
      weight: 1,
    })),
  ]

  return await db.transaction(async (tx) => {
    const insertedRawRatings = await tx
      .insert(rawInitialSeedRatings)
      .values(ratingRowsToInsert)
      .returning({
        id: rawInitialSeedRatings.id,
        sourceType: rawInitialSeedRatings.sourceType,
        rating: rawInitialSeedRatings.rating,
        weight: rawInitialSeedRatings.weight,
      })

    const breakdown: InitialSeedBreakdown = {
      method: 'WEIGHTED_AVERAGE_WITH_PRIOR',
      priorOvr: ctx.priorOvr,
      priorWeight: ctx.priorWeight,
      observedWeight: ctx.observedWeight,
      totalWeight: ctx.totalWeight,
      organizerRatingIncluded: params.organizerRating !== null,
      organizerWeight: ORGANIZER_SEED_WEIGHT,
      seedRatings: insertedRawRatings.map((r) => ({
        ratingRef: r.id,                              // NOT raterUserId
        sourceType: r.sourceType as 'ORGANIZER' | 'PEER',
        rating: Number(r.rating),
        weight: r.weight,
      })),
      rawWeightedMean: ctx.rawWeightedMean,
      seededOvr: ctx.seededOvr,
      seedRatingStdDev: ctx.seedRatingStdDev,
      seedConfidence: ctx.seedConfidence,
      seedStatus: ctx.seedStatus,
    }

    await tx.insert(ratingEvents).values({
      playerId: params.playerId,
      eventType: 'INITIAL_SEED',
      oldOvr: null,
      newOvr: String(ctx.seededOvr),
      seedStatus: ctx.seedStatus,
      breakdown,
    })

    await tx
      .update(players)
      .set({ ovrScoreFloat: String(ctx.seededOvr) })
      .where(eq(players.id, params.playerId))

    return { seededOvr: ctx.seededOvr, seedStatus: ctx.seedStatus }
  })
}

export const seedingService = {
  computeInitialSeed,
}
