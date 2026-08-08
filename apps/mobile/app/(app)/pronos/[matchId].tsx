import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PRONOS_MAX_STAKE } from '@fivematch/types/algorithm-constants'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius, Type } from '../../../constants/tokens'
import { useGroupContext } from '../../../contexts/GroupContext'
import { httpClient } from '../../../lib/api-client'
import { haptics } from '../../../lib/haptics'
import { DOCK_CLEARANCE } from '../../../components/ui/TabDock'
import { CountdownPill } from '../../../components/ui/CountdownPill'
import { PressableScale } from '../../../components/ui/PressableScale'
import { SecondaryButton } from '../../../components/ui/SecondaryButton'
import { SkeletonCard, SkeletonRow } from '../../../components/ui/Skeleton'
import { StaggerItem } from '../../../components/ui/Stagger'
import { MarketSelection, formatOdds } from '../../../components/pronos/MarketSelection'
import { BetSlipSheet, type SlipSelection } from '../../../components/pronos/BetSlipSheet'
import { SettlementReveal, type RevealData } from '../../../components/pronos/SettlementReveal'

type BetMarket = 'result' | 'score' | 'mvp'

interface ScoreLine {
  scoreA: number
  scoreB: number
  selection: string
  odds: number
}

interface MvpLine {
  playerId: string
  displayName: string
  odds: number
}

interface OddsBoard {
  result: { teamA: number; draw: number; teamB: number }
  scores: ScoreLine[]
  mvp: MvpLine[]
  teams: { teamAOvr: number; teamBOvr: number }
  window: { open: boolean; closesAt: string }
}

interface MyBet {
  id: string
  market: BetMarket
  selection: string
  stake: number
  oddsAtBet: number
  status: 'pending' | 'won' | 'lost' | 'close'
  payout: number | null
}

/** The error envelope every API route returns; `undefined` for network/timeout failures. */
function errorCodeOf(err: unknown): string | undefined {
  return (err as { response?: { data?: { error?: { code?: string } } } }).response?.data?.error?.code
}

/** The bar sits above the floating dock; content must clear both. */
const SELECTION_BAR_HEIGHT = 68

