import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Colors } from '../../constants/colors'
import { httpClient } from '../../lib/api-client'

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

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

function SkeletonRow() {
  return (
    <View style={[styles.row, styles.skeletonRow]}>
      <View style={styles.skeletonPosition} />
      <View style={styles.rowCenter}>
        <View style={[styles.avatar, styles.skeletonAvatar]} />
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
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
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
    <View style={styles.container}>
      {leaderboard.map((entry, idx) => {
        const isMe = entry.playerId === myPlayerId
        const accuracyPct = Math.round(entry.accuracyRate * 100)

        return (
          <View key={entry.playerId}>
            <View style={[styles.row, isMe && styles.rowHighlight]}>
              <Text style={styles.rankPosition}>{entry.rank}</Text>
              <View style={styles.rowCenter}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarInitials}>{getInitials(entry.displayName)}</Text>
                </View>
                <View style={styles.nameContainer}>
                  <Text style={styles.rowName} numberOfLines={1}>{entry.displayName}</Text>
                  {entry.rank === 1 && (
                    <Text style={styles.bestBadge}>{t('vestiaire.pronos.badge.best').toUpperCase()}</Text>
                  )}
                </View>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.pronosPoints}>{entry.totalPronosPoints}</Text>
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
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, paddingVertical: 8 },
  emptyContainer: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { color: Colors.ink, fontSize: 17, textAlign: 'center' },
  emptyHeadline: { color: Colors.ink, fontSize: 24, fontFamily: 'BebasNeue_400Regular', textAlign: 'center' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.surfaceRaised, marginHorizontal: 16 },
  row: { minHeight: 56, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  rowHighlight: { backgroundColor: 'rgba(255,59,71,0.05)' },
  rankPosition: { width: 32, color: Colors.inkSecondary, fontSize: 32, fontFamily: 'BebasNeue_400Regular', textAlign: 'center' },
  rowCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 2, backgroundColor: Colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: Colors.inkSecondary, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  nameContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowName: { flex: 1, color: Colors.ink, fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  bestBadge: { color: Colors.gold, fontSize: 9, fontFamily: 'Inter_600SemiBold', letterSpacing: 0.12 * 9 },
  rowRight: { alignItems: 'flex-end', minWidth: 60 },
  pronosPoints: { color: Colors.ink, fontSize: 20, fontFamily: 'BebasNeue_400Regular' },
  accuracyText: { color: Colors.inkSecondary, fontSize: 11, fontFamily: 'Inter_500Medium' },
  skeletonRow: { opacity: 0.4 },
  skeletonPosition: { width: 32, height: 20, backgroundColor: Colors.surfaceRaised, borderRadius: 2 },
  skeletonAvatar: { backgroundColor: Colors.surfaceRaised },
  skeletonName: { flex: 1, height: 16, backgroundColor: Colors.surfaceRaised, borderRadius: 2 },
  skeletonRight: { width: 48, height: 10, backgroundColor: Colors.surfaceRaised, borderRadius: 2 },
})
