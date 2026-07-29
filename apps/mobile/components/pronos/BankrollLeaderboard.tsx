import { StyleSheet, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Colors } from '../../constants/colors'
import { Fonts, Radius, Type } from '../../constants/tokens'
import { httpClient } from '../../lib/api-client'
import { DuotoneAvatar } from '../ui/DuotoneAvatar'
import { SkeletonRow } from '../ui/Skeleton'

interface LeaderboardEntry {
  rank: number
  playerId: string
  displayName: string
  balance: number
  betsPlaced: number
  betsSettled: number
  betsWon: number
  accuracyRate: number
}

interface BankrollLeaderboardData {
  leaderboard: LeaderboardEntry[]
  myPlayerId: string | null
}

/**
 * Ranked by bankroll, not by accuracy — the biggest winner leads and the hit rate drops to
 * a secondary stat. The screen's ONE gold is the rank-1 "Plus gros parieur" badge.
 *
 * Query key is shared with the Profil screen, which calls the same endpoint purely to
 * resolve the caller's playerId — do not rename it.
 */
export function BankrollLeaderboard({ groupId }: { groupId: string }) {
  const { t, i18n } = useTranslation()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pronos', 'leaderboard', groupId],
    queryFn: () =>
      httpClient
        .get<{ data: BankrollLeaderboardData }>(`/v1/groups/${groupId}/pronos/leaderboard`)
        .then((r) => r.data.data),
    enabled: !!groupId,
  })

  if (isLoading) {
    return (
      <View style={styles.skeletonBlock}>
        <SkeletonRow card />
        <SkeletonRow card />
        <SkeletonRow card />
      </View>
    )
  }

  if (isError || !data) {
    return <Text style={styles.emptyText}>{t('common.loadError')}</Text>
  }

  const { leaderboard, myPlayerId } = data

  if (leaderboard.length === 0) {
    return <Text style={styles.emptyText}>{t('pronos.leaderboard.empty')}</Text>
  }

  return (
    <View style={styles.card}>
      {leaderboard.map((entry, idx) => {
        const isMe = entry.playerId === myPlayerId
        const isTop = entry.rank === 1
        const balance = entry.balance.toLocaleString(i18n.language)

        return (
          <View key={entry.playerId}>
            {/* Display-only rows — never PressableScale (Story 10.1). */}
            <View
              style={[styles.row, isMe && styles.rowMe]}
              accessibilityLabel={t('pronos.leaderboard.rowA11y', {
                rank: entry.rank,
                name: entry.displayName,
                balance: entry.balance,
              })}
            >
              <Text style={[styles.rank, isTop && styles.rankTop]}>{entry.rank}</Text>
              <DuotoneAvatar displayName={entry.displayName} size={36} />
              <View style={styles.rowCenter}>
                <Text style={styles.name} numberOfLines={1}>
                  {entry.displayName}
                </Text>
                {isTop && <Text style={styles.badge}>{t('pronos.leaderboard.badgeBiggest').toUpperCase()}</Text>}
              </View>
              <View style={styles.rowRight}>
                <Text style={[styles.balance, isMe && styles.balanceMe]}>{balance}</Text>
                {/* No accuracy line at all before anything settles — "0 %" would read as a
                    losing record rather than an unsettled one. */}
                {entry.betsSettled > 0 && (
                  <Text style={styles.accuracy}>
                    {t('pronos.leaderboard.accuracy', { pct: Math.round(entry.accuracyRate * 100) })}
                  </Text>
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
  skeletonBlock: { gap: 8 },
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
  rowMe: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.sm,
    marginHorizontal: -10,
    paddingHorizontal: 10,
  },
  rank: {
    width: 26,
    color: Colors.inkDisabled,
    fontSize: 17,
    fontFamily: Type.stat.fontFamily,
    letterSpacing: 0.68, // 0.04em @ 17 (stat register)
    textAlign: 'center',
  },
  // The screen's one gold: the rank-1 numeral and its badge, nothing else.
  rankTop: { color: Colors.gold },
  rowCenter: { flex: 1, minWidth: 0, gap: 2 },
  name: { color: Colors.ink, fontSize: 14.5, fontFamily: Fonts.interSemiBold },
  badge: {
    color: Colors.gold,
    fontSize: 9,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.26, // 0.14em @ 9 (label-caps register)
  },
  rowRight: { alignItems: 'flex-end', minWidth: 62, gap: 3 },
  balance: {
    color: Colors.ink,
    fontSize: 20,
    fontFamily: Type.stat.fontFamily,
    letterSpacing: 0.8, // 0.04em @ 20 (stat register)
    fontVariant: ['tabular-nums'],
  },
  balanceMe: { color: Colors.primary },
  accuracy: { color: Colors.inkSecondary, fontSize: 10.5, fontFamily: Fonts.interMedium },
  emptyText: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: Fonts.inter,
    paddingVertical: 10,
  },
})
