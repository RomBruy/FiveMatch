import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts } from '../../constants/tokens'
import { useReduceMotion } from '../../hooks/use-reduce-motion'
import { RaisedBlurSurface } from './RaisedBlurSurface'

const COLLAPSE_START = 12
const COLLAPSE_END = 48

export function useCollapsingHeader() {
  const scrollY = useSharedValue(0)
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y
  })
  return { scrollY, scrollHandler }
}

interface CollapsingHeaderProps {
  title: string
  scrollY: SharedValue<number>
  subtitle?: ReactNode
  compactLeading?: ReactNode
  compactTrailing?: ReactNode
  onPress?: () => void
  accessibilityLabel?: string
}

/** Large in-flow title. It yields to the pinned compact bar as the page scrolls. */
export function CollapsingHeaderTitle({
  title,
  scrollY,
  subtitle,
}: Pick<CollapsingHeaderProps, 'title' | 'scrollY' | 'subtitle'>) {
  const reduceMotion = useReduceMotion()
  const titleStyle = useAnimatedStyle(() => ({
    fontSize: reduceMotion ? 40 : interpolate(scrollY.value, [COLLAPSE_START, COLLAPSE_END], [40, 24], Extrapolation.CLAMP),
  }))
  const secondaryStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion
      ? (scrollY.value > 30 ? 0 : 1)
      : interpolate(scrollY.value, [COLLAPSE_START, COLLAPSE_END], [1, 0], Extrapolation.CLAMP),
    transform: [{
      translateY: reduceMotion
        ? 0
        : interpolate(scrollY.value, [COLLAPSE_START, COLLAPSE_END], [0, -8], Extrapolation.CLAMP),
    }],
  }))

  return (
    <View style={styles.largeWrap}>
      <Animated.Text style={[styles.largeTitle, titleStyle]} numberOfLines={1}>{title}</Animated.Text>
      {subtitle ? <Animated.View style={secondaryStyle}>{subtitle}</Animated.View> : null}
    </View>
  )
}

/** Pinned compact companion to CollapsingHeaderTitle. */
export function CollapsingHeader({
  title,
  scrollY,
  compactLeading,
  compactTrailing,
  onPress,
  accessibilityLabel,
}: CollapsingHeaderProps) {
  const insets = useSafeAreaInsets()
  const reduceMotion = useReduceMotion()
  const barStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion
      ? (scrollY.value > 30 ? 1 : 0)
      : interpolate(scrollY.value, [COLLAPSE_START, COLLAPSE_END], [0, 1], Extrapolation.CLAMP),
    transform: [{
      translateY: reduceMotion
        ? 0
        : interpolate(scrollY.value, [COLLAPSE_START, COLLAPSE_END], [-8, 0], Extrapolation.CLAMP),
    }],
    pointerEvents: scrollY.value > 30 ? 'auto' : 'none',
  }))

  const content = (
    <View style={styles.compactContent}>
      {compactLeading}
      <Text style={styles.compactTitle} numberOfLines={1}>{title}</Text>
      {compactTrailing}
    </View>
  )

  return (
    <Animated.View style={[styles.pinned, { paddingTop: insets.top + 6 }, barStyle]}>
      <RaisedBlurSurface style={styles.compactSurface}>
        {onPress ? (
          <Pressable
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
          >
            {content}
          </Pressable>
        ) : content}
      </RaisedBlurSurface>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  largeWrap: { minHeight: 64, justifyContent: 'center' },
  largeTitle: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    letterSpacing: 1.8,
    lineHeight: 46,
  },
  pinned: {
    position: 'absolute',
    zIndex: 20,
    top: 0,
    left: 12,
    right: 12,
  },
  compactSurface: { borderRadius: 18 },
  compactContent: {
    minHeight: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactTitle: {
    flex: 1,
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 22,
    letterSpacing: 1.5,
  },
})
