import { eq, and, inArray, isNull } from 'drizzle-orm'
import { db } from '../../db'
import { matchParticipants, matches, ratings } from '../../db/schema'
import { ovrService } from '../players/ovr.service'
import { evaluateRatingCapability } from './rating-capability'

const RATING_WINDOW_MS = 48 * 60 * 60 * 1000 // 48 hours in milliseconds

type Clock = { now: () => Date; advance: (ms: number) => void }

type RatingValues = {
  pace: number
  technique: number
  passing: number
  defending: number
  physicality: number
  effort: number
}

type RatingSubmissionCode =
  | 'MATCH_NOT_FOUND'
  | 'WRONG_MATCH_STATUS'
  | 'RATING_WINDOW_CLOSED'
  | 'NOT_A_PARTICIPANT'
  | 'CANNOT_RATE_SELF'
  | 'CANNOT_RATE_TEAMMATE'
  | 'ALREADY_RATED'

export class RatingSubmissionError extends Error {
  constructor(
    readonly code: RatingSubmissionCode,
    readonly statusCode: number,
  ) {
    super(code)
    this.name = 'RatingSubmissionError'
  }
}

class RatingService {
  private clock: Clock

  constructor(clock?: Clock) {
    this.clock = clock ?? { now: () => new Date(), advance: () => {} }
  }

  isWindowOpen(match: { completedAt: Date | null; ratingWindowClosedAt?: Date | null }): boolean {
    if (!match.completedAt || match.ratingWindowClosedAt) return false
    const deadline = new Date(match.completedAt.getTime() + RATING_WINDOW_MS)
    return this.clock.now() < deadline
  }

  async submitPostMatchRating(input: {
    matchId: string
    raterPlayerId: string
    ratedPlayerId: string
    values: RatingValues
  }): Promise<{ rated: true }> {
    const [match] = await db
      .select({
        id: matches.id,
        groupId: matches.groupId,
        status: matches.status,
        completedAt: matches.completedAt,
        ratingWindowClosedAt: matches.ratingWindowClosedAt,
        scoreA: matches.scoreA,
        scoreB: matches.scoreB,
      })
      .from(matches)
      .where(eq(matches.id, input.matchId))
      .limit(1)

    if (!match) throw new RatingSubmissionError('MATCH_NOT_FOUND', 404)

    const participantRows = await db
      .select({ playerId: matchParticipants.playerId, teamSide: matchParticipants.teamSide })
      .from(matchParticipants)
      .where(and(
        eq(matchParticipants.matchId, input.matchId),
        inArray(matchParticipants.playerId, [input.raterPlayerId, input.ratedPlayerId]),
      ))

    const rater = participantRows.find((row) => row.playerId === input.raterPlayerId)
    const target = participantRows.find((row) => row.playerId === input.ratedPlayerId)
    const hasValidResult = match.scoreA !== null && match.scoreB !== null
    const capability = evaluateRatingCapability({
      matchStatus: hasValidResult ? match.status : 'incomplete_result',
      windowOpen: this.isWindowOpen(match),
      raterPlayerId: input.raterPlayerId,
      targetPlayerId: input.ratedPlayerId,
      raterTeamSide: rater?.teamSide ?? null,
      targetTeamSide: target?.teamSide ?? null,
    })

    if (!capability.allowed) {
      const statusCode = capability.code === 'NOT_A_PARTICIPANT' ? 403 : 422
      throw new RatingSubmissionError(capability.code, statusCode)
    }

    const created = await db
      .insert(ratings)
      .values({
        groupId: match.groupId,
        matchId: input.matchId,
        raterPlayerId: input.raterPlayerId,
        ratedPlayerId: input.ratedPlayerId,
        ...input.values,
        mentality: 5,
        isInitial: false,
      })
      .onConflictDoNothing()
      .returning({ id: ratings.id })

    if (created.length === 0) throw new RatingSubmissionError('ALREADY_RATED', 409)
    return { rated: true }
  }

  async closeWindow(matchId: string): Promise<void> {
    // Set ratingWindowClosedAt exactly once — idempotent via WHERE IS NULL guard
    await db
      .update(matches)
      .set({ ratingWindowClosedAt: this.clock.now(), updatedAt: this.clock.now() })
      .where(and(eq(matches.id, matchId), isNull(matches.ratingWindowClosedAt)))

    // Always retry the idempotent processor. If a previous close persisted but
    // processing rolled back, this call can finish it; completed claims no-op.
    await ovrService.runPostMatchUpdate(matchId)
  }
}

export const ratingService = new RatingService()
export { RatingService }
