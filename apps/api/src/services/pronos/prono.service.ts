import {
  PRONOS_POINTS_EXACT_SCORE,
  PRONOS_POINTS_RESULT,
  PRONOS_POINTS_MVP,
} from '@fivematch/types/algorithm-constants'
import { db } from '../../db'
import { pronos, matches, players } from '../../db/schema'
import { eq, and, isNull, inArray } from 'drizzle-orm'
import { notificationService } from '../../services/notifications/notification.service'

function deriveActualResult(scoreA: number, scoreB: number): 'teamA' | 'draw' | 'teamB' {
  if (scoreA > scoreB) return 'teamA'
  if (scoreB > scoreA) return 'teamB'
  return 'draw'
}

export const pronosService = {
  scoreAndReveal: async (matchId: string): Promise<void> => {
    // 1. Fetch match result data
    const [match] = await db
      .select({
        id: matches.id,
        groupId: matches.groupId,
        scoreA: matches.scoreA,
        scoreB: matches.scoreB,
        mvpPlayerId: matches.mvpPlayerId,
      })
      .from(matches)
      .where(eq(matches.id, matchId))

    if (!match || match.scoreA === null || match.scoreB === null) return

    const actualScore = `${match.scoreA}-${match.scoreB}`
    const actualResult = deriveActualResult(match.scoreA, match.scoreB)

    // 2. Fetch all pronos rows for this match
    const pronosRows = await db
      .select()
      .from(pronos)
      .where(eq(pronos.matchId, matchId))

    if (pronosRows.length === 0) return

    // 3. Compute pointsEarned for each row
    const updates = pronosRows.map((prono) => {
      const scoreCorrect = prono.predictionScore === actualScore
      const resultCorrect = prono.predictionResult === actualResult
      const mvpCorrect =
        match.mvpPlayerId !== null &&
        prono.predictionMvpPlayerId === match.mvpPlayerId

      // Exact score and result are exclusive — award highest tier only
      const scorePts = scoreCorrect
        ? PRONOS_POINTS_EXACT_SCORE
        : resultCorrect
          ? PRONOS_POINTS_RESULT
          : 0
      const mvpPts = mvpCorrect ? PRONOS_POINTS_MVP : 0

      return { id: prono.id, playerId: prono.playerId, pointsEarned: scorePts + mvpPts }
    })

    // 4. Persist all pointsEarned in a single transaction
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(pronos)
          .set({ pointsEarned: update.pointsEarned })
          .where(eq(pronos.id, update.id))
      }
    })

    // 5. Notify submitters — resolve their userId for push dispatch
    const submitterPlayerIds = updates.map((u) => u.playerId)
    const submitterPlayers = await db
      .select({ userId: players.userId })
      .from(players)
      .where(and(inArray(players.id, submitterPlayerIds), isNull(players.deletedAt)))

    const recipientUserIds = submitterPlayers.map((p) => p.userId)
    if (recipientUserIds.length > 0) {
      notificationService.send({
        type: 'PRONOS_REVEALED',
        matchId,
        groupId: match.groupId,
        recipientUserIds,
      })
    }
  },
}
