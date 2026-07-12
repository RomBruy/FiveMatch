import { Pressable, StyleSheet, Text } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Colors } from '../../constants/colors'
import { Fonts, Motion, Radius } from '../../constants/tokens'

interface SecondaryButtonProps {
  label: string
  onPress?: () => void
  disabled?: boolean
}

export function SecondaryButton({ label, onPress, disabled = false }: SecondaryButtonProps) {
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: Motion.press })
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: Motion.press })
      }}
    >
      <Animated.View style={[styles.button, disabled && styles.disabled, animatedStyle]}>
        <Text style={styles.label}>{label}</Text>
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    height: 50,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    color: Colors.ink,
    fontSize: 15,
    fontFamily: Fonts.interSemiBold,
  },
})
