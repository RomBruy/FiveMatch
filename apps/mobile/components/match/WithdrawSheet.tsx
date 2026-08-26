import { useEffect, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CANCELLATION_REASONS, type CancellationReason } from '@fivematch/types'
import { Colors } from '../../constants/colors'
import { Fonts, Motion, MotionEasing, MotionSpring, Radius, Type } from '../../constants/tokens'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'
import { PressableScale } from '../ui/PressableScale'
import { useReduceMotion } from '../../hooks/use-reduce-motion'

interface WithdrawSheetProps {
  visible: boolean
  /** Players who will be told. Drives the confirm label — the real consequence. */
  otherPlayerCount: number
  /** True once the sheet is closed enough to kickoff that this counts as late. */
  isLate: boolean
  submitting: boolean
  onClose: () => void
  onConfirm: (reason: CancellationReason) => void
}

/**
 * "I can't come."
 *
 * The most important gesture in the app, and it did not exist: leaving fired
 * instantly from a button with no confirmation and no way to say why, so the
 * organiser got silence and a missing player.
 *
 * Two taps, a reason and a confirm. The reason is three fixed options because
 * whoever is here is already late and under pressure — asking them to compose a
 * message is what makes people say nothing and simply not turn up.
 *
 * The penalty, when there is one, is stated BEFORE the button, never discovered
 * after. Someone who finds out afterwards that withdrawing cost them something
 * learns to go quiet instead.
 */
export function WithdrawSheet({
  visible,
  otherPlayerCount,
  isLate,
  submitting,
  onClose,
  onConfirm,
}: WithdrawSheetProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const reduceMotion = useReduceMotion()

  const [rendered, setRendered] = useState(visible)
  // Pre-selected: "unexpected" covers the overwhelming majority, so the common
  // path is one tap. Nobody should have to classify their own emergency.
  const [reason, setReason] = useState<CancellationReason>('unexpected')

  const translateY = useSharedValue(windowHeight)
  const opacity = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      setRendered(true)
      return
    }
    // Play the exit before unmounting, so it never vanishes mid-slide.
    if (reduceMotion) {
      opacity.value = withTiming(0, { duration: Motion.toggle }, () => {})
      setRendered(false)
      return
    }
    translateY.value = withTiming(
      windowHeight,
      { duration: Motion.sheet, easing: MotionEasing.signature },
    )
    opacity.value = withTiming(0, { duration: Motion.sheet })
    const timer = setTimeout(() => setRendered(false), Motion.sheet)
    return () => clearTimeout(timer)
  }, [visible, reduceMotion, translateY, opacity, windowHeight])

  const handleShow = () => {
    setReason('unexpected')
    opacity.value = withTiming(1, { duration: Motion.toggle })
    translateY.value = reduceMotion ? 0 : withSpring(0, MotionSpring.sheet)
  }

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  if (!rendered) return null

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
            accessibilityLabel={t('common.cancel')}
          />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={styles.surface}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.tint} />
          </View>

          <View style={styles.grabZone}><View style={styles.handle} /></View>

          <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, 20) + 8 }]}>
            <Text style={styles.title}>{t('match.withdraw.title')}</Text>
            <Text style={styles.lede}>{t('match.withdraw.lede')}</Text>

            <Text style={styles.micro}>{t('match.withdraw.reasonLabel')}</Text>
            <View style={styles.reasons}>
              {CANCELLATION_REASONS.map((option) => {
                const selected = option === reason
                return (
                  <PressableScale
                    key={option}
                    style={[styles.reason, selected && styles.reasonOn]}
                    onPress={() => setReason(option)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t(`match.withdraw.reason.${option}.title`)}
                  >
                    <View style={styles.reasonText}>
                      <Text style={styles.reasonTitle}>
                        {t(`match.withdraw.reason.${option}.title`)}
                      </Text>
                      <Text style={styles.reasonBody}>
                        {t(`match.withdraw.reason.${option}.body`)}
                      </Text>
                    </View>
                    <View style={[styles.mark, selected && styles.markOn]}>
                      {selected && <Ionicons name="checkmark" size={13} color={Colors.onPrimary} />}
                    </View>
                  </PressableScale>
                )
              })}
            </View>

            {/* Always stated, never discovered afterwards. Shown even when the
                match is days away, because a crew may run a longer deadline than
                the standard one and a conditional-only warning would go quiet
                for exactly the people it should have caught. */}
            <View style={[styles.consequence, isLate && styles.consequenceLoud]}>
              <Text style={[styles.consequenceText, isLate && styles.consequenceTextLoud]}>
                {isLate ? t('match.withdraw.lateWarning') : t('match.withdraw.lateRule')}
              </Text>
            </View>

            <PrimaryButton
              // The label names the consequence — "tell the other 9" — because
              // that is what someone is actually afraid of, and seeing the app
              // will do it for them is what makes the tap possible.
              label={t('match.withdraw.confirm', { count: otherPlayerCount })}
              onPress={() => onConfirm(reason)}
              loading={submitting}
              glow={false}
            />
            <SecondaryButton label={t('match.withdraw.keepSeat')} onPress={onClose} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' },
  surface: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: Colors.hairline,
    overflow: 'hidden',
  },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(38,38,44,0.86)' },
  grabZone: { paddingTop: 10, paddingBottom: 4, alignItems: 'center' },
  handle: { width: 38, height: 4, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.22)' },
  body: { paddingHorizontal: 22, paddingTop: 6, gap: 10 },
  title: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 30,
    letterSpacing: 1.5, // 0.05em @ 30 (display register)
    textTransform: 'uppercase',
  },
  lede: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 13, lineHeight: 18 },
  micro: {
    marginTop: 4,
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.4, // 0.14em @ 10 (label-caps register)
    textTransform: 'uppercase',
  },
  reasons: { gap: 6 },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  reasonOn: { borderColor: Colors.primary, backgroundColor: Colors.primarySubtle },
  reasonText: { flex: 1, gap: 2 },
  reasonTitle: { color: Colors.ink, fontFamily: Type.bodyStrong.fontFamily, fontSize: 13 },
  reasonBody: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 11, lineHeight: 15 },
  mark: {
    width: 20,
    height: 20,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  consequence: {
    flexDirection: 'row',
    gap: 9,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.sm,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  consequenceLoud: {
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1,
    borderColor: 'rgba(255,68,56,0.3)',
  },
  consequenceText: {
    flex: 1,
    color: Colors.inkSecondary,
    fontFamily: Fonts.inter,
    fontSize: 11.5,
    lineHeight: 16,
  },
  consequenceTextLoud: { color: Colors.ink },
})
