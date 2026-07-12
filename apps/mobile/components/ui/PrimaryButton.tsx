import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useState } from 'react'
import { Colors } from '../../constants/colors'
import { Fonts, Motion, Radius } from '../../constants/tokens'

interface PrimaryButtonProps {
  label: string
  onPress?: () => void
  disabled?: boolean
  loading?: boolean
  /** The one glow per screen belongs to this button by default; pass false when another element owns it (e.g. tab dock, Panini card). */
  glow?: boolean
}

export function PrimaryButton({ label, onPress, disabled = false, loading = false, glow = true }: PrimaryButtonProps) {
  const scale = useSharedValue(1)
  const [pressed, setPressed] = useState(false)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const inactive = disabled || loading

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.97, { duration: Motion.press })
        setPressed(true)
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: Motion.press })
        setPressed(false)
      }}
    >
      <Animated.View
        style={[
          styles.button,
          glow && !inactive && styles.glow,
          pressed && styles.pressed,
          inactive && styles.disabled,
          animatedStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={Colors.onPrimary} />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </Animated.View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    height: 54,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  glow: {
    shadowColor: Colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  pressed: {
    backgroundColor: Colors.primaryPress,
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    color: Colors.onPrimary,
    fontSize: 15,
    fontFamily: Fonts.interBold,
    letterSpacing: 0.3,
  },
})
