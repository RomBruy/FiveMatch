import { useState } from 'react'
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { LoopSpine } from '../brand/LoopSpine'
import { CoachMark, type SpotlightRect } from './CoachMark'

/**
 * Dock geometry, derived from TabDock's own layout rules rather than measured.
 *
 * Measuring would mean threading refs out of the tab bar and through the
 * navigator, and the dock's position is not a mystery: it is `min(340, width-40)`
 * wide, centred, `max(insets.bottom, 34)` from the bottom, 68 tall, with five
 * 48pt tabs spaced `space-around`.
 *
 * Kept beside those constants deliberately — if TabDock's dimensions change, the
 * spotlight silently drifts, and this comment is the only warning anyone gets.
 */
const DOCK_HEIGHT = 68
const DOCK_MAX_WIDTH = 340
const DOCK_SIDE_MARGIN = 40
const DOCK_BOTTOM_MIN = 34
const TAB_SIZE = 48
const TAB_COUNT = 5

function tabSpotlight(index: number, screenWidth: number, screenHeight: number, insetBottom: number): SpotlightRect {
  const dockWidth = Math.min(DOCK_MAX_WIDTH, screenWidth - DOCK_SIDE_MARGIN)
  const dockLeft = (screenWidth - dockWidth) / 2
  const dockTop = screenHeight - Math.max(insetBottom, DOCK_BOTTOM_MIN) - DOCK_HEIGHT
  // space-around: each slot is dockWidth/n, the item sits at its centre.
  const slot = dockWidth / TAB_COUNT
  const centreX = dockLeft + slot * (index + 0.5)
  return {
    x: centreX - TAB_SIZE / 2,
    y: dockTop + (DOCK_HEIGHT - TAB_SIZE) / 2,
    width: TAB_SIZE,
    height: TAB_SIZE,
    radius: Radius.full,
  }
}

interface TutorialOverlayProps {
  onFinish: () => void
}

const TOTAL_STEPS = 4

/**
 * The first-run tutorial.
 *
 * Four steps, never more. One explains the loop; two point at real places on the
 * running app; the last hands over to the starter checklist, which is the part
 * that survives the session.
 *
 * It never replays on its own — only from Aide → Revoir le tutoriel. A tutorial
 * that reappears is a punishment, and one that cannot be found again just moves
 * the question to support.
 */
export function TutorialOverlay({ onFinish }: TutorialOverlayProps) {
  const { t } = useTranslation()
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const [step, setStep] = useState(1)

  const next = () => (step >= TOTAL_STEPS ? onFinish() : setStep((s) => s + 1))

  // Step 1 — the loop. The only pure-text step, and it earns its place: the
  // four beats are what someone repeats to a friend when asked what this is.
  if (step === 1) {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={[styles.scrim, StyleSheet.absoluteFillObject]} />
        <View style={[styles.loopCard, { top: Math.max(insets.top + 80, height * 0.18) }]}>
          <Text style={styles.step}>{t('tutorial.stepOf', { step: 1, total: TOTAL_STEPS })}</Text>
          <Text style={styles.title}>{t('tutorial.loop.title').toUpperCase()}</Text>
          <Text style={styles.body}>{t('tutorial.loop.body')}</Text>
          <LoopSpine style={styles.spine} />
          <CoachMarkFooter
            onSkip={onFinish}
            onNext={next}
            step={1}
            total={TOTAL_STEPS}
            nextLabel={t('tutorial.next')}
          />
        </View>
      </View>
    )
  }

  if (step === 2) {
    return (
      <CoachMark
        spotlight={tabSpotlight(0, width, height, insets.bottom)}
        step={2}
        totalSteps={TOTAL_STEPS}
        title={t('tutorial.play.title')}
        body={t('tutorial.play.body')}
        placement="above"
        onSkip={onFinish}
        onNext={next}
        nextLabel={t('tutorial.next')}
      />
    )
  }

  if (step === 3) {
    return (
      <CoachMark
        spotlight={tabSpotlight(1, width, height, insets.bottom)}
        step={3}
        totalSteps={TOTAL_STEPS}
        title={t('tutorial.matches.title')}
        body={t('tutorial.matches.body')}
        placement="above"
        onSkip={onFinish}
        onNext={next}
        nextLabel={t('tutorial.next')}
      />
    )
  }

  return (
    <CoachMark
      step={4}
      totalSteps={TOTAL_STEPS}
      title={t('tutorial.ready.title')}
      body={t('tutorial.ready.body')}
      onSkip={onFinish}
      onNext={onFinish}
      nextLabel={t('tutorial.done')}
    />
  )
}

/** Shared footer so step 1 matches the coach-marked steps exactly. */
function CoachMarkFooter({ onSkip, onNext, step, total, nextLabel }: {
  onSkip: () => void
  onNext: () => void
  step: number
  total: number
  nextLabel: string
}) {
  const { t } = useTranslation()
  return (
    <View style={styles.actions}>
      <Text style={styles.skip} onPress={onSkip} accessibilityRole="button">
        {t('tutorial.skip')}
      </Text>
      <View style={styles.dots}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.dot, i < step && styles.dotOn]} />
        ))}
      </View>
      <Text style={styles.next} onPress={onNext} accessibilityRole="button">
        {nextLabel}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.78)' },
  loopCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: Colors.surfaceRaised,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.11)',
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 16,
    gap: 9,
  },
  step: {
    color: Colors.primary,
    fontFamily: Fonts.interSemiBold,
    fontSize: 9,
    letterSpacing: 1.53, // 0.17em @ 9 (label-caps register)
  },
  title: {
    color: Colors.ink,
    fontFamily: Fonts.bebas,
    fontSize: 27,
    letterSpacing: 1.35, // 0.05em @ 27 (heading register)
  },
  body: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 12.5, lineHeight: 18 },
  spine: { marginTop: 4, backgroundColor: Colors.bg },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 5 },
  skip: { color: Colors.inkDisabled, fontFamily: Fonts.interSemiBold, fontSize: 11.5 },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: Radius.full, backgroundColor: Colors.line },
  dotOn: { backgroundColor: Colors.primary },
  next: {
    height: 38,
    lineHeight: 38,
    paddingHorizontal: 18,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    color: Colors.onPrimary,
    fontFamily: Fonts.interBold,
    fontSize: 12.5,
    overflow: 'hidden',
  },
})
