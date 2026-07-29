import { StyleSheet, Text, View } from 'react-native'
import { Colors } from '../../constants/colors'
import { Fonts, Radius, Type } from '../../constants/tokens'
import { PressableScale } from '../ui/PressableScale'
import { DuotoneAvatar } from '../ui/DuotoneAvatar'

/**
 * One bettable line on the odds board (Story 11.5).
 *
 * Visually the Selection Chip contract (radius full, --surface-raised → --primary when
 * active) widened to carry its cote. The cote is ALWAYS --type-stat (Bebas tabular) and is
 * printed exactly as the API priced it — the client never re-rounds or re-derives a price.
 *
 * Selection is signalled three ways, never colour alone: fill, a --primary border, and
 * accessibilityState.selected.
 */
interface MarketSelectionProps {
  label: string
  odds: number
  active: boolean
  disabled?: boolean
  onPress: () => void
  accessibilityLabel: string
  /** "tile" = result / correct-score (stacked). "row" = man-of-the-match (avatar line). */
  variant?: 'tile' | 'row'
  /** tile only: 1 stretches across a flex row, undefined lets the scroller size it. */
  flex?: number
}

export function formatOdds(odds: number): string {
  return odds.toFixed(2)
}

export function MarketSelection({
  label,
  odds,
  active,
  disabled = false,
  onPress,
  accessibilityLabel,
  variant = 'tile',
  flex,
}: MarketSelectionProps) {
  const isRow = variant === 'row'

  return (
    <PressableScale
      style={[
        isRow ? styles.row : styles.tile,
        flex !== undefined && { flex },
        active && styles.active,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected: active, disabled }}
      accessibilityLabel={accessibilityLabel}
    >
      {isRow && <DuotoneAvatar displayName={label} size={30} />}
      <Text
        style={[isRow ? styles.rowLabel : styles.tileLabel, active && styles.labelActive]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View style={[styles.cotePill, active && styles.cotePillActive]}>
        <Text style={[styles.cote, active && styles.coteActive]}>{formatOdds(odds)}</Text>
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  // 44pt floor on every target (Story 7.5 accessibility guarantee).
  tile: {
    minHeight: 62,
    minWidth: 88,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  active: {
    backgroundColor: Colors.primarySubtle,
    borderColor: Colors.primary,
  },
  disabled: { opacity: 0.4 },
  tileLabel: {
    color: Colors.inkSecondary,
    fontSize: 12,
    fontFamily: Fonts.interSemiBold,
    textAlign: 'center',
  },
  rowLabel: {
    flex: 1,
    minWidth: 0,
    color: Colors.ink,
    fontSize: 14,
    fontFamily: Fonts.interSemiBold,
  },
  labelActive: { color: Colors.ink },
  cotePill: {
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  cotePillActive: { backgroundColor: Colors.primary },
  cote: {
    color: Colors.ink,
    fontSize: 18,
    fontFamily: Type.stat.fontFamily,
    letterSpacing: 0.72, // 0.04em @ 18 (stat register)
    fontVariant: ['tabular-nums'],
  },
  coteActive: { color: Colors.onPrimary },
})
