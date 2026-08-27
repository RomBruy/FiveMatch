import { useEffect, useRef, useState } from 'react'
import { Image, StyleSheet, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import * as SplashScreen from 'expo-splash-screen'
import { Colors } from '../constants/colors'
import { Motion, MotionEasing, Type } from '../constants/tokens'
import { useReduceMotion } from '../hooks/use-reduce-motion'

// React Native's static asset registry requires require() for bundled images.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BRAND_LOCKUP = require('../assets/brand/splash-logo.png')

interface BrandSplashProps {
  ready: boolean
}

/** Seamless native → React brand frame. It owns only the handoff, never bootstrap. */
export function BrandSplash({ ready }: BrandSplashProps) {
  const { t } = useTranslation()
  const reduceMotion = useReduceMotion()
  const opacity = useSharedValue(1)
  const [hidden, setHidden] = useState(false)
  // Measured from mount, not from `ready`: the dwell is about what the user saw,
  // and on a warm start the frame is already up before bootstrap resolves.
  const mountedAt = useRef(Date.now())

  useEffect(() => {
    if (!ready) return
    let active = true
    let dwellTimer: ReturnType<typeof setTimeout> | undefined

    void SplashScreen.hideAsync().catch(() => {}).then(() => {
      if (!active) return

      const startHandoff = () => {
        if (!active) return
        if (reduceMotion) {
          setHidden(true)
          return
        }
        opacity.value = withTiming(
          0,
          { duration: Motion.splashHandoff, easing: MotionEasing.signature },
          (finished) => {
            if (finished) runOnJS(setHidden)(true)
          },
        )
      }

      // A slow cold start has already paid the dwell; only a fast one waits.
      const remaining = Motion.splashMinDwell - (Date.now() - mountedAt.current)
      if (remaining <= 0) startHandoff()
      else dwellTimer = setTimeout(startHandoff, remaining)
    })

    return () => {
      active = false
      if (dwellTimer) clearTimeout(dwellTimer)
    }
  }, [ready, reduceMotion, opacity])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  if (hidden) return null

  return (
    <Animated.View
      style={[styles.frame, animatedStyle]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image source={BRAND_LOCKUP} style={styles.lockup} resizeMode="contain" />
      {/* The only moment the app has undivided attention. It used to spend it in
          silence; it now spends it saying what the product is. Costs nothing — the
          frame was already on screen for exactly as long. */}
      <Text style={styles.promise}>{t('brand.promiseLine')}</Text>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  frame: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockup: { width: 320, height: 320 },
  promise: {
    marginTop: -28, // the lockup PNG carries its own bottom padding
    paddingHorizontal: 40,
    textAlign: 'center',
    color: Colors.ink,
    fontFamily: Type.bodyStrong.fontFamily,
    fontSize: 16,
    lineHeight: 23,
  },
})
