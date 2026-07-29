import { type ReactNode } from 'react'
import { type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Motion, MotionEasing } from '../../constants/tokens'

interface StaggerItemProps {
  /** Position in the cascade — delays the entrance by index × Motion.staggerStep. */
  index: number
  /**
   * Skip the entrance and render the block immediately. Use on surfaces whose blocks
   * can remount from local UI state (e.g. an in-screen filter that swaps content) to
   * keep the cascade to a screen's true first reveal — pass `false` once it has played.
   * Defaults to `true`.
   */
  enabled?: boolean
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

// Broadcast-intro entrance (DESIGN.md → Interaction & Feel). A screen's primary blocks
// arrive in a quick cascade rather than snapping in all at once: each block fades up
// (opacity 0→1, translateY 22→0) over Motion.staggerItem on the signature curve, delayed
// by index × Motion.staggerStep. Reanimated's `entering` fires on true mount only — it
// never re-runs on re-render or on returning to a still-mounted tab — so there is no
// re-thrash on tab switches. Under reduced motion the global ReducedMotionConfig(System)
// set in app/_layout.tsx resolves the layout animation to instant (blocks visible at once,
// no translate, no per-item delay). Transform/opacity only; blocks land in their exact
// resting positions, so there is no layout shift.
export function StaggerItem({ index, enabled = true, children, style }: StaggerItemProps) {
  return (
    <Animated.View
      style={style}
      entering={
        enabled
          ? FadeInDown.delay(index * Motion.staggerStep)
              .duration(Motion.staggerItem)
              .easing(MotionEasing.signature)
              .withInitialValues({ transform: [{ translateY: 22 }] })
          : undefined
      }
    >
      {children}
    </Animated.View>
  )
}
