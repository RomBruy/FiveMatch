import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, Radius, Type } from '../../constants/tokens'
import { useGroupContext } from '../../contexts/GroupContext'
import { ProgressBarPill } from '../../components/shared/ProgressBarPill'
import { Podium } from '../../components/shared/Podium'
import { httpClient } from '../../lib/api-client'
import { PronosLeaderboard } from '../../components/vestiaire/PronosLeaderboard'
import { DOCK_CLEARANCE } from '../../components/ui/TabDock'
import { Chip } from '../../components/ui/Chip'
import { DuotoneAvatar } from '../../components/ui/DuotoneAvatar'
import { OvrBadge } from '../../components/players/OvrBadge'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../components/ui/SecondaryButton'
import { TextureType } from '../../components/ui/TextureType'

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

// Story 4.5's leaderboard payload carries no W/D/L form data — form dots are
// omitted here rather than adding an endpoint (AC 2).
function RankRow({ player, tab }: { player: LeaderboardPlayer; tab: VestiaireTab }) {
  const { t } = useTranslation()
  const isUnlocked = player.cardState === 'unlocked'

  const rightContent = () => {
    if (tab === 'buteurs') {
      return (
        <View style={styles.rankRight}>
          <Text style={styles.rankStat}>{player.totalGoals}</Text>
          <Text style={styles.rankSubtext}>{player.matchCount} {t('vestiaire.matchesShort')}</Text>
        </View>
      )
    }
    if (tab === 'presences') {
      const rate = player.attendanceRate !== null ? `${player.attendanceRate}%` : '—'
      return (
        <View style={styles.rankRight}>
          <Text style={styles.rankStat}>{player.matchCount}</Text>
          <Text style={styles.rankSubtext}>{rate}</Text>
        </View>
      )
    }
    // OVR tab — unlocked gets the OVR pill; locked speaks the progress language (no OVR, no lock icons)
    if (isUnlocked && player.ovrScore !== null) {
      return (
        <View style={styles.rankRight}>
          <OvrBadge ovrScore={player.ovrScore} cardState={player.cardState} />
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
      <DuotoneAvatar displayName={player.displayName} size={36} />
      <View style={styles.rankCenter}>
        <Text style={[styles.rankName, !isUnlocked && styles.rankNameLocked]} numberOfLines={1}>
          {player.displayName}
        </Text>
        <Text style={styles.rankMeta}>{player.matchCount} {t('vestiaire.matchesShort')}</Text>
      </View>
      {rightContent()}
    </View>
  )
}

function SkeletonRow() {
  return (
    <View style={[styles.rankRow, styles.skeletonRow]}>
      <View style={styles.skeletonPosition} />
      <View style={styles.skeletonAvatar} />
      <View style={styles.rankCenter}>
        <View style={styles.skeletonName} />
      </View>
      <View style={styles.skeletonRight} />
    </View>
  )
}

export default function VestiaireTab() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
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
        {/* The tab dock owns this screen's one glow. */}
        <PrimaryButton
          label={t('auth.shell.createGroup')}
          glow={false}
          onPress={() => router.push('/(app)/groups/new' as never)}
        />
      </View>
    )
  }

  const players = data?.players ?? []

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
      {/* The screen's ONE texture element: outline screen-title watermark. */}
      <TextureType lines={[{ text: t('vestiaire.title') }]} fontSize={160} style={styles.texture} />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>{t('vestiaire.title')}</Text>
        <View style={styles.chips}>
          {tabs.map((tab) => (
            <Chip
              key={tab.key}
              label={tab.label}
              active={activeTab === tab.key}
              onPress={() => setActiveTab(tab.key)}
            />
          ))}
        </View>
      </View>

      {isLoading && activeTab !== 'pronos' && (
        <View style={styles.listContent}>
          <View style={styles.listCard}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        </View>
      )}

      {isError && activeTab !== 'pronos' && (
        <View style={styles.emptyContainer}>
          <Text style={styles.message}>{t('common.loadError')}</Text>
        </View>
      )}

      {!isLoading && !isError && data && activeTab !== 'pronos' && (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {activeTab === 'ovr' && top3.length >= 3 && <Podium top3={top3} />}
          {players.length > 0 && (
            <View style={styles.listCard}>
              {sortedPlayers().map((player, idx, arr) => (
                <View key={player.playerId}>
                  <RankRow player={player} tab={activeTab} />
                  {idx < arr.length - 1 && <View style={styles.separator} />}
                </View>
              ))}
            </View>
          )}
          {players.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {t('vestiaire.empty.title')}
                <Text style={styles.emptyAccent}>.</Text>
              </Text>
              <Text style={styles.emptyBody}>{t('vestiaire.empty.body')}</Text>
              <SecondaryButton
                label={t('vestiaire.empty.cta')}
                onPress={() => router.push('/(app)/match' as never)}
              />
            </View>
          )}
        </ScrollView>
      )}

      {activeTab === 'pronos' && activeGroupId && (
        <PronosLeaderboard groupId={activeGroupId} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, overflow: 'hidden' },
  texture: { top: 36, left: -30 },
  emptyContainer: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', padding: 24, gap: 24 },
  message: { color: Colors.ink, fontSize: 15, fontFamily: Fonts.inter, textAlign: 'center' },
  header: { paddingHorizontal: 16 },
  title: {
    color: Colors.ink,
    fontFamily: Type.display.fontFamily,
    fontSize: 40,
    letterSpacing: 1.8, // 0.045em @ 40 (display register)
    marginBottom: 10,
  },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: DOCK_CLEARANCE },
  listCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 18,
  },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.hairline },
  emptyState: { paddingTop: 64, paddingHorizontal: 8, gap: 14 },
  emptyTitle: {
    color: Colors.ink,
    fontFamily: Type.heading.fontFamily,
    fontSize: 28,
    letterSpacing: Type.heading.letterSpacing,
  },
  emptyAccent: { color: Colors.primary },
  emptyBody: {
    color: Colors.inkSecondary,
    fontSize: 14.5,
    fontFamily: Fonts.inter,
    lineHeight: 21,
    marginBottom: 10,
  },
  rankRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  rankPosition: {
    width: 26,
    color: Colors.inkDisabled,
    fontSize: 17,
    fontFamily: Type.stat.fontFamily,
    letterSpacing: 0.68, // 0.04em @ 17 (stat register)
    textAlign: 'center',
  },
  rankCenter: { flex: 1, gap: 2 },
  rankName: { color: Colors.ink, fontSize: 14.5, fontFamily: Fonts.interSemiBold },
  rankNameLocked: { color: Colors.inkSecondary },
  rankMeta: { color: Colors.inkSecondary, fontSize: 12, fontFamily: Fonts.inter },
  rankRight: { alignItems: 'flex-end', minWidth: 60 },
  rankStat: {
    color: Colors.ink,
    fontSize: 22,
    fontFamily: Type.stat.fontFamily,
    letterSpacing: 0.88, // 0.04em @ 22 (stat register)
  },
  rankSubtext: { color: Colors.inkSecondary, fontSize: 11, fontFamily: Fonts.interMedium },
  skeletonRow: { opacity: 0.4 },
  skeletonPosition: { width: 26, height: 20, backgroundColor: Colors.surfaceRaised, borderRadius: Radius.sm },
  skeletonAvatar: { width: 36, height: 36, borderRadius: Radius.full, backgroundColor: Colors.surfaceRaised },
  skeletonName: { width: '70%', height: 16, backgroundColor: Colors.surfaceRaised, borderRadius: Radius.sm },
  skeletonRight: { width: 48, height: 12, backgroundColor: Colors.surfaceRaised, borderRadius: Radius.sm },
})
