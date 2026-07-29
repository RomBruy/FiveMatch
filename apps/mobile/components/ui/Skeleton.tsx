import {
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
  type DimensionValue,
  type LayoutChangeEvent,
} from 'react-native'
import { useEffect } from 'react'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  cancelAnimation,
  interpolate,
  Easing,
} from 'react-native-reanimated'
import { LinearGradient } from 'expo-linear-gradient'
import { Colors } from '../../constants/colors'
import { Radius } from '../../constants/tokens'
import { useReduceMotion } from '../../hooks/use-reduce-motion'

// One loading language app-wide (DESIGN.md → Interaction & Feel). A ghost block the
// shape of the real content, with a left-to-right highlight sweep; reduced motion
// drops the sweep and leaves a static block.
const SHIMMER = ['transparent', 'rgba(255,255,255,0.06)', 'transparent'] as const
const SWEEP_MS = 1100

interface SkeletonProps {
  width?: DimensionValue
  height?: number
  radius?: number
  style?: StyleProp<ViewStyle>
}

/** Base shimmer block. Presets below compose it into the app's real shapes. */
export function Skeleton({ width = '100%', height = 16, radius = Radius.sm, style }: SkeletonProps) {
  const reduceMotion = useReduceMotion()
  const progress = useSharedValue(0)
  const measuredWidth = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) return
    progress.value = withRepeat(withTiming(1, { duration: SWEEP_MS, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(progress)
  }, [reduceMotion, progress])

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-measuredWidth.value, measuredWidth.value]) }],
  }))

  const onLayout = (e: LayoutChangeEvent) => {
    measuredWidth.value = e.nativeEvent.layout.width
  }

  return (
    <View
      onLayout={onLayout}
      style={[{ width, height, borderRadius: radius, backgroundColor: Colors.surfaceRaised, overflow: 'hidden' }, style]}
    >
      {!reduceMotion && (
        <Animated.View style={[StyleSheet.absoluteFill, sweepStyle]}>
          <LinearGradient colors={SHIMMER} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
    </View>
  )
}

/** Surface list row: avatar + two text bars + a right-side pill. `card` gives it its own surface. */
export function SkeletonRow({ card = false }: { card?: boolean }) {
  return (
    <View style={[styles.row, card && styles.rowCard]}>
      <Skeleton width={36} height={36} radius={Radius.full} />
      <View style={styles.rowText}>
        <Skeleton width="55%" height={13} />
        <Skeleton width="32%" height={11} />
      </View>
      <Skeleton width={44} height={20} radius={Radius.sm} />
    </View>
  )
}

/** Hero card placeholder (Accueil next-match / Match featured card), radius-card box. */
export function SkeletonHero() {
  return (
    <View style={styles.hero}>
      <Skeleton width="45%" height={11} />
      <Skeleton width={128} height={54} radius={Radius.sm} style={styles.heroNumeral} />
      <Skeleton width="38%" height={12} style={styles.heroLine} />
      <View style={styles.heroRow}>
        <Skeleton width={104} height={30} radius={Radius.full} />
        <Skeleton width={72} height={12} />
      </View>
      <Skeleton width="100%" height={48} radius={Radius.full} style={styles.heroPill} />
    </View>
  )
}

/** Compact card placeholder (Match featured upcoming card). */
export function SkeletonCard({ height = 72 }: { height?: number }) {
  return <Skeleton height={height} radius={Radius.md} />
}

/** Squad strip placeholder (avatar cluster + count). */
export function SkeletonStrip() {
  return (
    <View style={styles.strip}>
      <Skeleton width={92} height={30} radius={Radius.full} />
      <Skeleton width={80} height={12} />
    </View>
  )
}

/** Stat tile placeholder (a big value + a small label). */
export function SkeletonTile() {
  return (
    <View style={styles.tile}>
      <Skeleton width={40} height={26} radius={Radius.sm} />
      <Skeleton width="70%" height={10} style={styles.tileLabel} />
    </View>
  )
}

/** Podium placeholder — P2 · P1 · P3 blocks, bottom-aligned. */
export function SkeletonPodium() {
  return (
    <View style={styles.podium}>
      <Skeleton width="30%" height={78} radius={Radius.md} />
      <Skeleton width="30%" height={104} radius={Radius.md} />
      <Skeleton width="30%" height={62} radius={Radius.md} />
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 12,
  },
  rowCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
  },
  rowText: {
    flex: 1,
    gap: 6,
  },
  hero: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.card,
    padding: 20,
  },
  heroNumeral: {
    marginTop: 12,
  },
  heroLine: {
    marginTop: 12,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
  },
  heroPill: {
    marginTop: 16,
  },
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  tile: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
  },
  tileLabel: {
    marginTop: 8,
  },
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 20,
  },
})
