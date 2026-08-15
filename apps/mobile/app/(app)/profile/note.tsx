import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  OVR_ATTRIBUTE_WEIGHTS,
  OUTCOME_WEIGHT,
  GOAL_PT,
  ASSIST_PT,
  OBJECTIVE_GOAL_CAP,
  MVP_BONUS,
  ALPHA_BASE,
  ALPHA_FLOOR,
  OVR_CLAMP_MIN,
  OVR_CLAMP_MAX,
} from '@fivematch/types/algorithm-constants'
import { Colors } from '../../../constants/colors'
import { Fonts, Radius, Type } from '../../../constants/tokens'
import { PressableScale } from '../../../components/ui/PressableScale'
import { StaggerItem } from '../../../components/ui/Stagger'
import { DOCK_CLEARANCE } from '../../../components/ui/TabDock'

/**
 * How the note is calculated.
 *
 * The note decided team balance, card unlocks and pronos odds without a single
 * screen ever saying where it came from — the last number in the product that
 * asked to be trusted without explaining itself.
 *
 * Every figure here is READ FROM the shared constants rather than retyped, so
 * this page cannot drift away from the algorithm it describes. Mentality is
 * shown at zero deliberately: it is collected and displayed on the card, but it
 * is genuinely not part of the calculation, and saying so is the point.
 */

const MATCH_COUNT_TO_UNLOCK = 4

// Sorted heaviest first — the ordering is the message.
const WEIGHTS = (Object.entries(OVR_ATTRIBUTE_WEIGHTS) as [string, number][])
  .sort((a, b) => b[1] - a[1])

const HEAVIEST = WEIGHTS[0]?.[1] ?? 1

/** Alpha decays from ALPHA_BASE toward ALPHA_FLOOR — the shape of "settles down". */
const SETTLING = Array.from({ length: 14 }, (_, i) => {
  const t = i / 13
  return ALPHA_FLOOR + (ALPHA_BASE - ALPHA_FLOOR) * (1 - t) ** 1.4
})

function pct(n: number) {
  return `${Math.round(n * 100)}%`
}

