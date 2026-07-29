import { StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts, Radius, Type } from '../../constants/tokens'
import { StaggerItem } from '../ui/Stagger'
import { formatOdds } from './MarketSelection'

export type BetOutcome = 'pending' | 'won' | 'lost' | 'close'

export interface RevealBet {
  id: string
  market: 'result' | 'score' | 'mvp'
  selection: string
  /** Server-resolved: an MVP pick arrives as a display name, other markets as their own token. */
  selectionLabel: string
  stake: number
  oddsAtBet: number
  status: BetOutcome
  payout: number | null
}

export interface RevealGroupRow {
  playerId: string
  displayName: string
  staked: number
  returned: number
  net: number
  isMe: boolean
}

export interface RevealData {
  settled: boolean
  match: {
    status: string
    scoreA: number | null
    scoreB: number | null
    actualResult: 'teamA' | 'draw' | 'teamB' | null
    actualScore: string | null
    mvpPlayerId: string | null
    mvpDisplayName: string | null
  }
  myBets: RevealBet[]
  myTotals: { staked: number; returned: number; net: number }
  group: RevealGroupRow[]
}

/**
 * Outcome presentation. Every state carries an Ionicon AND a word — colour is redundant
 * reinforcement, never the signal (Story 7.5). `--gold-dim` here is the near-miss
 * semantic, NOT prestige gold: prestige gold in this module belongs to the leaderboard's
 * rank-1 badge alone.
 */
const OUTCOME: Record<
  BetOutcome,
  { icon: keyof typeof Ionicons.glyphMap; tint: string; bg: string; wordKey: string }
> = {
  won: { icon: 'checkmark', tint: Colors.success, bg: Colors.successSubtle, wordKey: 'pronos.settlement.outcomeWon' },
  close: { icon: 'remove', tint: Colors.goldDim, bg: 'rgba(255,214,10,0.14)', wordKey: 'pronos.settlement.outcomeClose' },
  lost: { icon: 'close', tint: Colors.primary, bg: Colors.primarySubtle, wordKey: 'pronos.settlement.outcomeLost' },
  pending: {
    icon: 'time-outline',
    tint: Colors.inkSecondary,
    bg: Colors.surfaceRaised,
    wordKey: 'pronos.settlement.outcomePending',
  },
}

/** A true minus sign (U+2212), not a hyphen — these sit beside tabular Bebas figures. */
function formatSigned(value: number): string {
  if (value > 0) return `+${value}`
  if (value < 0) return `−${Math.abs(value)}`
  return '0'
}

export function SettlementReveal({ data }: { data: RevealData }) {
  const { t } = useTranslation()
  const { match, myBets, myTotals, group } = data

  /** A `result` bet stores a raw token; the API ships no French copy, so localize here. */
  const labelOf = (bet: RevealBet): string => {
    if (bet.market === 'result') {
      if (bet.selection === 'teamA') return t('pronos.teamA')
      if (bet.selection === 'teamB') return t('pronos.teamB')
      return t('pronos.board.drawShort')
    }
    if (bet.market === 'score') return t('pronos.settlement.marketScore', { selection: bet.selectionLabel })
    return t('pronos.settlement.marketMvp', { selection: bet.selectionLabel })
  }

  const hasBets = myBets.length > 0
  const netPositive = myTotals.net >= 0

  return (
    <>
      <StaggerItem index={0}>
        <View style={styles.headerCard}>
          <Text style={styles.matchup} numberOfLines={1}>
            {t('pronos.board.matchup', { teamA: t('pronos.teamA'), teamB: t('pronos.teamB') })}
          </Text>
          {/* The screen's ONE --type-numeral. */}
          <Text
            style={styles.score}
            accessibilityLabel={t('pronos.settlement.scoreA11y', {
              scoreA: match.scoreA,
              scoreB: match.scoreB,
            })}
          >
            {match.scoreA} — {match.scoreB}
          </Text>
          <Text style={styles.mvpLine} numberOfLines={1}>
            {match.mvpDisplayName
              ? t('pronos.settlement.mvpLine', { name: match.mvpDisplayName })
              : t('pronos.settlement.mvpPending')}
          </Text>
        </View>
      </StaggerItem>

      <StaggerItem index={1} style={styles.section}>
        <Text style={styles.sectionLabel}>{t('pronos.settlement.myBetsTitle')}</Text>

        {!hasBets && <Text style={styles.emptyText}>{t('pronos.settlement.noBets')}</Text>}

        {myBets.map((bet) => {
          const outcome = OUTCOME[bet.status]
          const word = t(outcome.wordKey)
          const selection = labelOf(bet)
          return (
            // Display-only: never wrapped in PressableScale (Story 10.1 rule).
            <View
              key={bet.id}
              style={styles.betRow}
              accessibilityLabel={t('pronos.settlement.betA11y', {
                selection,
                odds: formatOdds(bet.oddsAtBet),
                stake: bet.stake,
                outcome: word,
              })}
            >
              <View style={[styles.betIcon, { backgroundColor: outcome.bg }]}>
                <Ionicons name={outcome.icon} size={13} color={outcome.tint} />
              </View>
              <View style={styles.betText}>
                <Text style={styles.betTitle} numberOfLines={1}>
                  {t('pronos.settlement.betTitle', { selection, odds: formatOdds(bet.oddsAtBet) })}
                </Text>
                <Text style={styles.betMeta} numberOfLines={1}>
                  {t('pronos.settlement.betMeta', { stake: bet.stake, outcome: word })}
                </Text>
              </View>
              <Text style={[styles.betAmount, amountStyle(bet)]}>{amountLabel(bet)}</Text>
            </View>
          )
        })}
      </StaggerItem>

      {hasBets && (
        <StaggerItem index={2} style={styles.section}>
          <View style={[styles.netCard, netPositive ? styles.netCardPositive : styles.netCardNegative]}>
            <View style={styles.netText}>
              <Text style={[styles.netLabel, { color: netPositive ? Colors.success : Colors.primary }]}>
                {t('pronos.settlement.netTitle')}
              </Text>
              <Text style={styles.netMeta} numberOfLines={1}>
                {t('pronos.settlement.netMeta', {
                  staked: myTotals.staked,
                  returned: myTotals.returned,
                })}
              </Text>
            </View>
            <Text style={[styles.netAmount, { color: netPositive ? Colors.success : Colors.primary }]}>
              {formatSigned(myTotals.net)}
            </Text>
          </View>
        </StaggerItem>
      )}

      {group.length > 0 && (
        <StaggerItem index={3} style={styles.section}>
          <Text style={styles.sectionLabel}>{t('pronos.settlement.groupTitle')}</Text>
          {/* Already sorted by net descending server-side — never re-sorted here. */}
          {group.map((row) => (
            <View key={row.playerId} style={[styles.groupRow, row.isMe && styles.groupRowMe]}>
              <Text style={styles.groupName} numberOfLines={1}>
                {row.displayName}
              </Text>
              <Text style={[styles.groupNet, { color: row.net > 0 ? Colors.success : Colors.inkSecondary }]}>
                {formatSigned(row.net)}
              </Text>
            </View>
          ))}
        </StaggerItem>
      )}
    </>
  )
}

