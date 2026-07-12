import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'

interface ProgressBarPillProps {
  matchCount: number
  cardState: string
}

function getProgressFill(cardState: string, matchCount: number): number {
  switch (cardState) {
    case 'in_progress_1': return 0
    case 'in_progress_2': return 0.25
    case 'in_progress_3': return matchCount === 2 ? 0.50 : 0.75
    default: return 0
  }
}

function getProgressMatchCount(cardState: string, matchCount: number): number {
  switch (cardState) {
    case 'in_progress_1': return 0
    case 'in_progress_2': return 1
    case 'in_progress_3': return matchCount
    default: return 0
  }
}

export function ProgressBarPill({ matchCount, cardState }: ProgressBarPillProps) {
  const { t } = useTranslation()
  const fill = getProgressFill(cardState, matchCount)
  const count = getProgressMatchCount(cardState, matchCount)

  // Locked = progress, never exclusion: Bebas fraction + red bar + unlock hint. No lock icons.
  return (
    <View
      accessible
      accessibilityLabel={t('card.locked.accessibility', { count })}
    >
      <Text style={styles.fraction}>{count}/4</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: Math.round(fill * 48) }]} />
      </View>
      <Text style={styles.label}>{t('card.locked.lockHint')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  fraction: {
    color: Colors.ink,
    fontSize: 16,
    fontFamily: Fonts.bebas,
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  track: {
    width: 48,
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
  },
  label: {
    color: Colors.inkDisabled,
    fontSize: 10,
    fontFamily: Fonts.interSemiBold,
    marginTop: 3,
  },
})
