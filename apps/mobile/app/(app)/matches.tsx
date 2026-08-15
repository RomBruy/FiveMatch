import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../components/ui/SecondaryButton'
import { PressableScale } from '../../components/ui/PressableScale'
import { SkeletonRow } from '../../components/ui/Skeleton'
import { StaggerItem } from '../../components/ui/Stagger'
import { FormDots } from '../../components/ui/FormDots'
import { DOCK_CLEARANCE } from '../../components/ui/TabDock'
import { MatchCard } from '../../components/match/MatchCard'
import { NeedsAttention } from '../../components/match/NeedsAttention'
import { useMyMatches, type MyMatch } from '../../lib/matches'

/**
 * MES MATCHS — everything the user has a stake in, hosted or joined, crew or open.
 *
 * The old Match tab only ever showed the active crew's fixtures, so a player who
 * grabbed a spot across town had nowhere to find it again. Scope is the user now,
 * not the group.
 */
export default function MyMatchesTab() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  // The profile's "Mon historique" row deep-links straight into the past scope.
  const { scope: scopeParam } = useLocalSearchParams<{ scope?: string }>()
  const [scope, setScope] = useState<'upcoming' | 'past'>(
    scopeParam === 'past' ? 'past' : 'upcoming',
  )
  const [refreshing, setRefreshing] = useState(false)

  const { data: matches, isLoading, refetch } = useMyMatches(scope)

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
    } finally {
      setRefreshing(false)
    }
  }, [refetch])

  const openMatch = (matchId: string) => router.push(`/(app)/match/${matchId}` as never)

  const formatPastDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric' }).toUpperCase()

  // The tally the history never had. Only matches the viewer actually played
  // carry a result, so hosted-but-not-played fixtures never inflate the record.
  const record = (matches ?? []).reduce(
    (acc, m) => {
      if (m.userResult === 'win') acc.win += 1
      else if (m.userResult === 'draw') acc.draw += 1
      else if (m.userResult === 'loss') acc.loss += 1
      return acc
    },
    { win: 0, draw: 0, loss: 0 },
  )
  const played = record.win + record.draw + record.loss

  // Grouped by month so a long history reads as a season rather than a list.
  const byMonth: { key: string; label: string; items: MyMatch[] }[] = []
  for (const match of matches ?? []) {
    const date = new Date(match.scheduledAt)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    const existing = byMonth.find((g) => g.key === key)
    if (existing) existing.items.push(match)
    else byMonth.push({
      key,
      label: date.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' }),
      items: [match],
    })
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
      }
    >
      <Text style={styles.title}>
        {t('myMatches.title')}<Text style={styles.titleAccent}>.</Text>
      </Text>

      {scope === 'upcoming' && <NeedsAttention />}

      {/* Two round chips read as optional filters, which is why the history was
          never found. A segmented control reads as two halves of one thing. */}
      <View style={styles.seg} accessibilityRole="tablist">
        {(['upcoming', 'past'] as const).map((value) => {
          const on = scope === value
          return (
            <PressableScale
              key={value}
              onPress={() => setScope(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[styles.segItem, on && styles.segItemOn]}
            >
              <Text style={[styles.segText, on && styles.segTextOn]}>
                {value === 'upcoming' ? t('myMatches.upcoming') : t('myMatches.past')}
              </Text>
            </PressableScale>
          )
        })}
      </View>

      {isLoading ? (
        <View style={styles.list}>
          <SkeletonRow card />
          <SkeletonRow card />
        </View>
      ) : !matches || matches.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {scope === 'upcoming' ? t('myMatches.empty.upcomingTitle') : t('myMatches.empty.pastTitle')}
          </Text>
          {scope === 'upcoming' && (
            <>
              <Text style={styles.emptyText}>{t('myMatches.empty.upcomingBody')}</Text>
              <PrimaryButton
                label={t('discover.title')}
                onPress={() => router.push('/(app)' as never)}
                glow={false}
              />
              <SecondaryButton
                label={t('discover.createMatch')}
                onPress={() => router.push('/(app)/match/create' as never)}
              />
            </>
          )}
        </View>
      ) : scope === 'upcoming' ? (
        <View style={styles.list}>
          {matches.map((match, index) => (
            <StaggerItem key={match.matchId} index={Math.min(index, 6)}>
              <View>
                <MatchCard
                  scheduledAt={match.scheduledAt}
                  venueName={null}
                  city={match.city}
                  location={null}
                  distanceKm={null}
                  format={match.format}
                  skillLevel={match.skillLevel}
                  pricePerPlayer={null}
                  confirmedCount={match.confirmedCount}
                  capacity={match.capacity}
                  spotsRemaining={Math.max(0, match.capacity - match.confirmedCount)}
                  joined={match.myStatus === 'in'}
                  onPress={() => openMatch(match.matchId)}
                />
                <View style={styles.badges}>
                  {match.isHost && (
                    <View style={[styles.badge, styles.hostBadge]}>
                      <Text style={styles.hostBadgeText}>{t('match.role.host')}</Text>
                    </View>
                  )}
                  {match.visibility === 'public' && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{t('match.published')}</Text>
                    </View>
                  )}
                  {match.myStatus === 'unknown' && !match.isHost && (
                    <View style={[styles.badge, styles.actionBadge]}>
                      <Text style={styles.actionBadgeText}>{t('match.needsAnswer')}</Text>
                    </View>
                  )}
                </View>
              </View>
            </StaggerItem>
          ))}
        </View>
      ) : (
        <View>
          {/* The season, before the list of nights that made it. */}
          {played > 0 && (
            <View style={styles.season}>
              <View style={styles.seasonCount}>
                <Text style={styles.seasonBig}>{played}</Text>
                <Text style={styles.seasonLabel}>{t('myMatches.season.played').toUpperCase()}</Text>
              </View>
              <View style={styles.seasonRight}>
                <View style={styles.wdl}>
                  <Text style={[styles.wdlPill, styles.wdlWin]}>
                    {t('myMatches.season.win', { count: record.win })}
                  </Text>
                  <Text style={[styles.wdlPill, styles.wdlDraw]}>
                    {t('myMatches.season.draw', { count: record.draw })}
                  </Text>
                  <Text style={[styles.wdlPill, styles.wdlLoss]}>
                    {t('myMatches.season.loss', { count: record.loss })}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {byMonth.map((group) => (
            <View key={group.key}>
              <Text style={styles.monthLabel}>{group.label.toUpperCase()}</Text>
              <View style={styles.list}>
                {group.items.map((match) => (
                  <PressableScale
                    key={match.matchId}
                    style={styles.pastRow}
                    onPress={() => openMatch(match.matchId)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.pastDate}>{formatPastDate(match.scheduledAt)}</Text>
                    <Text style={styles.pastPlace} numberOfLines={1}>
                      {match.city ?? ''}
                    </Text>
                    <Text style={styles.pastScore}>
                      {match.scoreA !== null && match.scoreB !== null ? `${match.scoreA}–${match.scoreB}` : '—'}
                    </Text>
                    <View style={styles.pastDot}>
                      {match.userResult && (
                        <FormDots
                          results={[
                            match.userResult === 'win' ? 'W'
                              : match.userResult === 'draw' ? 'D' : 'L',
                          ]}
                          size={22}
                        />
                      )}
                    </View>
                  </PressableScale>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: DOCK_CLEARANCE,
  },
  title: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 40,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  titleAccent: {
    color: Colors.primary,
  },
  seg: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 16,
    marginBottom: 20,
    padding: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
  },
  segItem: {
    flex: 1,
    height: 38,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segItemOn: { backgroundColor: Colors.primary },
  segText: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  segTextOn: { color: Colors.onPrimary },
  season: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    marginBottom: 22,
    borderRadius: Radius.card,
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1,
    borderColor: 'rgba(255,68,56,0.22)',
  },
  seasonCount: { alignItems: 'center' },
  seasonBig: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 46,
    lineHeight: 48,
    fontVariant: ['tabular-nums'],
  },
  seasonLabel: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 9,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  seasonRight: { flex: 1 },
  wdl: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  wdlPill: {
    borderRadius: Radius.full,
    paddingHorizontal: 11,
    paddingVertical: 6,
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    overflow: 'hidden',
  },
  wdlWin: { backgroundColor: Colors.successSubtle, color: Colors.success },
  wdlDraw: { backgroundColor: Colors.surfaceRaised, color: Colors.inkSecondary },
  wdlLoss: { backgroundColor: Colors.primarySubtle, color: Colors.primary },
  monthLabel: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 10,
    marginTop: 6,
  },
  list: {
    gap: 12,
    marginBottom: 18,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  badge: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  badgeText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.inkSecondary,
  },
  hostBadge: {
    backgroundColor: Colors.primarySubtle,
  },
  hostBadgeText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.primary,
  },
  actionBadge: {
    backgroundColor: Colors.successSubtle,
  },
  actionBadgeText: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: Colors.success,
  },
  empty: {
    gap: 14,
    paddingVertical: 24,
  },
  emptyTitle: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 26,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  emptyText: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.inter,
    fontSize: 14,
    lineHeight: 20,
  },
  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  pastDate: {
    width: 60,
    color: Colors.inkSecondary,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.4,
  },
  pastPlace: {
    flex: 1,
    color: Colors.inkSecondary,
    fontSize: 11.5,
    fontFamily: Fonts.inter,
  },
  pastScore: {
    fontFamily: Fonts.bebas,
    fontSize: 24,
    letterSpacing: 1.44,
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
  pastDot: {
    width: 22,
    alignItems: 'center',
  },
})
