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
import { Colors } from '../../constants/colors'
import { Fonts, Motion, MotionEasing, MotionSpring, Radius } from '../../constants/tokens'
import { PrimaryButton } from '../ui/PrimaryButton'
import { SecondaryButton } from '../ui/SecondaryButton'
import { PressableScale } from '../ui/PressableScale'
import { useReduceMotion } from '../../hooks/use-reduce-motion'

/** Sent verbatim to everyone on the sheet, so each one has to read as a message. */
export const CANCEL_REASONS = ['pitch', 'weather', 'players', 'other'] as const
export type CancelReason = (typeof CANCEL_REASONS)[number]

interface CancelMatchSheetProps {
  visible: boolean
  /** How many people are about to be told. The number that should give pause. */
  confirmedCount: number
  submitting: boolean
  onClose: () => void
  onConfirm: (reason: CancelReason, postpone: boolean) => void
}

/**
 * Cancelling, as the organiser.
 *
 * This was a two-button Alert: "are you sure", yes/no. It destroyed a fixture
 * for ten people with no reason attached and no alternative offered, and the
 * players got a bare "cancelled" with nothing to act on.
 *
 * The sheet does three things the Alert could not. It states the blast radius
 * before the button. It attaches a reason, because "terrain fermé" and "pas
 * assez de joueurs" lead to completely different responses from the group. And
 * it offers the postponement first — most cancellations are not abandonments,
 * they are reschedules, and an app that only offers the nuclear option gets used
 * as one.
 */
export function CancelMatchSheet({
  visible,
  confirmedCount,
  submitting,
  onClose,
  onConfirm,
}: CancelMatchSheetProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const reduceMotion = useReduceMotion()

  const [rendered, setRendered] = useState(visible)
  const [reason, setReason] = useState<CancelReason>('pitch')
  // On by default. The common case is "not this week", not "never again", and
  // the default should be the outcome that keeps the group playing.
  const [postpone, setPostpone] = useState(true)

  const translateY = useSharedValue(windowHeight)
  const opacity = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      setRendered(true)
      return
    }
    if (reduceMotion) {
      opacity.value = withTiming(0, { duration: Motion.toggle })
      setRendered(false)
      return
    }
    translateY.value = withTiming(windowHeight, { duration: Motion.sheet, easing: MotionEasing.signature })
    opacity.value = withTiming(0, { duration: Motion.sheet })
    const timer = setTimeout(() => setRendered(false), Motion.sheet)
    return () => clearTimeout(timer)
  }, [visible, reduceMotion, translateY, opacity, windowHeight])

  const handleShow = () => {
    setReason('pitch')
    setPostpone(true)
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
            {/* The blast radius, before anything else. */}
            <View style={styles.warning}>
              <Text style={styles.warningTitle}>{t('match.cancelSheet.title')}</Text>
              <Text style={styles.warningBody}>
                {t('match.cancelSheet.blast', { count: confirmedCount })}
              </Text>
            </View>

            <Text style={styles.micro}>{t('match.cancelSheet.reasonLabel')}</Text>
            <View style={styles.reasons}>
              {CANCEL_REASONS.map((option) => {
                const selected = option === reason
                return (
                  <PressableScale
                    key={option}
                    style={[styles.reason, selected && styles.reasonOn]}
                    onPress={() => setReason(option)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t(`match.cancelSheet.reason.${option}`)}
                  >
                    <Text style={styles.reasonTitle}>{t(`match.cancelSheet.reason.${option}`)}</Text>
                    <View style={[styles.mark, selected && styles.markOn]}>
                      {selected && <Ionicons name="checkmark" size={13} color={Colors.onPrimary} />}
                    </View>
                  </PressableScale>
                )
              })}
            </View>

            <PressableScale
              style={[styles.postpone, postpone && styles.postponeOn]}
              onPress={() => setPostpone((v) => !v)}
              accessibilityRole="switch"
              accessibilityState={{ checked: postpone }}
              accessibilityLabel={t('match.cancelSheet.postpone.title')}
            >
              <View style={styles.postponeText}>
                <Text style={styles.postponeTitle}>{t('match.cancelSheet.postpone.title')}</Text>
                <Text style={styles.postponeBody}>{t('match.cancelSheet.postpone.body')}</Text>
              </View>
              <View style={[styles.mark, postpone && styles.markGo]}>
                {postpone && <Ionicons name="checkmark" size={13} color={Colors.bg} />}
              </View>
            </PressableScale>

            <Text style={styles.refund}>{t('match.cancelSheet.refund')}</Text>

            <PrimaryButton
              label={t('match.cancelSheet.confirm', { count: confirmedCount })}
              onPress={() => onConfirm(reason, postpone)}
              loading={submitting}
              glow={false}
            />
            <SecondaryButton label={t('match.cancelSheet.back')} onPress={onClose} />
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
  warning: {
    backgroundColor: Colors.primarySubtle,
    borderWidth: 1,
    borderColor: 'rgba(255,68,56,0.3)',
    borderRadius: Radius.md,
    padding: 15,
    gap: 7,
  },
  warningTitle: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 24,
    letterSpacing: 1.2, // 0.05em @ 24 (heading register)
  },
  warningBody: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 12, lineHeight: 17 },
  micro: {
    marginTop: 4,
    color: Colors.inkSecondary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.4, // 0.14em @ 10 (label-caps register)
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
  reasonTitle: { flex: 1, color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 13 },
  postpone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginTop: 4,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  postponeOn: { borderColor: Colors.success, backgroundColor: Colors.successSubtle },
  postponeText: { flex: 1, gap: 2 },
  postponeTitle: { color: Colors.ink, fontFamily: Fonts.interSemiBold, fontSize: 13 },
  postponeBody: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 11, lineHeight: 15 },
  refund: { color: Colors.inkDisabled, fontFamily: Fonts.inter, fontSize: 11, lineHeight: 15 },
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
  markGo: { backgroundColor: Colors.success, borderColor: Colors.success },
})
