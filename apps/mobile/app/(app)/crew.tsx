import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native'
import { JoinRequests } from '../../components/crew/JoinRequests'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { useGroupContext } from '../../contexts/GroupContext'
import { GroupSwitcher } from '../../components/GroupSwitcher'
import { Chip } from '../../components/ui/Chip'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../components/ui/SecondaryButton'
import { PressableScale } from '../../components/ui/PressableScale'
import { DuotoneAvatar } from '../../components/ui/DuotoneAvatar'
import { EmptyState } from '../../components/ui/EmptyState'
import { SkeletonRow } from '../../components/ui/Skeleton'
import { StaggerItem } from '../../components/ui/Stagger'
import { TextureType } from '../../components/ui/TextureType'
import { DOCK_CLEARANCE } from '../../components/ui/TabDock'
import { OvrBadge } from '../../components/players/OvrBadge'
import { ProgressBarPill } from '../../components/shared/ProgressBarPill'
import { BankrollLeaderboard } from '../../components/pronos/BankrollLeaderboard'
import { httpClient } from '../../lib/api-client'

type Board = 'ovr' | 'scorers' | 'attendance' | 'pronos'

interface LeaderboardPlayer {
  rank: number | null
  playerId: string
  displayName: string
  cardState: string
  matchCount: number
  ovrScore: number | null
  playerTier: string
  totalGoals: number
  totalAssists: number
  attendanceRate: number | null
}

/**
 * CREW — one screen where there used to be two.
 *
 * `players.tsx` (a grid of Panini cards) and `vestiaire.tsx` (three leaderboards)
 * were both "the people in my group", differing only in presentation. They are
 * one tab now, and it sits third rather than second: a crew is something you may
 * have, not the thing the app is about.
 */
