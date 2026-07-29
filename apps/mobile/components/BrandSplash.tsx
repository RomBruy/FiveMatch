import { useEffect, useState } from 'react'
import { Image, StyleSheet } from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import * as SplashScreen from 'expo-splash-screen'
import { Colors } from '../constants/colors'
import { Motion, MotionEasing } from '../constants/tokens'
import { useReduceMotion } from '../hooks/use-reduce-motion'

// React Native's static asset registry requires require() for bundled images.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const BRAND_LOCKUP = require('../assets/brand/splash-logo.png')

interface BrandSplashProps {
  ready: boolean
}

/** Seamless native → React brand frame. It owns only the handoff, never bootstrap. */
export function BrandSplash({ ready }: BrandSplashProps) {
  const reduceMotion = useReduceMotion()
  const opacity = useSharedValue(1)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!ready) return
    let active = true

    void SplashScreen.hideAsync().catch(() => {}).then(() => {
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
    })

    return () => { active = false }
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
})
