import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'

interface SpotsMeterProps {
  confirmed: number
  capacity: number
  spotsRemaining: number
  /** Compact drops the pip row and keeps only the count — for dense list rows. */
  compact?: boolean
  /** 'paper' for the bone editorial surfaces (shared-link preview, invite). */
  tone?: 'dark' | 'paper'
}

const MAX_PIPS = 14

/**
 * "9/10 — 1 place" as a glanceable object.
 *
 * This is the single most important number on a discovery card: it is what turns
 * a listing into a decision. Pips over a bar because at five-a-side scale the
 * exact headcount matters, and one missing pip reads faster than 90% of a bar.
 */
export function SpotsMeter({
  confirmed,
  capacity,
  spotsRemaining,
  compact = false,
  tone = 'dark',
}: SpotsMeterProps) {
  const { t } = useTranslation()
  const filled = Math.min(confirmed, capacity)
  const almostFull = spotsRemaining > 0 && spotsRemaining <= 2
  const paper = tone === 'paper'

  return (
    <View style={styles.container}>
      {!compact && capacity <= MAX_PIPS && (
        <View style={styles.pips}>
          {Array.from({ length: capacity }, (_, i) => (
            <View
              key={i}
              style={[
                styles.pip,
                i < filled
                  ? (paper ? styles.pipFilledPaper : styles.pipFilled)
                  : (paper ? styles.pipEmptyPaper : styles.pipEmpty),
              ]}
            />
          ))}
        </View>
      )}
      <View style={styles.readout}>
        <Text style={[styles.count, paper && styles.countPaper]}>{filled}/{capacity}</Text>
        <Text
          style={[
            styles.spots,
            paper && styles.spotsPaper,
            spotsRemaining === 0 && styles.spotsFull,
            almostFull && (paper ? styles.spotsUrgentPaper : styles.spotsUrgent),
          ]}
        >
          {spotsRemaining === 0
            ? t('match.spots.full')
            : t('match.spots.remaining', { count: spotsRemaining })}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  pips: {
    flexDirection: 'row',
    gap: 3,
  },
  pip: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
  pipFilled: {
    backgroundColor: Colors.ink,
  },
  pipEmpty: {
    backgroundColor: Colors.line,
  },
  pipFilledPaper: {
    backgroundColor: Colors.paperInk,
  },
  pipEmptyPaper: {
    backgroundColor: Colors.paperDot,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  count: {
    fontFamily: Fonts.bebas,
    fontSize: 20,
    letterSpacing: 0.8,
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
  spots: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: Colors.inkSecondary,
  },
  spotsUrgent: {
    color: Colors.primary,
  },
  spotsUrgentPaper: {
    color: Colors.paperRed,
  },
  spotsFull: {
    color: Colors.inkDisabled,
  },
  countPaper: {
    color: Colors.paperInk,
  },
  spotsPaper: {
    color: Colors.paperInk2,
  },
})