export default function CrewTab() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { activeGroupId, isReady } = useGroupContext()

  const [board, setBoard] = useState<Board>('ovr')
  const [switcherVisible, setSwitcherVisible] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const { data: group } = useQuery({
    queryKey: ['groups', activeGroupId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { name: string; tier: string } }>(
        `/v1/groups/${activeGroupId}`,
      )
      return data.data
    },
    enabled: !!activeGroupId,
  })

  const { data: myStatus } = useQuery({
    queryKey: ['groups', activeGroupId, 'my-status'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { role: string } }>(
        `/v1/groups/${activeGroupId}/my-status`,
      )
      return data.data
    },
    enabled: !!activeGroupId,
  })
  const isOrganizer = myStatus?.role === 'organizer'

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ['leaderboard', activeGroupId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { players: LeaderboardPlayer[] } }>(
        `/v1/groups/${activeGroupId}/leaderboard`,
      )
      return data.data.players
    },
    enabled: !!activeGroupId,
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await queryClient.refetchQueries({ queryKey: ['leaderboard', activeGroupId] })
    } finally {
      setRefreshing(false)
    }
  }, [queryClient, activeGroupId])

  const sorted = [...(leaderboard ?? [])].sort((a, b) => {
    if (board === 'scorers') return b.totalGoals - a.totalGoals
    if (board === 'attendance') return (b.attendanceRate ?? 0) - (a.attendanceRate ?? 0)
    return (a.rank ?? 999) - (b.rank ?? 999)
  })

  // No crew is a perfectly normal state now, not a broken one.
  if (isReady && !activeGroupId) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, styles.emptyContent, { paddingTop: insets.top + 12 }]}
      >
        <Text style={styles.title}>{t('crew.title')}<Text style={styles.titleAccent}>.</Text></Text>
        {/* "Crew" means nothing to someone who just arrived, and this is the only
            screen where there is room to define it. So the empty state carries the
            definition, not a apology for having no data. */}
        <EmptyState
          title={t('crew.empty.title')}
          body={t('crew.empty.body')}
          style={styles.emptyCard}
        >
          <PrimaryButton
            label={t('crew.empty.create')}
            onPress={() => router.push('/(app)/groups/new' as never)}
            glow={false}
          />
          <SecondaryButton
            label={t('crew.empty.find')}
            onPress={() => router.push('/(app)/groups/search' as never)}
          />
        </EmptyState>
      </ScrollView>
    )
  }

  return (
    <View style={styles.container}>
      {group && <TextureType lines={[{ text: group.name }]} fontSize={170} style={styles.texture} />}

      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
        }
      >
        {group && (
          <PressableScale
            style={styles.header}
            onPress={() => setSwitcherVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('crew.switch')}
          >
            <DuotoneAvatar displayName={group.name} size={42} />
            <View style={styles.headerText}>
              <Text style={styles.crewName} numberOfLines={1}>{group.name}</Text>
              <Text style={styles.crewTier}>{t(`groups.home.tier.${group.tier}`)}</Text>
            </View>
            <Ionicons name="chevron-down" size={18} color={Colors.inkSecondary} />
          </PressableScale>
        )}

        <View style={styles.actions}>
          <Chip
            label={t('crew.actions.newMatch')}
            variant="outlined"
            onPress={() => router.push('/(app)/match/create' as never)}
          />
          {isOrganizer && (
            <Chip
              label={t('crew.actions.invite')}
              variant="outlined"
              onPress={() => router.push(`/(app)/groups/${activeGroupId}/settings` as never)}
            />
          )}
          {isOrganizer && (
            <Chip
              label={t('crew.actions.roster')}
              variant="outlined"
              onPress={() => router.push(`/(app)/groups/${activeGroupId}/roster` as never)}
            />
          )}
        </View>

        {activeGroupId && (
          <JoinRequests groupId={activeGroupId} isOrganizer={isOrganizer} />
        )}

        <View style={styles.boardTabs}>
          <Chip label={t('crew.board.ovr')} active={board === 'ovr'} onPress={() => setBoard('ovr')} />
          <Chip label={t('crew.board.scorers')} active={board === 'scorers'} onPress={() => setBoard('scorers')} />
          <Chip label={t('crew.board.attendance')} active={board === 'attendance'} onPress={() => setBoard('attendance')} />
          {/* Betting is an engagement layer, so its board sits with the others
              rather than owning a tab of its own. */}
          <Chip label={t('crew.board.pronos')} active={board === 'pronos'} onPress={() => setBoard('pronos')} />
        </View>

        {board === 'pronos' && activeGroupId ? (
          <BankrollLeaderboard groupId={activeGroupId} />
        ) : isLoading ? (
          <View style={styles.list}>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : sorted.length === 0 ? (
          <Text style={styles.listEmpty}>{t('crew.board.empty')}</Text>
        ) : (
          <View style={styles.list}>
            {sorted.map((player, index) => (
              <StaggerItem key={player.playerId} index={Math.min(index, 6)}>
                <PressableScale
                  style={styles.row}
                  onPress={() => router.push(`/(app)/player/${player.playerId}` as never)}
                  accessibilityRole="button"
                >
                  <Text style={styles.rowRank}>{index + 1}</Text>
                  <DuotoneAvatar displayName={player.displayName} size={36} />
                  <View style={styles.rowCenter}>
                    <Text style={styles.rowName} numberOfLines={1}>{player.displayName}</Text>
                    <Text style={styles.rowMeta}>
                      {t('player.matchesPlayed', { count: player.matchCount })}
                    </Text>
                  </View>
                  <View style={styles.rowRight}>
                    {board === 'scorers' ? (
                      <Text style={styles.rowStat}>{player.totalGoals}</Text>
                    ) : board === 'attendance' ? (
                      <Text style={styles.rowStat}>
                        {player.attendanceRate !== null ? `${player.attendanceRate}%` : '—'}
                      </Text>
                    ) : player.cardState === 'unlocked' && player.ovrScore !== null ? (
                      <OvrBadge ovrScore={player.ovrScore} cardState={player.cardState} />
                    ) : (
                      <ProgressBarPill matchCount={player.matchCount} cardState={player.cardState} />
                    )}
                  </View>
                </PressableScale>
              </StaggerItem>
            ))}
          </View>
        )}
      </ScrollView>

      <GroupSwitcher visible={switcherVisible} onClose={() => setSwitcherVisible(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, overflow: 'hidden' },
  screen: { flex: 1, backgroundColor: Colors.bg },
  texture: { top: 30, right: -70 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: DOCK_CLEARANCE },
  emptyContent: { justifyContent: 'center', gap: 16 },
  title: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 40,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  titleAccent: { color: Colors.primary },
  emptyCard: { marginTop: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  headerText: { flex: 1, gap: 2 },
  crewName: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 30,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  crewTier: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  boardTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 24, marginBottom: 16 },
  list: { gap: 6 },
  listEmpty: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.inter,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowRank: {
    width: 20,
    fontFamily: Fonts.bebas,
    fontSize: 20,
    color: Colors.inkDisabled,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  rowCenter: { flex: 1, gap: 2 },
  rowName: { color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 14 },
  rowMeta: { color: Colors.inkDisabled, fontFamily: Fonts.inter, fontSize: 11 },
  rowRight: { alignItems: 'flex-end' },
  rowStat: {
    fontFamily: Fonts.bebas,
    fontSize: 24,
    letterSpacing: 0.96,
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
})