export default function BettingScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const { activeGroupId } = useGroupContext()
  const { matchId } = useLocalSearchParams<{ matchId: string }>()

  const [selected, setSelected] = useState<SlipSelection | null>(null)
  const [slipOpen, setSlipOpen] = useState(false)
  const [slipError, setSlipError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  /** Set by the ticking clock OR by a server 422 — the server is the authority. */
  const [closed, setClosed] = useState(false)

  const enabled = Boolean(activeGroupId) && Boolean(matchId)

  const {
    data: board,
    isLoading: boardLoading,
    error: boardError,
  } = useQuery<OddsBoard>({
    queryKey: ['pronos-odds', activeGroupId, matchId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: OddsBoard }>(
        `/v1/matches/${matchId}/pronos/odds`,
      )
      return data.data
    },
    enabled,
    retry: false,
  })

  // Fired in PARALLEL with the board, not after it: the reveal answers 200 with a `settled`
  // flag rather than 403-ing, so choosing the screen's mode costs no extra round trip.
  const { data: reveal, isLoading: revealLoading } = useQuery<RevealData>({
    queryKey: ['pronos-reveal', activeGroupId, matchId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: RevealData }>(
        `/v1/matches/${matchId}/pronos/bets/reveal`,
      )
      return data.data
    },
    enabled,
    retry: false,
  })

  const settled = reveal?.settled === true

  // Only the board needs this: once settled, the reveal payload carries the same bets with
  // their outcomes, so the pending-only view has nothing left to show.
  const { data: betsData } = useQuery({
    queryKey: ['pronos-bets', activeGroupId, matchId],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { bets: MyBet[]; balance: number } }>(
        `/v1/matches/${matchId}/pronos/bets/my`,
      )
      return data.data
    },
    enabled: enabled && !settled,
  })

  // One global bankroll per player, not one per crew — the identity that owns it
  // is global now, and a player betting on an open match has no crew to scope to.
  const { data: bankroll } = useQuery({
    queryKey: ['pronos-bankroll'],
    queryFn: async () => {
      const { data } = await httpClient.get<{ data: { balance: number; startingBankroll: number } }>(
        '/v1/players/me/bankroll',
      )
      return data.data
    },
  })

  // The settlement flourish, once per mount — a refetch or a re-render must not re-buzz.
  const revealBuzzed = useRef(false)
  useEffect(() => {
    if (settled && !revealBuzzed.current) {
      revealBuzzed.current = true
      haptics.success()
    }
  }, [settled])

  const closesAt = board?.window.closesAt ?? null
  const windowOpen = board?.window.open ?? false

  // Lock-state tick — the CountdownPill owns only its own display (Story 6.1 contract).
  useEffect(() => {
    if (!closesAt) return
    if (!windowOpen || new Date(closesAt).getTime() <= Date.now()) {
      setClosed(true)
      return
    }
    setClosed(false)
    const interval = setInterval(() => {
      if (new Date(closesAt).getTime() - Date.now() <= 0) {
        setClosed(true)
        clearInterval(interval)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [closesAt, windowOpen])

  const lockScale = useSharedValue(0.8)
  useEffect(() => {
    if (closed) lockScale.value = withSpring(1, { mass: 1, damping: 15, stiffness: 200 })
  }, [closed, lockScale])
  const lockStyle = useAnimatedStyle(() => ({ transform: [{ scale: lockScale.value }] }))

  useEffect(() => {
    if (closed) {
      setSelected(null)
      setSlipOpen(false)
    }
  }, [closed])

  const balance = bankroll?.balance ?? betsData?.balance ?? 0

  const marketLabels = useMemo(
    () => ({
      result: t('pronos.resultLabel'),
      score: t('pronos.scoreLabel'),
      mvp: t('pronos.board.mvpLabel'),
    }),
    [t],
  )

  const placeBet = useMutation({
    mutationFn: async ({ pick, stake }: { pick: SlipSelection; stake: number }) => {
      // No odds field — the server freezes the price (Story 11.3 AC4).
      const { data } = await httpClient.post<{ data: { balance: number } }>(
        `/v1/matches/${matchId}/pronos/bets`,
        { market: pick.market, selection: pick.selection, stake },
      )
      return data.data
    },
    onSuccess: (data) => {
      haptics.impact('Medium')
      // The server's post-debit balance is the truth; CountUpNumber climbs to it in the tab.
      queryClient.setQueryData(['pronos-bankroll', activeGroupId], (prev: { balance: number; startingBankroll: number } | undefined) =>
        prev ? { ...prev, balance: data.balance } : prev,
      )
      queryClient.invalidateQueries({ queryKey: ['pronos-bankroll', activeGroupId] })
      queryClient.invalidateQueries({ queryKey: ['pronos-bets', activeGroupId, matchId] })
      setSlipError(null)
      setSlipOpen(false)
      setSelected(null)
    },
    onError: (err) => {
      const code = errorCodeOf(err)
      switch (code) {
        case 'PRONOS_WINDOW_CLOSED':
          setSlipOpen(false)
          setClosed(true)
          return
        case 'INSUFFICIENT_BALANCE':
          setSlipError(t('pronos.slip.errorInsufficient'))
          return
        case 'STAKE_LIMIT_EXCEEDED':
          setSlipError(t('pronos.slip.errorStakeLimit', { max: PRONOS_MAX_STAKE }))
          return
        case 'INVALID_STAKE':
          setSlipError(t('pronos.slip.errorInvalidStake'))
          return
        case 'INVALID_SELECTION':
          // The board moved under the user — repull it.
          setSlipError(t('pronos.slip.errorInvalidSelection'))
          queryClient.invalidateQueries({ queryKey: ['pronos-odds', activeGroupId, matchId] })
          return
        default:
          setSlipError(t('pronos.slip.errorGeneric'))
      }
    },
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['pronos-odds', activeGroupId, matchId] }),
        queryClient.refetchQueries({ queryKey: ['pronos-bets', activeGroupId, matchId] }),
        queryClient.refetchQueries({ queryKey: ['pronos-reveal', activeGroupId, matchId] }),
        queryClient.refetchQueries({ queryKey: ['pronos-bankroll', activeGroupId] }),
      ])
    } finally {
      setRefreshing(false)
    }
  }, [queryClient, activeGroupId, matchId])

  const pick = (next: SlipSelection) => {
    // One active selection across all three markets; tapping it again clears it.
    setSelected((current) =>
      current && current.market === next.market && current.selection === next.selection ? null : next,
    )
    haptics.selection()
    setSlipError(null)
  }

  const isActive = (market: BetMarket, selection: string) =>
    selected?.market === market && selected.selection === selection

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(app)/pronos' as never))

  const header = (
    <View style={styles.nav}>
      <PressableScale
        style={styles.backButton}
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel={t('pronos.board.back')}
      >
        <Ionicons name="chevron-back" size={20} color={Colors.ink} />
      </PressableScale>
      <Text style={styles.navTitle}>
        {(settled ? t('pronos.settlement.title') : t('pronos.board.title')).toUpperCase()}
      </Text>
    </View>
  )

  // ── Terminal states ────────────────────────────────────────────────────────
  // A reveal outranks a board error: a match completed without teams ever being generated
  // still 422s on /odds, and dead-ending it would hide a settlement the player is owed.
  const boardErrorCode = boardError && !settled ? errorCodeOf(boardError) : undefined
  if (boardErrorCode !== undefined) {
    const message =
      boardErrorCode === 'ODDS_NOT_AVAILABLE'
        ? t('pronos.board.oddsUnavailable')
        : boardErrorCode === 'MATCH_NOT_FOUND'
          ? t('pronos.board.notFound')
          : t('pronos.slip.errorGeneric')
    return (
      <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
        {header}
        <View style={styles.terminal}>
          <Text style={styles.terminalText}>{message}</Text>
          <SecondaryButton label={t('pronos.board.backCta')} onPress={goBack} />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {header}

        {/* Both queries gate the first paint, so a slow reveal can never flash the board
            for a settled match before replacing it. */}
        {(boardLoading || revealLoading) && (
          <View style={styles.skeletonBlock}>
            <SkeletonCard height={92} />
            <SkeletonRow card />
            <SkeletonRow card />
            <SkeletonRow card />
          </View>
        )}

        {/* Settled: the reveal replaces the board entirely — no markets, no slip, no bar. */}
        {settled && reveal && <SettlementReveal data={reveal} />}

        {!settled && !revealLoading && board && (
          <>
            <StaggerItem index={0}>
              <View style={styles.matchCard}>
                <Text style={styles.matchup} numberOfLines={1}>
                  {t('pronos.board.matchup', { teamA: t('pronos.teamA'), teamB: t('pronos.teamB') })}
                </Text>
                <Text style={styles.matchMeta} numberOfLines={1}>
                  {t('pronos.board.lockedOvr', {
                    teamAOvr: Math.round(board.teams.teamAOvr),
                    teamBOvr: Math.round(board.teams.teamBOvr),
                  })}
                </Text>
              </View>

              {closed ? (
                <Animated.View style={[styles.lockedBanner, lockStyle]}>
                  {/* No lock icons anywhere (design rule) — the clock states the reason. */}
                  <Ionicons name="time-outline" size={20} color={Colors.inkSecondary} />
                  <View style={styles.lockedText}>
                    <Text style={styles.lockedTitle}>{t('pronos.board.lockedTitle')}</Text>
                    <Text style={styles.lockedHint}>{t('pronos.board.lockedHint')}</Text>
                  </View>
                </Animated.View>
              ) : (
                <View style={styles.countdownRow}>
                  <CountdownPill
                    targetAt={board.window.closesAt}
                    label={t('pronos.board.countdownLabel')}
                  />
                </View>
              )}
            </StaggerItem>

            <StaggerItem index={1} style={styles.section}>
              <Text style={styles.sectionLabel}>{t('pronos.resultLabel')}</Text>
              <View style={styles.resultRow}>
                {(
                  [
                    ['teamA', t('pronos.teamA'), board.result.teamA],
                    ['draw', t('pronos.board.drawShort'), board.result.draw],
                    ['teamB', t('pronos.teamB'), board.result.teamB],
                  ] as const
                ).map(([selection, label, odds]) => (
                  <MarketSelection
                    key={selection}
                    label={label}
                    odds={odds}
                    flex={1}
                    active={isActive('result', selection)}
                    disabled={closed}
                    onPress={() =>
                      pick({
                        market: 'result',
                        selection,
                        odds,
                        label,
                        marketLabel: marketLabels.result,
                      })
                    }
                    accessibilityLabel={t('pronos.board.selectionA11y', {
                      label,
                      odds: formatOdds(odds),
                    })}
                  />
                ))}
              </View>
            </StaggerItem>

            <StaggerItem index={2} style={styles.section}>
              <Text style={styles.sectionLabel}>{t('pronos.scoreLabel')}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scoreScroller}
              >
                {board.scores.map((line) => (
                  <MarketSelection
                    key={line.selection}
                    label={line.selection}
                    odds={line.odds}
                    active={isActive('score', line.selection)}
                    disabled={closed}
                    onPress={() =>
                      pick({
                        market: 'score',
                        selection: line.selection,
                        odds: line.odds,
                        label: line.selection,
                        marketLabel: marketLabels.score,
                      })
                    }
                    accessibilityLabel={t('pronos.board.selectionA11y', {
                      label: line.selection,
                      odds: formatOdds(line.odds),
                    })}
                  />
                ))}
              </ScrollView>
            </StaggerItem>

            <StaggerItem index={3} style={styles.section}>
              <Text style={styles.sectionLabel}>{t('pronos.board.mvpLabel')}</Text>
              <View style={styles.mvpList}>
                {board.mvp
                  .filter((line) => line.displayName.length > 0)
                  .map((line) => (
                    <MarketSelection
                      key={line.playerId}
                      variant="row"
                      label={line.displayName}
                      odds={line.odds}
                      active={isActive('mvp', line.playerId)}
                      disabled={closed}
                      onPress={() =>
                        pick({
                          market: 'mvp',
                          selection: line.playerId,
                          odds: line.odds,
                          label: line.displayName,
                          marketLabel: marketLabels.mvp,
                        })
                      }
                      accessibilityLabel={t('pronos.board.selectionA11y', {
                        label: line.displayName,
                        odds: formatOdds(line.odds),
                      })}
                    />
                  ))}
                {board.mvp.length === 0 && <Text style={styles.emptyText}>{t('pronos.mvpEmpty')}</Text>}
              </View>
            </StaggerItem>

            <StaggerItem index={4} style={styles.section}>
              <Text style={styles.sectionLabel}>{t('pronos.board.myBetsTitle')}</Text>
              {(betsData?.bets ?? []).map((bet) => (
                // Display-only: never wrapped in PressableScale (Story 10.1 rule).
                <View key={bet.id} style={styles.betRow}>
                  <View style={styles.betText}>
                    <Text style={styles.betTitle} numberOfLines={1}>
                      {t('pronos.slip.recap', {
                        selection: betSelectionLabel(bet, board, t),
                        market: marketLabels[bet.market],
                      })}
                    </Text>
                    <Text style={styles.betMeta} numberOfLines={1}>
                      {t('pronos.board.betLine', {
                        stake: bet.stake,
                        odds: formatOdds(bet.oddsAtBet),
                      })}
                      {' · '}
                      {t('pronos.board.betGain', { gain: Math.round(bet.stake * bet.oddsAtBet) })}
                    </Text>
                  </View>
                  {/* Outcome presentation (won / lost / close) arrives with Story 11.6. */}
                  <View style={styles.betStatus}>
                    <Ionicons name="time-outline" size={14} color={Colors.inkSecondary} />
                    <Text style={styles.betStatusText}>
                      {bet.status === 'pending'
                        ? t('pronos.board.betPending')
                        : t('pronos.board.betSettled')}
                    </Text>
                  </View>
                </View>
              ))}
              {(betsData?.bets.length ?? 0) === 0 && (
                <Text style={styles.emptyText}>{t('pronos.board.myBetsEmpty')}</Text>
              )}
            </StaggerItem>
          </>
        )}
      </ScrollView>

      {selected && !closed && !settled && (
        <View style={[styles.selectionBar, { bottom: DOCK_CLEARANCE - 4 }]}>
          <View style={styles.selectionText}>
            <Text style={styles.selectionCount}>
              {t('pronos.board.selectionCount', { count: 1 })}
            </Text>
            <Text style={styles.selectionPick} numberOfLines={1}>
              {selected.label} · {formatOdds(selected.odds)}
            </Text>
          </View>
          {/* Dim, not glowing: the screen's one glow belongs to the slip's confirm CTA. */}
          <PressableScale
            style={styles.stakeButton}
            onPress={() => {
              setSlipError(null)
              setSlipOpen(true)
            }}
            accessibilityRole="button"
            accessibilityLabel={t('pronos.board.stakeCta')}
          >
            <Text style={styles.stakeButtonText}>{t('pronos.board.stakeCta')}</Text>
          </PressableScale>
        </View>
      )}

      <BetSlipSheet
        visible={slipOpen}
        selection={selected}
        balance={balance}
        submitting={placeBet.isPending}
        errorMessage={slipError}
        onClose={() => setSlipOpen(false)}
        onConfirm={(stake) => {
          if (selected) placeBet.mutate({ pick: selected, stake })
        }}
      />
    </View>
  )
}

