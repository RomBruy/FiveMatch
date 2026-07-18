import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import * as Haptics from 'expo-haptics'
import { Colors } from '../../constants/colors'
import { Radius, Type } from '../../constants/tokens'

const SCALE = Array.from({ length: 10 }, (_, i) => i + 1)

interface RatingSliderProps {
  label: string
  value: number
  onChange: (value: number) => void
}

/**
 * 1–10 slider-look picker (Story 9.4 register): primary fill on a raised pill
 * track with a pill thumb and Bebas stat value. Each step stays an individual
 * 44pt touch target; light haptic at min/max.
 */
export function RatingSlider({ label, value, onChange }: RatingSliderProps) {
  const select = (n: number) => {
    onChange(n)
    if (n === SCALE[0] || n === SCALE[SCALE.length - 1]) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    }
  }

  return (
    <View style={styles.attrRow}>
      <View style={styles.attrHeader}>
        <Text style={styles.attrLabel}>{label}</Text>
        <Text style={styles.attrValue}>{value}</Text>
      </View>
      <View style={styles.track}>
        {SCALE.map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.segment, n <= value && styles.segmentFilled]}
            onPress={() => select(n)}
            accessibilityLabel={`${label}: ${n}`}
            accessibilityRole="button"
            accessibilityState={{ selected: value === n }}
          >
            {n === value && <View style={styles.thumb} />}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  attrRow: {
    gap: 6,
  },
  attrHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  attrLabel: {
    flexShrink: 1,
    color: Colors.inkSecondary,
    fontFamily: Type.labelCaps.fontFamily,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: Type.labelCaps.letterSpacing,
  },
  attrValue: {
    color: Colors.ink,
    fontFamily: Type.stat.fontFamily,
    fontSize: 20,
    letterSpacing: Type.stat.letterSpacing,
  },
  track: {
    flexDirection: 'row',
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentFilled: {
    backgroundColor: Colors.primary,
  },
  thumb: {
    width: 6,
    height: 22,
    borderRadius: Radius.full,
    backgroundColor: Colors.onPrimary,
  },
})
