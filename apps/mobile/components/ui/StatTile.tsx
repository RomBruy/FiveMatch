import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { Colors } from '../../constants/colors'
import { Radius, Type } from '../../constants/tokens'

interface StatTileProps {
  value: string | number
  label: string
  /** One red number max per screen — caller's responsibility. */
  valueColor?: string
  style?: StyleProp<ViewStyle>
}

/** R5 stat tile: Bebas value over a caps label on a raised surface (Profil, admin dashboard). */
export function StatTile({ value, label, valueColor = Colors.ink, style }: StatTileProps) {
  return (
    <View style={[styles.tile, style]} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={[styles.value, { color: valueColor }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.md,
    padding: 16,
    gap: 4,
  },
  value: {
    fontFamily: Type.stat.fontFamily,
    fontSize: 34,
    letterSpacing: 1.36, // 0.04em @ 34 (stat register)
  },
  label: {
    color: Colors.inkSecondary,
    fontFamily: Type.labelCaps.fontFamily,
    fontSize: 10,
    letterSpacing: 1.4, // 0.14em @ 10 (label-caps register)
  },
})
