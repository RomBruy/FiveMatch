import { View, Text, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { Fonts, Radius, Type } from '../../constants/tokens'
import { httpClient } from '../../lib/api-client'
import { DuotoneAvatar } from '../ui/DuotoneAvatar'

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
      <View style={styles.grid}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.skeletonCard} />
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
    <View style={styles.grid}>
      {data.rows.map((row) => {
        const isCurrentUser = row.playerId === currentPlayerId
        return (
          <View
            key={row.playerId}
            style={[styles.card, isCurrentUser && styles.cardCurrentUser]}
          >
            <View style={styles.cardTop}>
              <DuotoneAvatar displayName={row.displayName} size={36} />
              <Text style={styles.playerName} numberOfLines={1}>{row.displayName}</Text>
              {/* Points chip — stat register; 50/30/20 scoring display unchanged. */}
              <View style={styles.pointsChip}>
                <Text style={styles.pointsValue}>{row.pointsEarned}</Text>
                <Text style={styles.pointsSuffix}>{t('pronos.reveal.pointsSuffix')}</Text>
              </View>
            </View>
            <View style={styles.predictionCells}>
              <PredictionCell
                label={t('pronos.reveal.scoreLabel')}
                value={row.predictionScore}
                correct={row.breakdown.scoreCorrect}
              />
              <PredictionCell
                label={t('pronos.reveal.resultLabel')}
                value={t(`pronos.${row.predictionResult}`)}
                correct={row.breakdown.resultCorrect}
              />
              <PredictionCell
                label={t('pronos.reveal.mvpLabel')}
                value={row.predictionMvpDisplayName ?? t('pronos.reveal.noPrediction')}
                correct={row.breakdown.mvpCorrect}
              />
            </View>
          </View>
        )
      })}
    </View>
  )
}

// Correctness always reads as text + icon, never color alone.
function PredictionCell({ label, value, correct }: { label: string; value: string; correct: boolean }) {
  return (
    <View style={styles.predictionCell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <View style={styles.cellValueRow}>
        <Ionicons
          name={correct ? 'checkmark-circle' : 'close-circle'}
          size={12}
          color={correct ? Colors.success : Colors.primary}
        />
        <Text
          style={[styles.cellValue, correct ? styles.correct : styles.incorrect]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    gap: 10,
  },
  skeletonCard: {
    height: 84,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
  },
  emptyContainer: {
    paddingVertical: 12,
  },
  emptyText: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: Fonts.inter,
    fontStyle: 'italic',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
    gap: 10,
  },
  cardCurrentUser: {
    backgroundColor: Colors.primarySubtle,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playerName: {
    flex: 1,
    color: Colors.ink,
    fontSize: 14,
    fontFamily: Fonts.interSemiBold,
  },
  pointsChip: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  pointsValue: {
    // --type-stat numerals; points speak primary like every points chip (gold is prestige-only, 9.12).
    color: Colors.primary,
    fontFamily: Type.stat.fontFamily,
    fontSize: 16,
    letterSpacing: 0.64, // 0.04em @ 16
    fontVariant: ['tabular-nums'],
  },
  pointsSuffix: {
    color: Colors.inkSecondary,
    fontSize: 9,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  predictionCells: {
    flexDirection: 'row',
    gap: 12,
  },
  predictionCell: {
    flex: 1,
    gap: 3,
  },
  cellLabel: {
    color: Colors.inkSecondary,
    fontSize: 9,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cellValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cellValue: {
    flexShrink: 1,
    fontSize: 12,
    fontFamily: Fonts.interSemiBold,
  },
  correct: {
    color: Colors.success,
  },
  incorrect: {
    color: Colors.primary,
  },
})
