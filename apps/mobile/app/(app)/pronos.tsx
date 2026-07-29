import { View, Text, StyleSheet, RefreshControl } from 'react-native'
import Animated from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, Radius, Type } from '../../constants/tokens'
import { useGroupContext } from '../../contexts/GroupContext'
import { DOCK_CLEARANCE } from '../../components/ui/TabDock'
import { Chip } from '../../components/ui/Chip'
import { PressableScale } from '../../components/ui/PressableScale'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../components/ui/SecondaryButton'
import { Skeleton, SkeletonCard, SkeletonRow } from '../../components/ui/Skeleton'
import { CountUpNumber } from '../../components/ui/CountUpNumber'
import { StaggerItem } from '../../components/ui/Stagger'
import { TextureType } from '../../components/ui/TextureType'
import { CollapsingHeader, CollapsingHeaderTitle, useCollapsingHeader } from '../../components/ui/CollapsingHeader'
import { BankrollLeaderboard } from '../../components/pronos/BankrollLeaderboard'
import { httpClient } from '../../lib/api-client'
import { haptics } from '../../lib/haptics'

const SEPARATOR = ' · '

type PronosSegment = 'markets' | 'leaderboard'

interface UpcomingMatch {
  matchId: string
  status: string
  scheduledAt: string
  location: string | null
  format: string
  playersPerTeam: number
  seriesId: string | null
}

interface SettledMatch {
  matchId: string
  scheduledAt: string
  scoreA: number | null
  scoreB: number | null
  mvpDisplayName: string | null
}

/**
 * The odds route (`GET pronos/odds`) 422s with ODDS_NOT_AVAILABLE until `teamAOvrAtLock`
 * is set, which happens on the `teams_generated` transition. The upcoming-matches payload
 * carries `status` but not the OVR snapshot, so that status IS the market-open proxy —
 * it matches the route's own precondition exactly, so a card here never opens onto a 422.
 */
function isMarketOpen(match: UpcomingMatch, now: number): boolean {
  return match.status === 'teams_generated' && new Date(match.scheduledAt).getTime() > now
}

