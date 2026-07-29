import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import type { ReactNode } from 'react'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Motion, MotionEasing } from '../../constants/tokens'
import { useReduceMotion } from '../../hooks/use-reduce-motion'

interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}

// DESIGN.md press spec: scale(.97) at rest→pressed; reduced motion swaps to an opacity dim.
const PRESSED_SCALE = 0.97
const PRESSED_OPACITY = 0.85

/**
 * The press response every interactive surface owes (DESIGN.md → Interaction & Feel):
 * a 120ms scale(.97) squeeze, or an opacity dim under reduced motion. Wraps any
 * row / card / hero the way PrimaryButton already animates itself. Forwards the full
 * Pressable prop surface (onPress, a11y role/label/state, disabled, hitSlop). Disabled
 * surfaces do not animate. Never wrap a non-interactive View in it.
 */
export function PressableScale({ children, style, disabled, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const reduceMotion = useReduceMotion()
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Pressable
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) {
          if (reduceMotion) {
            opacity.value = withTiming(PRESSED_OPACITY, { duration: Motion.press, easing: MotionEasing.out })
          } else {
            scale.value = withTiming(PRESSED_SCALE, { duration: Motion.press, easing: MotionEasing.out })
          }
        }
        onPressIn?.(e)
      }}
      onPressOut={(e) => {
        opacity.value = withTiming(1, { duration: Motion.press, easing: MotionEasing.out })
        scale.value = withTiming(1, { duration: Motion.press, easing: MotionEasing.out })
        onPressOut?.(e)
      }}
      {...rest}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  )
}
