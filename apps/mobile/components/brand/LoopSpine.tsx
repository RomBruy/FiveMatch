import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Radius, Type } from '../../constants/tokens'

/** The product's real cycle, in order. Not a metaphor — each beat is a screen. */
const BEATS = ['find', 'play', 'rate', 'card'] as const
export type LoopBeat = (typeof BEATS)[number]

interface LoopSpineProps {
  /** Beat the viewer is currently on (1-4). Earlier beats read as done. */
  current?: number
  /** Drops the one-line descriptions — for tight surfaces like an empty state. */
  compact?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * TROUVE → JOUE → NOTE → CARTE.
 *
 * The branding fix is not a new logo, it is repetition: the same four words in
 * the same order, on the splash, in the tutorial, and inside every empty screen.
 * Someone who has seen it three times can explain the app to a friend.
 */
export function LoopSpine({ current, compact = false, style }: LoopSpineProps) {
  const { t } = useTranslation()

  return (
    <View
      style={[styles.spine, style]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={BEATS.map((b) => t(`brand.loop.${b}.title`)).join(' · ')}
    >
      {BEATS.map((beat, index) => {
        const step = index + 1
        const reached = current !== undefined && step <= current
        return (
          <View key={beat} style={[styles.beat, index > 0 && styles.beatDivided]}>
            <Text style={[styles.step, reached && styles.stepReached]}>{step}</Text>
            <Text style={[styles.word, current !== undefined && !reached && styles.wordAhead]}>
              {t(`brand.loop.${beat}.title`).toUpperCase()}
            </Text>
            {!compact && <Text style={styles.body}>{t(`brand.loop.${beat}.body`)}</Text>}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  spine: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 14,
  },
  beat: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingRight: 10,
  },
  beatDivided: {
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: Colors.hairline,
  },
  step: {
    color: Colors.inkDisabled,
    fontFamily: Type.stat.fontFamily,
    fontSize: 14,
    letterSpacing: 1.96, // 0.14em @ 14 (stat register)
  },
  stepReached: {
    color: Colors.primary,
  },
  word: {
    color: Colors.ink,
    fontFamily: Type.heading.fontFamily,
    fontSize: 18,
    letterSpacing: 1.26, // 0.07em @ 18 (heading register, tightened for four columns)
  },
  /** Beats not yet reached stay legible but recede — never hidden. */
  wordAhead: {
    color: Colors.inkSecondary,
  },
  body: {
    color: Colors.inkSecondary,
    fontFamily: Type.body.fontFamily,
    fontSize: 10.5,
    lineHeight: 13.5,
  },
})
