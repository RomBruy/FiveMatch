import { View, Text, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { httpClient } from '../../lib/api-client'

interface RevealRow {
  playerId: string
  displayName: string
  predictionResult: 'teamA' | 'draw' | 'teamB'
  predictionMvpDisplayName: string | null
  predictionScore: string
  pointsEarned: number
  breakdown: { scoreCorrect: boolean; resultCorrect: boolean; mvpCorrect: boolean }
}

interface RevealData {
  rows: RevealRow[]
  actualResult: 'teamA' | 'draw' | 'teamB'
  actualScore: string
  actualMvpDisplayName: string | null
}

interface PronosRevealProps {
  matchId: string
  groupId: string
  currentPlayerId: string
}

export function PronosReveal({ matchId, groupId, currentPlayerId }: PronosRevealProps) {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery<RevealData>({
    queryKey: ['pronos', 'reveal', matchId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: RevealData }>(
        `/v1/groups/${groupId}/matches/${matchId}/pronos/reveal`,
      )
      return data.data
    },
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <View style={styles.skeletonContainer}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skeletonRow} />
        ))}
      </View>
    )
  }

  if (!data || data.rows.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('pronos.reveal.noSubmissions')}</Text>
      </View>
    )
  }

  return (
    <View>
      {data.rows.map((row) => {
        const isCurrentUser = row.playerId === currentPlayerId
        return (
          <View
            key={row.playerId}
            style={[styles.row, isCurrentUser && styles.rowCurrentUser]}
          >
            <View style={styles.rowTop}>
              <Text style={styles.playerName}>{row.displayName}</Text>
              <Text style={styles.pointsBadge}>
                {row.pointsEarned} {t('pronos.reveal.pointsSuffix')}
              </Text>
            </View>
            <View style={styles.predictionCells}>
              <View style={styles.predictionCell}>
                <Text style={styles.cellLabel}>{t('pronos.reveal.scoreLabel')}</Text>
                <Text
                  style={[
                    styles.cellValue,
                    row.breakdown.scoreCorrect ? styles.correct : styles.incorrect,
                  ]}
                >
                  {row.predictionScore}
                </Text>
              </View>
              <View style={styles.predictionCell}>
                <Text style={styles.cellLabel}>{t('pronos.reveal.resultLabel')}</Text>
                <Text
                  style={[
                    styles.cellValue,
                    row.breakdown.resultCorrect ? styles.correct : styles.incorrect,
                  ]}
                >
                  {t(`pronos.${row.predictionResult}`)}
                </Text>
              </View>
              <View style={styles.predictionCell}>
                <Text style={styles.cellLabel}>{t('pronos.reveal.mvpLabel')}</Text>
                <Text
                  style={[
                    styles.cellValue,
                    row.breakdown.mvpCorrect ? styles.correct : styles.incorrect,
                  ]}
                >
                  {row.predictionMvpDisplayName ?? t('pronos.reveal.noPrediction')}
                </Text>
              </View>
            </View>
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  skeletonContainer: {
    gap: 1,
  },
  skeletonRow: {
    height: 72,
    backgroundColor: Colors.surface,
  },
  emptyContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyText: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontStyle: 'italic',
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 6,
  },
  rowCurrentUser: {
    backgroundColor: 'rgba(255,59,71,0.05)',
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerName: {
    color: Colors.ink,
    fontSize: 14,
    fontWeight: '600',
  },
  pointsBadge: {
    color: Colors.gold,
    fontSize: 18,
    fontFamily: 'BebasNeue',
  },
  predictionCells: {
    flexDirection: 'row',
    gap: 12,
  },
  predictionCell: {
    flex: 1,
    gap: 2,
  },
  cellLabel: {
    color: Colors.inkSecondary,
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cellValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  correct: {
    color: Colors.success,
  },
  incorrect: {
    color: Colors.primary,
  },
})
