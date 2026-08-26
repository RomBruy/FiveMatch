import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { PRONOS_MAX_STAKE } from '@fivematch/types/algorithm-constants'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius, Type } from '../../../constants/tokens'
import { httpClient } from '../../../lib/api-client'
import { PressableScale } from '../../../components/ui/PressableScale'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Skeleton } from '../../../components/ui/Skeleton'
import { CountUpNumber } from '../../../components/ui/CountUpNumber'

const HOW_IT_WORKS_KEY = 'pronos.howItWorks.dismissed'
/** Placing this many bets is proof enough that the rules landed. */
const HOW_IT_WORKS_BET_THRESHOLD = 3

interface OpenMarket {
  matchId: string
  scheduledAt: string
  city: string | null
  venueName: string | null
  format: string
  hasOpenBet: boolean
}

interface FeedBet {
  id: string
  matchId: string
  market: string
  selection: string
  stake: number
  oddsAtBet: number
  status: string
  payout: number | null
  placedAt: string
  scheduledAt: string
  city: string | null
  venueName: string | null
}

interface PronosFeed {
  balance: number
  startingBankroll: number
  openMarkets: OpenMarket[]
  bets: FeedBet[]
}

function usePronosFeed() {
  return useQuery({
    queryKey: ['pronos', 'feed'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: PronosFeed }>('/v1/players/me/pronos')
      return data.data
    },
  })
}

/**
 * The Pronos tab.
 *
 * Betting still happens inside a match, where the odds are priced — this is the
 * index that never existed while every pronos route was match-scoped. Before it,
 * the bankroll was displayed nowhere in the app and the betting board was
 * reachable only by drilling into a fixture.
 */