export default function NoteExplainerScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}
    >
      <View style={styles.nav}>
        <PressableScale
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={Colors.ink} />
        </PressableScale>
        <Text style={styles.navTitle}>{t('note.title')}</Text>
      </View>

      <StaggerItem index={0}>
        <View style={styles.lede}>
          <Text style={styles.ledeText}>{t('note.lede')}</Text>
          <View style={styles.rangeRow}>
            <Text style={styles.rangeChip}>
              {t('note.range', { min: OVR_CLAMP_MIN, max: OVR_CLAMP_MAX })}
            </Text>
            <Text style={styles.rangeChip}>
              {t('note.unlockAt', { count: MATCH_COUNT_TO_UNLOCK })}
            </Text>
          </View>
        </View>
      </StaggerItem>

      {/* ── What your opponents rate, and how much each one counts ───────── */}
      <StaggerItem index={1}>
        <Text style={styles.label}>{t('note.weights.title').toUpperCase()}</Text>
        <View style={styles.card}>
          {WEIGHTS.map(([attr, weight]) => (
            <View key={attr} style={styles.weightRow}>
              <Text style={styles.weightKey}>{t(`note.attr.${attr}`)}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${(weight / HEAVIEST) * 100}%` }]} />
              </View>
              <Text style={styles.weightPct}>{pct(weight)}</Text>
            </View>
          ))}

          {/* The honest zero: collected, displayed on the card, never counted. */}
          <View style={[styles.weightRow, styles.weightRowMuted]}>
            <Text style={[styles.weightKey, styles.muted]}>{t('note.attr.mentality')}</Text>
            <View style={styles.track} />
            <Text style={[styles.weightPct, styles.muted]}>0%</Text>
          </View>
          <Text style={styles.footnote}>{t('note.weights.mentalityNote')}</Text>
        </View>
      </StaggerItem>

      {/* ── The match itself ─────────────────────────────────────────────── */}
      <StaggerItem index={2}>
        <Text style={styles.label}>{t('note.match.title').toUpperCase()}</Text>
        <View style={styles.card}>
          <Bonus label={t('note.match.outcome')} value={`± ${OUTCOME_WEIGHT}`} tone="neutral" />
          <Bonus label={t('note.match.goal')} value={`+ ${GOAL_PT}`} tone="good" />
          <Bonus label={t('note.match.assist')} value={`+ ${ASSIST_PT}`} tone="good" />
          <Bonus label={t('note.match.mvp')} value={`+ ${MVP_BONUS}`} tone="gold" />
          <Text style={styles.footnote}>
            {t('note.match.cap', { cap: OBJECTIVE_GOAL_CAP })}
          </Text>
        </View>
      </StaggerItem>

      {/* ── Why it moves slowly ──────────────────────────────────────────── */}
      <StaggerItem index={3}>
        <Text style={styles.label}>{t('note.settling.title').toUpperCase()}</Text>
        <View style={styles.card}>
          <Text style={styles.body}>
            {t('note.settling.body', {
              start: pct(ALPHA_BASE),
              floor: pct(ALPHA_FLOOR),
            })}
          </Text>
          <View style={styles.gauge}>
            {SETTLING.map((a, i) => (
              <View
                key={i}
                style={[styles.bar, { height: `${(a / ALPHA_BASE) * 100}%` }]}
              />
            ))}
          </View>
          <View style={styles.gaugeAxis}>
            <Text style={styles.axisText}>{t('note.settling.axisStart')}</Text>
            <Text style={styles.axisText}>{t('note.settling.axisEnd')}</Text>
          </View>
        </View>
      </StaggerItem>

      {/* ── What never touches it ────────────────────────────────────────── */}
      <StaggerItem index={4}>
        <Text style={styles.label}>{t('note.never.title').toUpperCase()}</Text>
        <View style={styles.card}>
          <Text style={styles.body}>{t('note.never.body')}</Text>
        </View>
      </StaggerItem>
    </ScrollView>
  )
}

function Bonus({ label, value, tone }: { label: string; value: string; tone: 'neutral' | 'good' | 'gold' }) {
  return (
    <View style={styles.bonusRow}>
      <Text style={styles.bonusLabel}>{label}</Text>
      <Text
        style={[
          styles.bonusValue,
          tone === 'good' && styles.bonusGood,
          tone === 'gold' && styles.bonusGold,
        ]}
      >
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 20, paddingBottom: DOCK_CLEARANCE },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 10 },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
  },
  navTitle: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 30,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  lede: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.card,
    padding: 18,
    gap: 14,
  },
  ledeText: {
    color: Colors.ink,
    fontFamily: Fonts.inter,
    fontSize: 14,
    lineHeight: 21,
  },
  rangeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rangeChip: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
  },
  label: {
    color: Colors.primary,
    fontFamily: Type.labelCaps.fontFamily,
    fontSize: 11,
    letterSpacing: Type.labelCaps.letterSpacing,
    marginTop: 26,
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.line,
    padding: 16,
  },
  weightRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 6 },
  weightRowMuted: {
    borderTopWidth: 1,
    borderTopColor: Colors.hairline,
    marginTop: 6,
    paddingTop: 12,
  },
  weightKey: {
    width: 96,
    color: Colors.ink,
    fontFamily: Fonts.interSemiBold,
    fontSize: 12.5,
  },
  muted: { color: Colors.inkDisabled },
  track: {
    flex: 1,
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: Radius.full, backgroundColor: Colors.primary },
  weightPct: {
    width: 38,
    textAlign: 'right',
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 17,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  footnote: {
    color: Colors.inkDisabled,
    fontFamily: Fonts.inter,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 10,
  },
  bonusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 7,
  },
  bonusLabel: { flex: 1, color: Colors.ink, fontFamily: Fonts.inter, fontSize: 13.5 },
  bonusValue: {
    color: Colors.inkSecondary,
    fontFamily: Fonts.bebas,
    fontSize: 20,
    letterSpacing: 0.8,
    fontVariant: ['tabular-nums'],
  },
  bonusGood: { color: Colors.success },
  bonusGold: { color: Colors.gold },
  body: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 13.5, lineHeight: 20 },
  gauge: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
    height: 56,
    marginTop: 16,
  },
  bar: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: Colors.primary },
  gaugeAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  axisText: {
    color: Colors.inkDisabled,
    fontFamily: Fonts.interSemiBold,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
})
