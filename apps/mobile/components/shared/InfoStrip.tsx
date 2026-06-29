import { useEffect, useRef } from 'react'
import { View, Text, Animated, AccessibilityInfo, StyleSheet } from 'react-native'
import { Colors } from '../../constants/colors'

interface InfoStripProps {
  message: string
  variant: 'warning' | 'info'
  pulsing?: boolean
}

export function InfoStrip({ message, variant, pulsing = false }: InfoStripProps) {
  const opacity = useRef(new Animated.Value(1)).current
  const animationRef = useRef<Animated.CompositeAnimation | null>(null)

  useEffect(() => {
    if (!pulsing) return

    AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (reduceMotion) return

      animationRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1.0, duration: 800, useNativeDriver: true }),
        ]),
      )
      animationRef.current.start()
    })

    return () => {
      animationRef.current?.stop()
    }
  }, [pulsing, opacity])

  const dotColor = variant === 'warning' ? Colors.primary : Colors.inkSecondary

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.dot, { backgroundColor: dotColor, opacity: pulsing ? opacity : 1 }]} />
      <Text style={styles.text}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  text: {
    color: Colors.inkSecondary,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    flex: 1,
  },
})
