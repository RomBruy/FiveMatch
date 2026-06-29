import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'

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

  return (
    <View
      accessible
      accessibilityLabel={t('card.locked.accessibility', { count })}
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: Math.round(fill * 48) }]} />
      </View>
      <Text style={styles.label}>{t('card.locked.progress', { count })}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
  label: {
    color: Colors.inkDisabled,
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 3,
  },
})
