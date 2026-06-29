import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Colors } from '../../constants/colors'
import { useGroupContext } from '../../contexts/GroupContext'
import { ProgressBarPill } from '../../components/shared/ProgressBarPill'
import { Podium } from '../../components/shared/Podium'
import { httpClient } from '../../lib/api-client'
import { PronosLeaderboard } from '../../components/vestiaire/PronosLeaderboard'

type VestiaireTab = 'ovr' | 'buteurs' | 'presences' | 'pronos'

interface LeaderboardPlayer {
  rank: number | null
  playerId: string
  displayName: string
  cardState: string
  matchCount: number
  ovrScore: number | null
  trend: 'up' | 'down' | 'stable' | null
  playerTier: string
  attributes: { pace: number; technique: number; passing: number; defending: number; physicality: number; effort: number } | null
  totalGoals: number
  totalAssists: number
  attendanceRate: number | null
}

interface LeaderboardData {
  players: LeaderboardPlayer[]
  groupMatchCount: number
}

function getInitials(name: string): string {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

function RankRow({ player, tab }: { player: LeaderboardPlayer; tab: VestiaireTab }) {
  const { t } = useTranslation()
  const isUnlocked = player.cardState === 'unlocked'

  const rightContent = () => {
    if (tab === 'buteurs') {
      return (
        <View style={styles.rankRight}>
          <Text style={styles.rankOvr}>{player.totalGoals}</Text>
          <Text style={styles.rankSubtext}>{player.matchCount} {t('vestiaire.matchesShort')}</Text>
        </View>
      )
    }
    if (tab === 'presences') {
      const rate = player.attendanceRate !== null ? `${player.attendanceRate}%` : '—'
      return (
        <View style={styles.rankRight}>
          <Text style={styles.rankOvr}>{player.matchCount}</Text>
          <Text style={styles.rankSubtext}>{rate}</Text>
        </View>
      )
    }
    // OVR tab
    if (isUnlocked && player.ovrScore !== null) {
      return (
        <View style={styles.rankRight}>
          <Text style={styles.rankOvr}>{player.ovrScore}</Text>
          {player.trend === 'up' && (
            <Text style={styles.trendUp}>{t('card.trend.inForm')}</Text>
          )}
        </View>
      )
    }
    return (
      <View style={styles.rankRight}>
        <ProgressBarPill matchCount={player.matchCount} cardState={player.cardState} />
      </View>
    )
  }

  const rankLabel = tab === 'ovr'
    ? (player.rank !== null ? String(player.rank) : '—')
    : null

  return (
    <View
      style={styles.rankRow}
      accessible
      accessibilityLabel={
        isUnlocked
          ? t('vestiaire.rankRow.unlocked.accessibility', { name: player.displayName, ovr: player.ovrScore })
          : t('vestiaire.rankRow.locked.accessibility', { name: player.displayName, count: player.matchCount })
      }
    >
      {tab === 'ovr' && (
        <Text style={styles.rankPosition}>{rankLabel}</Text>
      )}
      <View style={styles.rankCenter}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitials}>{getInitials(player.displayName)}</Text>
        </View>
        <Text style={styles.rankName} numberOfLines={1}>
          {player.displayName}
        </Text>
      </View>
      {rightContent()}
    </View>
  )
}

function SkeletonRow() {
  return (
    <View style={[styles.rankRow, styles.skeletonRow]}>
      <View style={styles.skeletonPosition} />
      <View style={styles.rankCenter}>
        <View style={[styles.avatar, styles.skeletonAvatar]} />
        <View style={styles.skeletonName} />
      </View>
      <View style={styles.skeletonRight} />
    </View>
  )
}

