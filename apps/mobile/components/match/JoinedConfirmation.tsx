import { useEffect } from 'react'
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
import { useReduceMotion } from '../../hooks/use-reduce-motion'

interface JoinedConfirmationProps {
  visible: boolean
  whenLabel: string
  venueLabel: string
  onClose: () => void
  onSeeMyMatches: () => void
}

/**
 * "You're in."
 *
 * The most favourable moment in the whole product — someone has just committed
 * to turning up — and it was silent: the button stopped spinning and the screen
 * looked much as before.
 *
 * It is used for two things. It confirms the fixture in words, so the commitment
 * feels real. And it names what is now automatic — the reminder, the team draw —
 * because those are the promises that make someone trust the app to run their
 * evening instead of setting their own alarm and checking a group chat.
 */
export function JoinedConfirmation({
  visible,
  whenLabel,
  venueLabel,
  onClose,
  onSeeMyMatches,
}: JoinedConfirmationProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const reduceMotion = useReduceMotion()

  const translateY = useSharedValue(windowHeight)
  const opacity = useSharedValue(0)

  useEffect(() => {
    if (!visible) return
    opacity.value = withTiming(1, { duration: Motion.toggle })
    translateY.value = reduceMotion ? 0 : withSpring(0, MotionSpring.sheet)
  }, [visible, reduceMotion, translateY, opacity])

  useEffect(() => {
    if (visible) return
    translateY.value = withTiming(windowHeight, { duration: Motion.sheet, easing: MotionEasing.signature })
    opacity.value = withTiming(0, { duration: Motion.sheet })
  }, [visible, translateY, opacity, windowHeight])

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  if (!visible) return null

  return (
    <Modal visible transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={styles.surface}>
            <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.tint} />
          </View>

          <View style={styles.grabZone}><View style={styles.handle} /></View>

          <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, 20) + 8 }]}>
            <View style={styles.mark}>
              <Ionicons name="checkmark" size={28} color={Colors.success} />
            </View>

            <Text style={styles.title}>{t('match.joined.title')}</Text>
            <Text style={styles.fixture}>{venueLabel}</Text>
            <Text style={styles.when}>{whenLabel}</Text>

            {/* What is now handled for you. Each line is a promise the app keeps
                without being asked, which is the whole reason to book here rather
                than reply "in" to a group chat. */}
            <View style={styles.list}>
              {(['calendar', 'reminder', 'teams'] as const).map((item) => (
                <View key={item} style={styles.row}>
                  <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
                  <Text style={styles.rowText}>{t(`match.joined.${item}`)}</Text>
                </View>
              ))}
            </View>

            <PrimaryButton label={t('match.joined.seeMatches')} onPress={onSeeMyMatches} glow={false} />
            <SecondaryButton label={t('match.joined.stay')} onPress={onClose} />
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
  body: { paddingHorizontal: 22, paddingTop: 6, gap: 9 },
  mark: {
    alignSelf: 'center',
    width: 54,
    height: 54,
    borderRadius: Radius.full,
    backgroundColor: Colors.successSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  title: {
    textAlign: 'center',
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 32,
    letterSpacing: 1.6, // 0.05em @ 32 (display register)
  },
  fixture: {
    textAlign: 'center',
    color: Colors.ink,
    fontFamily: Fonts.interSemiBold,
    fontSize: 14,
  },
  when: {
    textAlign: 'center',
    color: Colors.inkSecondary,
    fontFamily: Fonts.inter,
    fontSize: 12.5,
    marginTop: -4,
  },
  list: {
    gap: 9,
    marginTop: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowText: { flex: 1, color: Colors.ink, fontFamily: Fonts.inter, fontSize: 12.5, lineHeight: 17 },
})
