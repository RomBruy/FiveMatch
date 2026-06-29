import { useEffect, useRef, useState } from 'react'
import { View, StyleSheet, Animated, AccessibilityInfo } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'

const MESSAGE_KEYS = [
  'match.generate.loading1',
  'match.generate.loading2',
  'match.generate.loading3',
  'match.generate.loading4',
]

const ROTATION_INTERVAL_MS = 1200
const FADE_OUT_MS = 200
const FADE_IN_MS = 300

export function NarrativeLoader() {
  const { t } = useTranslation()
  const [reduceMotion, setReduceMotion] = useState(false)
  const [messageIndex, setMessageIndex] = useState(0)
  const opacity = useRef(new Animated.Value(1)).current

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {})
  }, [])

  useEffect(() => {
    if (reduceMotion) return  // static message only when reduce-motion is on

    const interval = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: FADE_OUT_MS, useNativeDriver: true }).start(() => {
        setMessageIndex((i) => (i + 1) % MESSAGE_KEYS.length)
        Animated.timing(opacity, { toValue: 1, duration: FADE_IN_MS, useNativeDriver: true }).start()
      })
    }, ROTATION_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [reduceMotion])

  const message = t(reduceMotion ? 'match.generate.loading1' : MESSAGE_KEYS[messageIndex]!)

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <Animated.Text style={[styles.message, { opacity: reduceMotion ? 1 : opacity }]}>
        {message}
      </Animated.Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  message: {
    color: Colors.inkSecondary,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
})
