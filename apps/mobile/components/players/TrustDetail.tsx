import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts, Radius, Type } from '../../constants/tokens'

interface TrustDetailProps {
  reliability: number | null
  fairPlay: number | null
  sampleCount: number
}

/**
 * The owner's own standing, and owner-only by contract (ADR-019).
 *
 * Nobody else ever sees these numbers — a stranger gets a match count and the
 * earned check, nothing more. Shown to you because a score you cannot see is
 * not feedback, and because it is your data.
 *
 * Fair play appears here and on no other screen in the app.
 */
export function TrustDetail({ reliability, fairPlay, sampleCount }: TrustDetailProps) {
  const { t } = useTranslation()

  // Below the sample floor there is no score yet — say so plainly rather than
  // showing a number built on two data points.
  if (reliability === null) {
    return (
      <View style={styles.card}>
        <Text style={styles.pending}>{t('profile.trust.building', { count: sampleCount })}</Text>
      </View>
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.label}>{t('profile.trust.reliability')}</Text>
        <Text style={styles.value}>{reliability}%</Text>
      </View>
      {fairPlay !== null && (
        <View style={styles.row}>
          <Text style={styles.label}>{t('profile.trust.fairPlay')}</Text>
          <Text style={styles.value}>{fairPlay}%</Text>
        </View>
      )}
      <Text style={styles.footnote}>{t('profile.trust.window', { count: sampleCount })}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.lg,
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: Fonts.interSemiBold,
    fontSize: 11,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: Colors.inkSecondary,
  },
  value: {
    fontFamily: Fonts.bebas,
    fontSize: Type.stat.maxSize,
    color: Colors.ink,
  },
  pending: {
    fontFamily: Fonts.inter,
    fontSize: 13,
    color: Colors.inkSecondary,
  },
  footnote: {
    fontFamily: Fonts.inter,
    fontSize: 11,
    color: Colors.inkDisabled,
  },
})
