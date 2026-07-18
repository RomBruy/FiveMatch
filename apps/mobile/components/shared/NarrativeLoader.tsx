import { useEffect, useRef, useState } from 'react'
import { View, StyleSheet, Animated, AccessibilityInfo } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Gradients } from '../../constants/gradients'
import { Fonts, Radius } from '../../constants/tokens'

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
      {/* The card's ONE ember gradient corner — texture, never content. */}
      <LinearGradient
        colors={Gradients.emberCorner}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.25, y: 0.9 }}
        style={styles.ember}
        pointerEvents="none"
      />
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
    minHeight: 150,
    paddingVertical: 32,
    backgroundColor: Colors.bg,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  ember: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 170,
    height: 130,
  },
  message: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 22,
    letterSpacing: 2.2, // 0.10em @ 22 (heading register)
    textAlign: 'center',
    paddingHorizontal: 24,
  },
})
