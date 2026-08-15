import {
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { useEffect, useMemo, useRef, useState } from 'react'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PRONOS_MAX_STAKE } from '@fivematch/types/algorithm-constants'
import { Colors } from '../../constants/colors'
import { Fonts, Motion, MotionEasing, MotionSpring, Radius, Type } from '../../constants/tokens'
import { PrimaryButton } from '../ui/PrimaryButton'
import { PressableScale } from '../ui/PressableScale'
import { useReduceMotion } from '../../hooks/use-reduce-motion'
import { formatOdds } from './MarketSelection'

/** Presentation-only stake shortcuts. The real ceiling is PRONOS_MAX_STAKE ∩ balance. */
const QUICK_STAKES = [50, 100, 250]

const DRAG_DISMISS_DISTANCE = 120
const DRAG_DISMISS_VELOCITY = 0.8
const EXIT_DURATION = 240

export interface SlipSelection {
  market: 'result' | 'score' | 'mvp'
  selection: string
  odds: number
  /** Human label for the pick ("Équipe A", "2-1", "Kevin B."). */
  label: string
  /** Human label for its market ("Résultat", "Score exact", "Homme du match"). */
  marketLabel: string
}

interface BetSlipSheetProps {
  visible: boolean
  selection: SlipSelection | null
  balance: number
  submitting: boolean
  /** Localized error from the last failed attempt; the sheet stays open on it. */
  errorMessage: string | null
  onClose: () => void
  onConfirm: (stake: number) => void
}

/**
 * The bet slip (Story 11.5) — a level-3 bottom sheet on the GroupSwitcher pattern:
 * Modal + spring entrance in onShow, PanResponder drag-dismiss, reduced-motion opacity
 * fallback. No sheet library.
 *
 * Scarcity budget: the "gain potentiel" is the screen's ONE --type-numeral and the confirm
 * CTA its ONE --glow — both live here, where the scrim already covers the tab dock.
 */