export default function PronosTab() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { activeGroupId } = useGroupContext()
  const [refreshing, setRefreshing] = useState(false)
  const [segment, setSegment] = useState<PronosSegment>('markets')
  // The cascade belongs to the screen's first reveal, not to every segment switch.
  const hasEnteredRef = useRef(false)
  const { scrollY, scrollHandler } = useCollapsingHeader()

  // Shared keys with Accueil and the Match tab — this tab is warm from cache, no new endpoint.
  const { data: upcomingData, isLoading: upcomingLoading } = useQuery({
    queryKey: ['matches', activeGroupId, 'upcoming'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { matches: UpcomingMatch[] } }>(
        `/v1/groups/${activeGroupId}/matches?status=upcoming&limit=10`,
      )
      return data.data
    },
    enabled: !!activeGroupId,
    retry: false,
  })

  // Group-scoped bankroll (Story 11.5) — the same cache entry the betting screen writes
  // the post-bet balance into, so the numeral counts up on return without a refetch.
  const { data: bankroll } = useQuery({
    queryKey: ['pronos-bankroll', activeGroupId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { balance: number; startingBankroll: number } }>(
        `/v1/groups/${activeGroupId}/pronos/bankroll`,
      )
      return data.data
    },
    enabled: !!activeGroupId,
  })

  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['match-history', activeGroupId],
    queryFn: () =>
      httpClient
        .get<{ data: { matches: SettledMatch[] } }>(`/v1/groups/${activeGroupId}/matches?status=completed&limit=10`)
        .then((r) => r.data.data),
    enabled: !!activeGroupId,
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['matches', activeGroupId] }),
        queryClient.refetchQueries({ queryKey: ['match-history', activeGroupId] }),
        queryClient.refetchQueries({ queryKey: ['pronos-bankroll', activeGroupId] }),
        ...(segment === 'leaderboard'
          ? [queryClient.refetchQueries({ queryKey: ['pronos', 'leaderboard', activeGroupId] })]
          : []),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [queryClient, activeGroupId, segment])

  // Blocks below the segmented control remount when the segment flips, so the entrance
  // cascade is disabled once the screen's first content reveal has played.
  useEffect(() => {
    if (!upcomingLoading && !historyLoading) hasEnteredRef.current = true
  }, [upcomingLoading, historyLoading])

  const switchSegment = (next: PronosSegment) => {
    if (next === segment) return
    haptics.selection()
    setSegment(next)
  }

  const formatKickoff = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })

  const formatShortDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }).toUpperCase()

  /** Compact "closes in" label. Abbreviated units keep it plural-free across FR/EN. */
  const formatClosesIn = (iso: string): string | null => {
    const ms = new Date(iso).getTime() - Date.now()
    if (ms <= 0) return null
    const totalMinutes = Math.floor(ms / 60_000)
    const days = Math.floor(totalMinutes / 1440)
    if (days >= 1) return t('pronos.tab.closesInDays', { days })
    const hours = Math.floor(totalMinutes / 60)
    if (hours >= 1) {
      return t('pronos.tab.closesInHours', { hours, minutes: String(totalMinutes % 60).padStart(2, '0') })
    }
    return t('pronos.tab.closesInMinutes', { minutes: totalMinutes })
  }

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

  const now = Date.now()
  const upcoming = upcomingData?.matches ?? []
  const openMarkets = upcoming.filter((m) => isMarketOpen(m, now))
  const pendingMarkets = upcoming.filter((m) => !isMarketOpen(m, now))
  const settled = historyData?.matches ?? []
  const isBodyLoading = upcomingLoading || historyLoading

  // Into the odds board (Story 11.5), or its settlement reveal once the match is played
  // (Story 11.6) — the same route decides. Never the match-detail placeholder.
  const openMatch = (matchId: string) => router.push(`/(app)/pronos/${matchId}` as never)

  const isLeaderboard = segment === 'leaderboard'

  return (
    <View style={styles.container}>
      {/* The screen's ONE texture element: outline watermark, renamed per segment. */}
      <TextureType
        lines={[{ text: isLeaderboard ? t('pronos.tab.leaderboardTexture') : t('pronos.tab.title') }]}
        fontSize={160}
        style={styles.texture}
      />

      <Animated.ScrollView
        style={styles.scroll}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
        }
      >
        <StaggerItem index={0}>
          <CollapsingHeaderTitle title={t('pronos.tab.title')} scrollY={scrollY} />
        </StaggerItem>

        <View style={styles.segments}>
          <Chip
            label={t('pronos.tab.segmentMarkets')}
            active={!isLeaderboard}
            onPress={() => switchSegment('markets')}
          />
          <Chip
            label={t('pronos.tab.segmentLeaderboard')}
            active={isLeaderboard}
            onPress={() => switchSegment('leaderboard')}
          />
        </View>

        {isLeaderboard ? (
          <StaggerItem index={1} enabled={!hasEnteredRef.current} style={styles.section}>
            <Text style={styles.sectionLabel}>{t('pronos.leaderboard.title')}</Text>
            <BankrollLeaderboard groupId={activeGroupId} />
          </StaggerItem>
        ) : (
          <>
          <StaggerItem index={1} enabled={!hasEnteredRef.current} style={styles.balanceBlock}>
            <Text style={styles.balanceLabel}>{t('pronos.tab.balanceLabel')}</Text>
            <View style={styles.balanceRow}>
              {/*
                The screen's ONE numeral. The skeleton stands in only until the bankroll
                query lands — never as a substitute for a real zero, which would read as a
                bankrupt balance rather than a loading one.
              */}
              {bankroll === undefined ? (
                <Skeleton width={124} height={54} radius={Radius.sm} />
              ) : (
                <CountUpNumber
                  value={bankroll.balance}
                  style={styles.balanceNumeral}
                  accessibilityLabel={`${bankroll.balance} ${t('pronos.tab.balanceUnit')}`}
                />
              )}
              <Text style={styles.balanceUnit}>{t('pronos.tab.balanceUnit')}</Text>
            </View>
          </StaggerItem>

          <StaggerItem index={2} enabled={!hasEnteredRef.current} style={styles.section}>
            <Text style={styles.sectionLabel}>{t('pronos.tab.openTitle')}</Text>

            {isBodyLoading && (
              <View style={styles.skeletonBlock}>
                <SkeletonCard height={104} />
                <SkeletonRow card />
              </View>
            )}

            {!isBodyLoading && openMarkets.map((match) => {
              const closesIn = formatClosesIn(match.scheduledAt)
              return (
                <PressableScale
                  key={match.matchId}
                  style={styles.openCard}
                  onPress={() => openMatch(match.matchId)}
                  accessibilityRole="button"
                  accessibilityLabel={t('pronos.tab.openCardA11y', { date: formatKickoff(match.scheduledAt) })}
                >
                  <View style={styles.openCardHead}>
                    <View style={styles.openCardHeadText}>
                      <Text style={styles.openCardTitle} numberOfLines={1}>{formatKickoff(match.scheduledAt)}</Text>
                      <Text style={styles.openCardMeta} numberOfLines={1}>
                        {[match.format.toUpperCase(), ...(match.location ? [match.location] : [])].join(SEPARATOR)}
                      </Text>
                    </View>
                    {closesIn && (
                      <View style={styles.countPill}>
                        <View style={styles.countDot} />
                        <Text style={styles.countPillText}>{closesIn}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.marketsRow}>
                    <Text style={styles.marketsText} numberOfLines={1}>{t('pronos.tab.markets')}</Text>
                    <Ionicons name="chevron-forward" size={15} color={Colors.inkDisabled} />
                  </View>
                </PressableScale>
              )
            })}

            {!isBodyLoading && pendingMarkets.map((match) => (
              <View key={match.matchId} style={styles.pendingRow}>
                <View style={styles.pendingText}>
                  <Text style={styles.pendingTitle} numberOfLines={1}>{formatKickoff(match.scheduledAt)}</Text>
                  <Text style={styles.pendingMeta} numberOfLines={1}>{t('pronos.tab.pendingHint')}</Text>
                </View>
                <Ionicons name="time-outline" size={16} color={Colors.inkDisabled} />
              </View>
            ))}

            {!isBodyLoading && upcoming.length === 0 && (
              <View style={styles.emptyBlock}>
                <Text style={styles.emptyText}>{t('pronos.tab.openEmpty')}</Text>
                <SecondaryButton
                  label={t('pronos.tab.openEmptyCta')}
                  onPress={() => router.push('/(app)/match' as never)}
                />
              </View>
            )}
          </StaggerItem>

          <StaggerItem index={3} enabled={!hasEnteredRef.current} style={styles.section}>
            <Text style={styles.sectionLabel}>{t('pronos.tab.settledTitle')}</Text>

            {isBodyLoading && (
              <View style={styles.skeletonBlock}>
                <SkeletonRow card />
                <SkeletonRow card />
              </View>
            )}

            {!isBodyLoading && settled.map((match) => (
              <PressableScale
                key={match.matchId}
                style={styles.settledRow}
                onPress={() => openMatch(match.matchId)}
                accessibilityRole="button"
              >
                <Text style={styles.settledDate}>{formatShortDate(match.scheduledAt)}</Text>
                <Text style={styles.settledMeta} numberOfLines={1}>
                  {match.mvpDisplayName ?? t('pronos.tab.settledNoMvp')}
                </Text>
                <Text style={styles.settledScore}>
                  {match.scoreA !== null && match.scoreB !== null ? `${match.scoreA}–${match.scoreB}` : '—'}
                </Text>
              </PressableScale>
            ))}

            {!isBodyLoading && settled.length === 0 && (
              <Text style={styles.emptyText}>{t('pronos.tab.settledEmpty')}</Text>
            )}
          </StaggerItem>
          </>
        )}
      </Animated.ScrollView>

      <CollapsingHeader title={t('pronos.tab.title')} scrollY={scrollY} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, overflow: 'hidden' },
  texture: { top: 96, left: -30 },
  scroll: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: DOCK_CLEARANCE },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
    justifyContent: 'center',
    padding: 24,
    gap: 24,
    paddingBottom: DOCK_CLEARANCE,
  },
  message: { color: Colors.ink, fontSize: 15, fontFamily: Fonts.inter, textAlign: 'center' },
  segments: { flexDirection: 'row', gap: 8, marginTop: 14 },
  balanceBlock: { marginTop: 18 },
  balanceLabel: {
    color: Colors.inkSecondary,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  balanceNumeral: {
    color: Colors.ink,
    fontSize: 72,
    fontFamily: Type.numeral.fontFamily,
    letterSpacing: -0.72, // -0.01em @ 72 (numeral register)
    fontVariant: ['tabular-nums'],
  },
  balanceUnit: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: Fonts.inter,
    paddingBottom: 9,
  },
  section: { marginTop: 28 },
  sectionLabel: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  skeletonBlock: { gap: 8 },
  openCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  openCardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  openCardHeadText: { flex: 1, minWidth: 0, gap: 3 },
  openCardTitle: { color: Colors.ink, fontSize: 14.5, fontFamily: Fonts.interSemiBold },
  openCardMeta: { color: Colors.inkSecondary, fontSize: 12, fontFamily: Fonts.inter },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countDot: { width: 5, height: 5, borderRadius: Radius.full, backgroundColor: Colors.primary },
  countPillText: {
    color: Colors.primary,
    fontSize: 12,
    fontFamily: Type.stat.fontFamily,
    letterSpacing: 0.48, // 0.04em @ 12 (stat register)
  },
  marketsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.hairline,
  },
  marketsText: {
    flex: 1,
    color: Colors.inkSecondary,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    opacity: 0.72,
  },
  pendingText: { flex: 1, minWidth: 0, gap: 2 },
  pendingTitle: { color: Colors.inkSecondary, fontSize: 14, fontFamily: Fonts.interSemiBold },
  pendingMeta: { color: Colors.inkDisabled, fontSize: 11.5, fontFamily: Fonts.inter },
  settledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
  },
  settledDate: {
    width: 58,
    color: Colors.inkSecondary,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.4,
  },
  settledMeta: { flex: 1, color: Colors.inkSecondary, fontSize: 11.5, fontFamily: Fonts.interSemiBold },
  settledScore: {
    color: Colors.ink,
    fontSize: 22,
    fontFamily: Type.stat.fontFamily,
    letterSpacing: 0.88, // 0.04em @ 22 (stat register)
    fontVariant: ['tabular-nums'],
  },
  emptyBlock: { gap: 14, paddingVertical: 6 },
  emptyText: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: Fonts.inter,
    paddingVertical: 10,
  },
})
