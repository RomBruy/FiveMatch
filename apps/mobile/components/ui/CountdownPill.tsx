import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { Fonts, Motion, Radius } from '../../constants/tokens'

interface CountdownPillProps {
  /** ISO datetime the countdown ticks toward. */
  targetAt: string
  /** Caps label after the numerals (e.g. "avant le coup d'envoi"). */
  label: string
  /** Below this remaining time the numerals flip to gold and pulse. */
  urgentThresholdMs?: number
}

const TEN_MINUTES_MS = 10 * 60 * 1000

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00'
  const totalSeconds = Math.floor(ms / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * Presentational countdown pill — tabular numerals ticking 1s with no layout
 * shift. Owns only its display tick; callers keep their own deadline logic.
 */
export function CountdownPill({ targetAt, label, urgentThresholdMs = TEN_MINUTES_MS }: CountdownPillProps) {
  const [remaining, setRemaining] = useState(() => new Date(targetAt).getTime() - Date.now())

  useEffect(() => {
    setRemaining(new Date(targetAt).getTime() - Date.now())
    const interval = setInterval(() => {
      const diff = new Date(targetAt).getTime() - Date.now()
      setRemaining(diff)
      if (diff <= 0) clearInterval(interval)
    }, 1000)
    return () => clearInterval(interval)
  }, [targetAt])

  const isUrgent = remaining > 0 && remaining < urgentThresholdMs

  const opacity = useRef(new Animated.Value(1)).current
  const animationRef = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    if (!isUrgent) {
      animationRef.current?.stop()
      opacity.setValue(1)
      return
    }
    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) return
      // Urgency pulse rides the 1s countdown tick (Motion.countdownTick), half down / half up.
      animationRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.7, duration: Motion.countdownTick / 2, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: Motion.countdownTick / 2, useNativeDriver: true }),
        ]),
      )
      animationRef.current.start()
    })
    return () => {
      animationRef.current?.stop()
    }
  }, [isUrgent, opacity])

  return (
    <View style={styles.pill}>
      <Animated.Text style={[styles.numerals, isUrgent && styles.numeralsUrgent, { opacity }]}>
        {formatCountdown(remaining)}
      </Animated.Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  numerals: {
    fontFamily: Fonts.bebas,
    fontSize: 20,
    letterSpacing: 0.8, // 0.04em @ 20 (stat register)
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
  numeralsUrgent: {
    // Urgency is a live signal — primary, never decorative gold (design QA 9.12).
    color: Colors.primary,
  },
  label: {
    color: Colors.inkSecondary,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
})
