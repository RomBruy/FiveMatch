import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import Animated, { ReduceMotion, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts, Motion, MotionEasing } from '../../constants/tokens'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const RING_SIZE = 150
const STROKE_WIDTH = 16
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2
const CENTER = RING_SIZE / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * The API fairnessScore is a composite penalty — lower is more balanced
 * (team-generator.service.ts). The ring displays a 0–100 score — higher is
 * better. This piecewise-linear map preserves the Story 3.5 tier boundaries
 * exactly: penalty ≤10 ⇔ display ≥85 (excellent), penalty ≤20 ⇔ display ≥60
 * (good), else <60 (adjust) — the same penalty always keeps the same tier
 * copy as the pre-restyle text display. Product scoring logic is untouched.
 */
export function fairnessDisplayScore(penalty: number): number {
  let display: number
  if (penalty <= 10) display = 100 - 1.5 * penalty
  else if (penalty <= 20) display = 85 - 2.5 * (penalty - 10)
  else display = 60 - 2 * (penalty - 20)
  // floor, not round: display never overstates the tier, so the shown value
  // and its tier boundary stay exactly consistent with the penalty tiers.
  return Math.floor(Math.min(100, Math.max(0, display)))
}

export interface FairnessTier {
  color: string
  labelKey: string
}

/** Tiers on the displayed 0–100 value. Gold tier uses goldDim — gold itself stays reserved for OVR/P1 surfaces. */
export function getFairnessTier(displayScore: number): FairnessTier {
  if (displayScore >= 85) return { color: Colors.success, labelKey: 'match.generate.fairness.excellent' }
  if (displayScore >= 60) return { color: Colors.goldDim, labelKey: 'match.generate.fairness.good' }
  return { color: Colors.primary, labelKey: 'match.generate.fairness.adjust' }
}

interface FairnessRingProps {
  /** Raw composite penalty from the generation result (lower = better). */
  score: number
}

export function FairnessRing({ score }: FairnessRingProps) {
  const { t } = useTranslation()
  const displayScore = fairnessDisplayScore(score)
  const tier = getFairnessTier(displayScore)
  const progress = useSharedValue(0)

  useEffect(() => {
    // Entry sweep 0 → value on every new generation result; system reduced
    // motion jumps straight to the final value.
    progress.value = 0
    progress.value = withTiming(displayScore, {
      duration: Motion.ringSweep,
      easing: MotionEasing.out,
      reduceMotion: ReduceMotion.System,
    })
  }, [displayScore])

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value / 100),
  }))

  return (
    <View
      style={styles.container}
      accessible
      accessibilityLabel={t('match.generate.fairness.a11y', { score: displayScore, tier: t(tier.labelKey) })}
    >
      <View style={styles.ringWrap}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={Colors.surfaceRaised}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          {/* conic-gradient is CSS-only — the arc's stroke carries the tier color instead. */}
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            stroke={tier.color}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            animatedProps={animatedProps}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
          />
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.value}>{displayScore}</Text>
          <Text style={styles.centerLabel}>{t('match.generate.fairness.ringLabel')}</Text>
        </View>
      </View>
      <Text style={[styles.tierLabel, { color: tier.color }]}>{t(tier.labelKey)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontFamily: Fonts.bebas,
    fontSize: 44,
    lineHeight: 46,
    color: Colors.ink,
    fontVariant: ['tabular-nums'],
  },
  centerLabel: {
    color: Colors.inkSecondary,
    fontSize: 9.5,
    fontFamily: Fonts.interSemiBold,
    letterSpacing: 1.33, // 0.14em @ 9.5 (label-caps register)
    textTransform: 'uppercase',
    marginTop: 3,
  },
  tierLabel: {
    fontSize: 13,
    fontFamily: Fonts.interSemiBold,
    textAlign: 'center',
    marginTop: 10,
  },
})
