import { Pressable, StyleSheet } from 'react-native'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated'
import { Colors } from '../../constants/colors'
import { Fonts, Motion, Radius } from '../../constants/tokens'

interface ChipProps {
  label: string
  active?: boolean
  onPress?: () => void
  disabled?: boolean
  /** "outlined" marks the "other/custom" option: transparent with a line border. */
  variant?: 'filled' | 'outlined'
}

export function Chip({ label, active = false, onPress, disabled = false, variant = 'filled' }: ChipProps) {
  const progress = useDerivedValue(() => withTiming(active ? 1 : 0, { duration: Motion.toggle }), [active])

  const animatedBg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [variant === 'outlined' ? 'transparent' : Colors.surfaceRaised, Colors.primary],
    ),
  }))

  const animatedLabel = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, [0, 1], [Colors.inkSecondary, Colors.onPrimary]),
  }))

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: 3, bottom: 3, left: 0, right: 0 }}
    >
      <Animated.View
        style={[
          styles.chip,
          variant === 'outlined' && !active && styles.outlined,
          disabled && styles.disabled,
          animatedBg,
        ]}
      >
        <Animated.Text style={[styles.label, animatedLabel]}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    height: 38,
    borderRadius: Radius.full,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlined: {
    borderWidth: 1.5,
    borderColor: Colors.line,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.interSemiBold,
  },
})