export default function PronosScreen() {
  const { t, i18n } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { data, isLoading } = usePronosFeed()
  const [refreshing, setRefreshing] = useState(false)
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    void AsyncStorage.getItem(HOW_IT_WORKS_KEY).then((v) => setDismissed(v === '1'))
  }, [])

  const dismissHowItWorks = useCallback(() => {
    setDismissed(true)
    void AsyncStorage.setItem(HOW_IT_WORKS_KEY, '1')
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await queryClient.refetchQueries({ queryKey: ['pronos'] })
    setRefreshing(false)
  }, [queryClient])

  const dateLabel = (iso: string) =>
    new Date(iso)
      .toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' })
      .toUpperCase()

  const pending = data?.bets.filter((bet) => bet.status === 'pending') ?? []
  const settled = data?.bets.filter((bet) => bet.status !== 'pending') ?? []

  // Shown until explicitly dismissed, or until the bets themselves prove the
  // rules are understood. `dismissed === null` means storage has not answered
  // yet — render nothing rather than flashing the block on every cold start.
  const showHowItWorks =
    dismissed === false && (data === undefined || data.bets.length < HOW_IT_WORKS_BET_THRESHOLD)

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
    >
      <Text style={styles.title}>{t('pronos.title')}</Text>
      <Text style={styles.subtitle}>{t('pronos.subtitle')}</Text>

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>{t('pronos.balance').toUpperCase()}</Text>
        {isLoading || data === undefined ? (
          // Never a fake zero while loading — a bankroll of 0 means something.
          <Skeleton width={140} height={48} />
        ) : (
          <CountUpNumber value={data.balance} style={styles.balanceValue} />
        )}
      </View>

      {/* How this works.
          The tab showed a balance of 1000 and an empty list, and never said what
          you were waiting for: odds only exist once the organiser draws the
          teams, and they close at kick-off. That window was documented nowhere
          in the app. Dismissible, and gone for good once you have bet a few
          times — an explanation that will not leave is an explanation that
          becomes furniture. */}
      {showHowItWorks && (
        <View style={styles.how}>
          <View style={styles.howHead}>
            <Text style={styles.howTitle}>{t('pronos.how.title').toUpperCase()}</Text>
            <PressableScale
              onPress={dismissHowItWorks}
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.howDismiss}>{t('pronos.how.dismiss')}</Text>
            </PressableScale>
          </View>
          {(['open', 'stake', 'settle'] as const).map((step, index) => (
            <View key={step} style={styles.howStep}>
              <Text style={styles.howNum}>{index + 1}</Text>
              <View style={styles.howText}>
                <Text style={styles.howStepTitle}>{t(`pronos.how.${step}.title`)}</Text>
                <Text style={styles.howStepBody}>
                  {t(`pronos.how.${step}.body`, { max: PRONOS_MAX_STAKE })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.sectionLabel}>{t('pronos.openMarkets').toUpperCase()}</Text>
      {isLoading ? (
        <Skeleton width="100%" height={72} />
      ) : (data?.openMarkets.length ?? 0) === 0 ? (
        // Pronos spends most of its life with no locked match, so this is the
        // screen people actually see. A bare "no markets" line taught nothing;
        // the betting window — when odds open, when they close — was documented
        // nowhere in the app, and it is the first thing everyone asks.
        <EmptyState title={t('pronos.empty.title')} body={t('pronos.empty.body')} />
      ) : (
        data!.openMarkets.map((market) => (
          <PressableScale
            key={market.matchId}
            onPress={() => router.push(`/(app)/pronos/${market.matchId}` as never)}
            style={styles.row}
          >
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {market.venueName ?? market.city ?? t('pronos.match')}
              </Text>
              <Text style={styles.rowMeta}>{dateLabel(market.scheduledAt)} · {market.format}</Text>
            </View>
            {market.hasOpenBet && (
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            )}
            <Ionicons name="chevron-forward" size={16} color={Colors.inkDisabled} />
          </PressableScale>
        ))
      )}

      {pending.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>{t('pronos.pendingBets').toUpperCase()}</Text>
          {pending.map((bet) => (
            <View key={bet.id} style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>{bet.selection}</Text>
                <Text style={styles.rowMeta}>
                  {t('pronos.stake', { stake: bet.stake })} · {bet.oddsAtBet.toFixed(2)}
                </Text>
              </View>
              <Text style={styles.potential}>
                +{Math.round(bet.stake * bet.oddsAtBet)}
              </Text>
            </View>
          ))}
        </>
      )}

      {settled.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>{t('pronos.settledBets').toUpperCase()}</Text>
          {settled.map((bet) => {
            const net = (bet.payout ?? 0) - bet.stake
            return (
              <View key={bet.id} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{bet.selection}</Text>
                  <Text style={styles.rowMeta}>{dateLabel(bet.scheduledAt)}</Text>
                </View>
                <Text style={[styles.net, net > 0 ? styles.netUp : styles.netDown]}>
                  {net > 0 ? '+' : ''}{net}
                </Text>
              </View>
            )
          })}
        </>
      )}

      <View style={{ height: insets.bottom + 96 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 20, gap: 12 },
  title: {
    fontFamily: Fonts.bebas,
    fontSize: Type.display.maxSize,
    color: Colors.ink,
  },
  balanceCard: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.card,
    padding: 20,
    gap: 6,
  },
  balanceLabel: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: Colors.inkSecondary,
  },
  balanceValue: {
    fontFamily: Fonts.bebas,
    fontSize: 48,
    color: Colors.ink,
  },
  subtitle: {
    fontFamily: Fonts.inter,
    fontSize: 13.5,
    lineHeight: 19,
    color: Colors.inkSecondary,
    marginTop: -6,
  },
  how: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: 16,
    gap: 13,
  },
  howHead: { flexDirection: 'row', alignItems: 'center' },
  howTitle: {
    flex: 1,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.primary,
  },
  howDismiss: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.inkSecondary,
  },
  howStep: { flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  howNum: {
    width: 22,
    height: 22,
    borderRadius: Radius.full,
    backgroundColor: Colors.primarySubtle,
    color: Colors.primary,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Fonts.interBold,
    fontSize: 11,
    overflow: 'hidden',
  },
  howText: { flex: 1, gap: 2 },
  howStepTitle: { fontFamily: Fonts.interSemiBold, fontSize: 13, color: Colors.ink },
  howStepBody: {
    fontFamily: Fonts.inter,
    fontSize: 11.5,
    lineHeight: 16,
    color: Colors.inkSecondary,
  },
  sectionLabel: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: Colors.inkSecondary,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowText: { flex: 1, gap: 3 },
  rowTitle: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 14,
    color: Colors.ink,
  },
  rowMeta: {
    fontFamily: Fonts.inter,
    fontSize: 11,
    color: Colors.inkDisabled,
  },
  potential: {
    fontFamily: Fonts.bebas,
    fontSize: 20,
    color: Colors.success,
  },
  net: {
    fontFamily: Fonts.bebas,
    fontSize: 20,
  },
  netUp: { color: Colors.success },
  netDown: { color: Colors.inkSecondary },
})