/** A bet's selection as the board words it — an MVP bet stores a playerId, not a name. */
function betSelectionLabel(
  bet: MyBet,
  board: OddsBoard,
  t: (key: string) => string,
): string {
  if (bet.market === 'mvp') {
    return board.mvp.find((m) => m.playerId === bet.selection)?.displayName ?? bet.selection
  }
  if (bet.market === 'result') {
    if (bet.selection === 'teamA') return t('pronos.teamA')
    if (bet.selection === 'teamB') return t('pronos.teamB')
    return t('pronos.board.drawShort')
  }
  return bet.selection
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: DOCK_CLEARANCE + SELECTION_BAR_HEIGHT,
  },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  backButton: {
    width: 44,
    height: 44,
    marginLeft: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    color: Colors.ink,
    fontFamily: Type.display.fontFamily,
    fontSize: 26,
    letterSpacing: 1.04, // 0.04em @ 26 (display register)
  },
  skeletonBlock: { gap: 8 },
  matchCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 3,
  },
  matchup: { color: Colors.ink, fontSize: 15, fontFamily: Fonts.interSemiBold },
  matchMeta: { color: Colors.inkSecondary, fontSize: 12, fontFamily: Fonts.inter },
  countdownRow: { marginTop: 12 },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  lockedText: { flex: 1, minWidth: 0, gap: 2 },
  lockedTitle: { color: Colors.ink, fontSize: 14, fontFamily: Fonts.interSemiBold },
  lockedHint: { color: Colors.inkSecondary, fontSize: 12, fontFamily: Fonts.inter },
  section: { marginTop: 26 },
  sectionLabel: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  resultRow: { flexDirection: 'row', gap: 8 },
  scoreScroller: { gap: 8, paddingRight: 4 },
  mvpList: { gap: 8 },
  betRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  betText: { flex: 1, minWidth: 0, gap: 3 },
  betTitle: { color: Colors.ink, fontSize: 14, fontFamily: Fonts.interSemiBold },
  betMeta: { color: Colors.inkSecondary, fontSize: 11.5, fontFamily: Fonts.inter },
  betStatus: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  betStatusText: {
    color: Colors.inkSecondary,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  emptyText: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: Fonts.inter,
    paddingVertical: 10,
  },
  selectionBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  selectionText: { flex: 1, minWidth: 0, gap: 3 },
  selectionCount: {
    color: Colors.inkSecondary,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  selectionPick: { color: Colors.ink, fontSize: 14, fontFamily: Fonts.interSemiBold },
  stakeButton: {
    minHeight: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.line,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stakeButtonText: { color: Colors.ink, fontSize: 14, fontFamily: Fonts.interSemiBold },
  terminal: { flex: 1, justifyContent: 'center', gap: 20, paddingHorizontal: 4 },
  terminalText: {
    color: Colors.inkSecondary,
    fontSize: 15,
    fontFamily: Fonts.inter,
    textAlign: 'center',
  },
})