export default function VestiaireTab() {
  const { t } = useTranslation()
  const router = useRouter()
  const { activeGroupId } = useGroupContext()
  const [activeTab, setActiveTab] = useState<VestiaireTab>('ovr')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['leaderboard', activeGroupId],
    queryFn: () =>
      httpClient
        .get<{ data: LeaderboardData }>(`/v1/groups/${activeGroupId}/leaderboard`)
        .then((r) => r.data.data),
    enabled: !!activeGroupId,
  })

  if (!activeGroupId) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.message}>{t('auth.shell.noGroup')}</Text>
        <Pressable style={styles.button} onPress={() => router.push('/(app)/groups/new' as never)}>
          <Text style={styles.buttonText}>{t('auth.shell.createGroup')}</Text>
        </Pressable>
      </View>
    )
  }

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
        <Text style={styles.message}>{t('common.loadError')}</Text>
      </View>
    )
  }

  const players = data.players

  const sortedPlayers = (): LeaderboardPlayer[] => {
    if (activeTab === 'buteurs') {
      return [...players].sort((a, b) => b.totalGoals - a.totalGoals)
    }
    if (activeTab === 'presences') {
      return [...players].sort((a, b) => b.matchCount - a.matchCount)
    }
    return players // already sorted by API for OVR tab
  }

  const top3 = players
    .filter((p) => p.rank !== null && p.rank <= 3 && p.ovrScore !== null)
    .map((p) => ({ playerId: p.playerId, displayName: p.displayName, ovrScore: p.ovrScore!, rank: p.rank as 1 | 2 | 3 }))

  const tabs: { key: VestiaireTab; label: string }[] = [
    { key: 'ovr', label: t('vestiaire.tab.ovr') },
    { key: 'buteurs', label: t('vestiaire.tab.buteurs') },
    { key: 'presences', label: t('vestiaire.tab.presences') },
    { key: 'pronos', label: t('vestiaire.tab.pronos') },
  ]

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            style={styles.tabButton}
            onPress={() => setActiveTab(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.key }}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
            {activeTab === tab.key && <View style={styles.tabUnderline} />}
          </Pressable>
        ))}
      </View>

      {/* Podium — OVR tab only, when ≥ 3 unlocked players */}
      {activeTab === 'ovr' && top3.length >= 3 && (
        <Podium top3={top3} />
      )}

      {activeTab !== 'pronos' && (
        <FlatList
          data={sortedPlayers()}
          keyExtractor={(p) => p.playerId}
          renderItem={({ item }) => <RankRow player={item} tab={activeTab} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={styles.listContent}
        />
      )}
      {activeTab === 'pronos' && activeGroupId && (
        <PronosLeaderboard groupId={activeGroupId} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  emptyContainer: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', alignItems: 'center', padding: 24 },
  message: { color: Colors.ink, fontSize: 17, textAlign: 'center', marginBottom: 24 },
  button: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 4 },
  buttonText: { color: Colors.ink, fontSize: 16, fontWeight: '600' },
  tabBar: { flexDirection: 'row', backgroundColor: Colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.surfaceRaised },
  tabButton: { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabLabel: { fontSize: 13, fontFamily: 'Inter_600SemiBold', color: Colors.inkSecondary, letterSpacing: 0.5, textTransform: 'uppercase' },
  tabLabelActive: { color: Colors.primary },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, backgroundColor: Colors.primary },
  listContent: { paddingVertical: 8 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.surfaceRaised },
  rankRow: { minHeight: 56, backgroundColor: Colors.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  rankPosition: { width: 32, color: Colors.inkSecondary, fontSize: 32, fontFamily: 'BebasNeue_400Regular', textAlign: 'center' },
  rankCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 2, backgroundColor: Colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: Colors.inkSecondary, fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  rankName: { flex: 1, color: Colors.ink, fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  rankRight: { alignItems: 'flex-end', minWidth: 60 },
  rankOvr: { color: Colors.ink, fontSize: 20, fontFamily: 'BebasNeue_400Regular' },
  rankSubtext: { color: Colors.inkSecondary, fontSize: 11, fontFamily: 'Inter_500Medium' },
  trendUp: { color: Colors.success, fontSize: 10, fontFamily: 'Inter_600SemiBold', letterSpacing: 1 },
  skeletonRow: { opacity: 0.4 },
  skeletonPosition: { width: 32, height: 20, backgroundColor: Colors.surfaceRaised, borderRadius: 2 },
  skeletonAvatar: { backgroundColor: Colors.surfaceRaised },
  skeletonName: { flex: 1, height: 16, backgroundColor: Colors.surfaceRaised, borderRadius: 2 },
  skeletonRight: { width: 48, height: 10, backgroundColor: Colors.surfaceRaised, borderRadius: 2 },
})