export function BetSlipSheet({
  visible,
  selection,
  balance,
  submitting,
  errorMessage,
  onClose,
  onConfirm,
}: BetSlipSheetProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const reduceMotion = useReduceMotion()

  const [rendered, setRendered] = useState(visible)
  const [stakeText, setStakeText] = useState('')
  // The parent clears its selection the instant a bet lands; hold the last one so the
  // sheet can still play its exit rather than vanishing mid-slide.
  const [displayed, setDisplayed] = useState<SlipSelection | null>(selection)
  useEffect(() => {
    if (selection) setDisplayed(selection)
  }, [selection])

  const translateY = useSharedValue(windowHeight)
  const sheetOpacity = useSharedValue(1)
  const backdropOpacity = useSharedValue(0)

  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // The stake ceiling: never more than the anti-ruin cap, never more than we hold.
  const maxStake = Math.min(balance, PRONOS_MAX_STAKE)
  const stake = Number.parseInt(stakeText, 10)
  const stakeValid = Number.isInteger(stake) && stake >= 1 && stake <= maxStake

  // Mirrors bankrollService.wonPayout exactly — the slip must never promise a number
  // settlement will not pay.
  const potentialGain = stakeValid && displayed ? Math.round(stake * displayed.odds) : 0
  const balanceAfter = stakeValid ? balance - stake : balance

  const quickStakes = useMemo(() => QUICK_STAKES.filter((value) => value <= maxStake), [maxStake])

  useEffect(() => {
    if (visible) {
      setStakeText('')
      backdropOpacity.value = 0
      if (reduceMotion) {
        translateY.value = 0
        sheetOpacity.value = 0
      } else {
        translateY.value = windowHeight
        sheetOpacity.value = 1
      }
      setRendered(true)
    } else if (rendered) {
      backdropOpacity.value = withTiming(0, { duration: Motion.toggle })
      if (reduceMotion) {
        sheetOpacity.value = withTiming(0, { duration: Motion.toggle }, (finished) => {
          if (finished) runOnJS(setRendered)(false)
        })
      } else {
        translateY.value = withTiming(
          windowHeight,
          { duration: EXIT_DURATION, easing: MotionEasing.out },
          (finished) => {
            if (finished) runOnJS(setRendered)(false)
          },
        )
      }
    }
  }, [visible])

  const handleShow = () => {
    backdropOpacity.value = withTiming(1, { duration: Motion.toggle })
    if (reduceMotion) {
      sheetOpacity.value = withTiming(1, { duration: Motion.toggle })
    } else {
      translateY.value = withSpring(0, MotionSpring.sheet)
    }
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        translateY.value = Math.max(0, g.dy)
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > DRAG_DISMISS_DISTANCE || g.vy > DRAG_DISMISS_VELOCITY) {
          onCloseRef.current()
        } else {
          translateY.value = withSpring(0, MotionSpring.sheet)
        }
      },
    }),
  ).current

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }))
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: sheetOpacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  if (!displayed) return null

  const broke = maxStake < 1

  return (
    <Modal
      visible={rendered}
      transparent
      statusBarTranslucent
      animationType="none"
      onShow={handleShow}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('pronos.slip.close')}
          />
        </Animated.View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View style={[styles.sheet, sheetStyle]}>
            {/* Level-3: raised tint + blur(50) + hairline — the TabDock treatment. */}
            <View style={styles.surface}>
              <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.tint} />
            </View>

            <View style={styles.grabZone} {...panResponder.panHandlers}>
              <View style={styles.handle} />
            </View>

            <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, 20) + 8 }]}>
              <View style={styles.recapRow}>
                <View style={styles.recapText}>
                  <Text style={styles.micro}>{t('pronos.slip.selectionLabel')}</Text>
                  <Text style={styles.recapTitle} numberOfLines={1}>
                    {t('pronos.slip.recap', {
                      selection: displayed.label,
                      market: displayed.marketLabel,
                    })}
                  </Text>
                </View>
                <View style={styles.recapCote}>
                  <Text style={styles.recapCoteText}>{formatOdds(displayed.odds)}</Text>
                </View>
              </View>

              <View>
                <Text style={[styles.micro, styles.stakeLabel]}>{t('pronos.slip.stakeLabel')}</Text>
                <View style={styles.stakeRow}>
                  <TextInput
                    style={styles.stakeInput}
                    value={stakeText}
                    onChangeText={(text) => setStakeText(text.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.inkDisabled}
                    editable={!broke && !submitting}
                    accessibilityLabel={t('pronos.slip.stakeLabel')}
                    maxLength={6}
                  />
                  <Text style={styles.stakeUnit}>{t('pronos.slip.unit')}</Text>
                </View>
              </View>

              {broke ? (
                <Text style={styles.brokeText}>{t('pronos.slip.broke')}</Text>
              ) : (
                <View style={styles.quickRow}>
                  {quickStakes.map((value) => (
                    <PressableScale
                      key={value}
                      style={[styles.quickChip, stake === value && styles.quickChipActive]}
                      onPress={() => setStakeText(String(value))}
                      accessibilityRole="button"
                      accessibilityState={{ selected: stake === value }}
                      accessibilityLabel={`${value} ${t('pronos.slip.unit')}`}
                    >
                      <Text style={[styles.quickText, stake === value && styles.quickTextActive]}>
                        {value}
                      </Text>
                    </PressableScale>
                  ))}
                  <PressableScale
                    style={[styles.quickChip, stake === maxStake && styles.quickChipActive]}
                    onPress={() => setStakeText(String(maxStake))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: stake === maxStake }}
                    accessibilityLabel={t('pronos.slip.max')}
                  >
                    <Text style={[styles.quickText, stake === maxStake && styles.quickTextActive]}>
                      {t('pronos.slip.max')}
                    </Text>
                  </PressableScale>
                </View>
              )}

              <View style={styles.gainRow}>
                <View style={styles.gainBlock}>
                  <Text style={styles.micro}>{t('pronos.slip.gainLabel')}</Text>
                  {/* The screen's ONE --type-numeral. */}
                  <Text style={styles.gainNumeral}>{potentialGain}</Text>
                  {/* The arithmetic, spelled out. A payout nobody can verify in
                      their head is a number they have to take on faith. */}
                  {stakeValid && displayed && (
                    <Text style={styles.gainWorking}>
                      {t('pronos.slip.gainWorking', {
                        stake,
                        odds: formatOdds(displayed.odds),
                      })}
                    </Text>
                  )}
                </View>
                <View style={styles.afterBlock}>
                  <Text style={styles.micro}>{t('pronos.slip.balanceAfterLabel')}</Text>
                  <Text style={styles.afterStat}>
                    {balanceAfter} {t('pronos.slip.unit')}
                  </Text>
                </View>
              </View>

              {/* When the market closes, and — for MVP — who actually decides it.
                  Betting on an outcome whose referee is unnamed is a bad deal. */}
              <Text style={styles.terms}>
                {displayed?.market === 'mvp'
                  ? t('pronos.slip.termsMvp')
                  : t('pronos.slip.terms')}
              </Text>

              {errorMessage !== null && <Text style={styles.errorText}>{errorMessage}</Text>}

              {/* The screen's ONE --glow. The scrim covers the dock while it shows. */}
              <PrimaryButton
                label={t('pronos.slip.confirm')}
                disabled={!stakeValid || submitting}
                loading={submitting}
                onPress={() => onConfirm(stake)}
              />
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  surface: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.hairline,
    overflow: 'hidden',
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(38,38,44,0.92)',
  },
  grabZone: { paddingTop: 12, paddingHorizontal: 22 },
  handle: {
    width: 44,
    height: 5,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    alignSelf: 'center',
    marginBottom: 14,
  },
  body: { paddingHorizontal: 22, gap: 18 },
  micro: {
    color: Colors.inkSecondary,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  recapRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recapText: { flex: 1, minWidth: 0 },
  recapTitle: {
    marginTop: 4,
    color: Colors.ink,
    fontSize: 15,
    fontFamily: Fonts.interSemiBold,
  },
  recapCote: {
    backgroundColor: Colors.primarySubtle,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  recapCoteText: {
    color: Colors.primary,
    fontSize: 18,
    fontFamily: Type.stat.fontFamily,
    letterSpacing: 0.72, // 0.04em @ 18 (stat register)
    fontVariant: ['tabular-nums'],
  },
  stakeLabel: { marginBottom: 7 },
  stakeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  stakeInput: {
    minWidth: 90,
    color: Colors.ink,
    fontSize: 34,
    fontFamily: Type.stat.fontFamily,
    letterSpacing: 1.36, // 0.04em @ 34 (stat register)
    padding: 0,
  },
  stakeUnit: {
    color: Colors.inkSecondary,
    fontSize: 14,
    fontFamily: Fonts.inter,
    paddingBottom: 6,
  },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickChip: {
    flex: 1,
    minHeight: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipActive: { backgroundColor: Colors.primary },
  quickText: {
    color: Colors.inkSecondary,
    fontSize: 13,
    fontFamily: Fonts.interSemiBold,
  },
  quickTextActive: { color: Colors.onPrimary },
  brokeText: {
    color: Colors.inkSecondary,
    fontSize: 13,
    fontFamily: Fonts.inter,
  },
  gainRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  gainBlock: { flex: 1, minWidth: 0 },
  gainWorking: {
    color: Colors.inkDisabled,
    fontFamily: Fonts.inter,
    fontSize: 11,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
  terms: {
    color: Colors.inkDisabled,
    fontFamily: Fonts.inter,
    fontSize: 11,
    lineHeight: 16,
  },
  gainNumeral: {
    color: Colors.success,
    fontSize: 58,
    fontFamily: Type.numeral.fontFamily,
    letterSpacing: -0.58, // -0.01em @ 58 (numeral register)
    fontVariant: ['tabular-nums'],
  },
  afterBlock: { alignItems: 'flex-end', paddingBottom: 8 },
  afterStat: {
    marginTop: 5,
    color: Colors.ink,
    fontSize: 16,
    fontFamily: Type.stat.fontFamily,
    letterSpacing: 0.64, // 0.04em @ 16 (stat register)
    fontVariant: ['tabular-nums'],
  },
  errorText: {
    color: Colors.primary,
    fontSize: 13,
    fontFamily: Fonts.interSemiBold,
  },
})
