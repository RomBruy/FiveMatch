import { useEffect } from 'react'
import { StyleSheet, TextInput, View, Text, type StyleProp, type TextStyle } from 'react-native'
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Colors } from '../../constants/colors'
import { Fonts, Motion, MotionEasing, Radius } from '../../constants/tokens'
import { usePreviousValue } from '../../hooks/use-previous-value'
import { useReduceMotion } from '../../hooks/use-reduce-motion'

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput)

interface CountUpNumberProps {
  value: number
  style?: StyleProp<TextStyle>
  showDelta?: boolean
  deltaTone?: 'success' | 'primary'
  accessibilityLabel?: string
}

export function CountUpNumber({
  value,
  style,
  showDelta = false,
  deltaTone = 'success',
  accessibilityLabel,
}: CountUpNumberProps) {
  const previous = usePreviousValue(value)
  const reduceMotion = useReduceMotion()
  const displayed = useSharedValue(value)
  const scale = useSharedValue(1)
  const chipProgress = useSharedValue(0)
  const delta = previous === undefined ? 0 : value - previous

  useEffect(() => {
    if (previous === undefined || previous === value) {
      displayed.value = value
      return
    }
    chipProgress.value = 0
    if (reduceMotion) {
      displayed.value = value
      scale.value = 1
      chipProgress.value = 1
      return
    }
    displayed.value = previous
    displayed.value = withTiming(value, { duration: Motion.countUp, easing: MotionEasing.out }, (finished) => {
      if (!finished) return
      scale.value = withTiming(1.12, { duration: Motion.ovrPop / 2 }, () => {
        scale.value = withTiming(1, { duration: Motion.ovrPop / 2 })
      })
      if (showDelta) chipProgress.value = withTiming(1, { duration: Motion.screen, easing: MotionEasing.out })
    })
  }, [value, previous, reduceMotion, displayed, scale, chipProgress, showDelta])

  const animatedProps = useAnimatedProps(() => {
    const text = String(Math.round(displayed.value))
    return { text, defaultValue: text }
  })
  const numberStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const chipStyle = useAnimatedStyle(() => ({
    opacity: chipProgress.value,
    transform: [{ translateY: (1 - chipProgress.value) * 8 }],
  }))

  return (
    <View style={styles.row} accessible accessibilityLabel={accessibilityLabel ?? String(value)}>
      <AnimatedTextInput
        animatedProps={animatedProps}
        editable={false}
        pointerEvents="none"
        underlineColorAndroid="transparent"
        style={[styles.number, style, numberStyle]}
      />
      {showDelta && delta !== 0 && (
        <Animated.View style={[styles.delta, deltaTone === 'primary' && styles.deltaPrimary, chipStyle]}>
          <Text style={[styles.deltaText, deltaTone === 'primary' && styles.deltaTextPrimary]}>
            {delta > 0 ? `+${delta}` : String(delta)}
          </Text>
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  number: {
    padding: 0,
    margin: 0,
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  delta: {
    backgroundColor: 'rgba(45,190,125,0.16)',
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  deltaPrimary: { backgroundColor: Colors.primarySubtle },
  deltaText: { color: Colors.success, fontFamily: Fonts.interBold, fontSize: 10 },
  deltaTextPrimary: { color: Colors.primary },
})