/** A pending payout is null — "not settled yet", never a zero that would read as a loss. */
function amountLabel(bet: RevealBet): string {
  if (bet.status === 'pending') return '—'
  if (bet.status === 'lost') return '0'
  return `+${bet.payout ?? 0}`
}

function amountStyle(bet: RevealBet) {
  switch (bet.status) {
    case 'won':
      return { color: Colors.success }
    case 'close':
      return { color: Colors.goldDim }
    case 'lost':
      return { color: Colors.inkDisabled }
    default:
      return { color: Colors.inkSecondary }
  }
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },
  matchup: {
    color: Colors.inkSecondary,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  score: {
    color: Colors.ink,
    fontSize: 62,
    fontFamily: Type.numeral.fontFamily,
    letterSpacing: -0.62, // -0.01em @ 62 (numeral register)
    fontVariant: ['tabular-nums'],
  },
  mvpLine: { color: Colors.inkSecondary, fontSize: 12.5, fontFamily: Fonts.inter },
  section: { marginTop: 26 },
  sectionLabel: {
    color: Colors.inkSecondary,
    fontSize: 11,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.54,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
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
  betIcon: { width: 22, height: 22, borderRadius: Radius.full, alignItems: 'center', justifyContent: 'center' },
  betText: { flex: 1, minWidth: 0, gap: 3 },
  betTitle: { color: Colors.ink, fontSize: 14, fontFamily: Fonts.interSemiBold },
  betMeta: { color: Colors.inkSecondary, fontSize: 11.5, fontFamily: Fonts.inter },
  betAmount: {
    fontSize: 18,
    fontFamily: Type.stat.fontFamily,
    letterSpacing: 0.54, // 0.03em @ 18 (stat register)
    fontVariant: ['tabular-nums'],
  },
  netCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  netCardPositive: { backgroundColor: Colors.successSubtle },
  netCardNegative: { backgroundColor: Colors.surface },
  netText: { flex: 1, minWidth: 0, gap: 3 },
  netLabel: {
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  netMeta: { color: Colors.inkSecondary, fontSize: 12, fontFamily: Fonts.inter },
  netAmount: {
    fontSize: 30,
    fontFamily: Type.stat.fontFamily,
    letterSpacing: 0.9, // 0.03em @ 30 (stat register)
    fontVariant: ['tabular-nums'],
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderRadius: Radius.sm,
  },
  groupRowMe: { backgroundColor: Colors.primarySubtle },
  groupName: { flex: 1, minWidth: 0, color: Colors.ink, fontSize: 14, fontFamily: Fonts.interSemiBold },
  groupNet: {
    fontSize: 18,
    fontFamily: Type.stat.fontFamily,
    letterSpacing: 0.54, // 0.03em @ 18 (stat register)
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: Fonts.inter,
    paddingVertical: 10,
  },
})
