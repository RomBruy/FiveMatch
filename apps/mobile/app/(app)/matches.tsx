import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { Chip } from '../../components/ui/Chip'
import { PrimaryButton } from '../../components/ui/PrimaryButton'
import { SecondaryButton } from '../../components/ui/SecondaryButton'
import { PressableScale } from '../../components/ui/PressableScale'
import { SkeletonRow } from '../../components/ui/Skeleton'
import { StaggerItem } from '../../components/ui/Stagger'
import { FormDots } from '../../components/ui/FormDots'
import { DOCK_CLEARANCE } from '../../components/ui/TabDock'
import { MatchCard } from '../../components/match/MatchCard'
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
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming')
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
    new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }).toUpperCase()

  const resultOf = (match: MyMatch) => {
    if (match.scoreA === null || match.scoreB === null) return null
    if (match.scoreA === match.scoreB) return 'D' as const
    return null // team side isn't in this payload — score alone carries the story
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

      <View style={styles.tabs}>
        <Chip
          label={t('myMatches.upcoming')}
          active={scope === 'upcoming'}
          onPress={() => setScope('upcoming')}
        />
        <Chip
          label={t('myMatches.past')}
          active={scope === 'past'}
          onPress={() => setScope('past')}
        />
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
        <View style={styles.list}>
          {matches.map((match) => (
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
                {resultOf(match) && <FormDots results={[resultOf(match)!]} size={22} />}
              </View>
            </PressableScale>
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
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    marginBottom: 20,
  },
  list: {
    gap: 12,
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
