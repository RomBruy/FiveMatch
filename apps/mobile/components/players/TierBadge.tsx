import { Text, StyleSheet } from 'react-native'
import type { TextStyle } from 'react-native'
import { Colors } from '../../constants/colors'

function getTierLabel(tier: string | undefined): string {
  switch (tier) {
    case 'club': return 'CLUB'
    case 'semiPro': return 'SEMI-PRO'
    case 'elite': return 'ELITE'
    default: return 'AMATEUR'
  }
}

interface TierBadgeProps {
  tier: string | undefined
  style?: TextStyle
}

export function TierBadge({ tier, style }: TierBadgeProps) {
  return (
    <Text style={[styles.label, style]}>{getTierLabel(tier)}</Text>
  )
}

const styles = StyleSheet.create({
  label: {
    fontFamily: 'BebasNeue_400Regular',
    fontSize: 9,
    color: Colors.ink,
    letterSpacing: 1,
  },
})
