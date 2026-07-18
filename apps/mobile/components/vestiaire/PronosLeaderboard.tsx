import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Colors } from '../../constants/colors'
import { Fonts, Radius, Type } from '../../constants/tokens'
import { httpClient } from '../../lib/api-client'
import { DuotoneAvatar } from '../ui/DuotoneAvatar'
import { DOCK_CLEARANCE } from '../ui/TabDock'

interface LeaderboardEntry {
  rank: number
  playerId: string
  displayName: string
  totalPronosPoints: number
  matchesWithPronos: number
  correctPredictions: number
  totalPredictions: number
  accuracyRate: number
}

interface PronosLeaderboardData {
  leaderboard: LeaderboardEntry[]
  myPlayerId: string | null
}

function SkeletonRow() {
  return (
    <View style={[styles.row, styles.skeletonRow]}>
      <View style={styles.skeletonPosition} />
      <View style={styles.skeletonAvatar} />
      <View style={styles.rowCenter}>
        <View style={styles.skeletonName} />
      </View>
      <View style={styles.skeletonRight} />
    </View>
  )
}

export function PronosLeaderboard({ groupId }: { groupId: string }) {
  const { t } = useTranslation()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pronos', 'leaderboard', groupId],
    queryFn: () =>
      httpClient
        .get<{ data: PronosLeaderboardData }>(`/v1/groups/${groupId}/pronos/leaderboard`)
        .then((r) => r.data.data),
    enabled: !!groupId,
  })

  const myPlayerId = data?.myPlayerId ?? null

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </View>
      </View>
    )
  }

  if (isError || !data) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>{t('common.loadError')}</Text>
      </View>
    )
  }

  const { leaderboard } = data

  if (leaderboard.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyHeadline}>{t('vestiaire.pronos.empty')}</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.card}>
        {leaderboard.map((entry, idx) => {
          const isMe = entry.playerId === myPlayerId
          const accuracyPct = Math.round(entry.accuracyRate * 100)

          return (
            <View key={entry.playerId}>
              <View style={[styles.row, isMe && styles.rowHighlight]}>
                <Text style={styles.rankPosition}>{entry.rank}</Text>
                <DuotoneAvatar displayName={entry.displayName} size={36} />
                <View style={styles.rowCenter}>
                  <Text style={styles.rowName} numberOfLines={1}>{entry.displayName}</Text>
                  {entry.rank === 1 && (
                    <Text style={styles.bestBadge}>{t('vestiaire.pronos.badge.best').toUpperCase()}</Text>
                  )}
                </View>
                <View style={styles.rowRight}>
                  <View style={styles.pointsChip}>
                    <Text style={styles.pointsChipText}>{entry.totalPronosPoints}</Text>
                  </View>
                  {entry.matchesWithPronos > 0 && (
                    <Text style={styles.accuracyText}>{accuracyPct}%</Text>
                  )}
                </View>
              </View>
              {idx < leaderboard.length - 1 && <View style={styles.separator} />}
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: DOCK_CLEARANCE },
  emptyContainer: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: Colors.ink, fontSize: 15, fontFamily: Fonts.inter, textAlign: 'center' },
  emptyHeadline: {
    color: Colors.ink,
    fontSize: 24,
    fontFamily: Type.heading.fontFamily,
    letterSpacing: Type.heading.letterSpacing,
    textAlign: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 18,
  },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.hairline },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  rowHighlight: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.sm,
    marginHorizontal: -10,
    paddingHorizontal: 10,
  },
  rankPosition: {
    width: 26,
    color: Colors.inkDisabled,
    fontSize: 17,
    fontFamily: Type.stat.fontFamily,
    letterSpacing: 0.68, // 0.04em @ 17 (stat register)
    textAlign: 'center',
  },
  rowCenter: { flex: 1, gap: 2 },
  rowName: { color: Colors.ink, fontSize: 14.5, fontFamily: Fonts.interSemiBold },
  bestBadge: {
    color: Colors.gold,
    fontSize: 9,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.26, // 0.14em @ 9 (label-caps register)
  },
  rowRight: { alignItems: 'flex-end', minWidth: 60, gap: 2 },
  pointsChip: {
    backgroundColor: Colors.primarySubtle,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.full,
  },
  pointsChipText: {
    color: Colors.primary,
    fontSize: 15,
    fontFamily: Type.stat.fontFamily,
    letterSpacing: 0.6, // 0.04em @ 15 (stat register)
  },
  accuracyText: { color: Colors.inkSecondary, fontSize: 11, fontFamily: Fonts.interMedium },
  skeletonRow: { opacity: 0.4 },
  skeletonPosition: { width: 26, height: 20, backgroundColor: Colors.surfaceRaised, borderRadius: Radius.sm },
  skeletonAvatar: { width: 36, height: 36, borderRadius: Radius.full, backgroundColor: Colors.surfaceRaised },
  skeletonName: { width: '70%', height: 16, backgroundColor: Colors.surfaceRaised, borderRadius: Radius.sm },
  skeletonRight: { width: 48, height: 12, backgroundColor: Colors.surfaceRaised, borderRadius: Radius.sm },
})
