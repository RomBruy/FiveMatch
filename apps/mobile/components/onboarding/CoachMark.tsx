import { StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors } from '../../constants/colors'
import { Fonts, Radius } from '../../constants/tokens'
import { PressableScale } from '../ui/PressableScale'

export interface SpotlightRect {
  x: number
  y: number
  width: number
  height: number
  /** Pill for a dock tab, rounded rect for a card. */
  radius?: number
}

interface CoachMarkProps {
  /** Absolute rect to leave lit. Omit for a plain full-screen scrim. */
  spotlight?: SpotlightRect
  step: number
  totalSteps: number
  title: string
  body: string
  /** Where the callout sits relative to the spotlight. */
  placement?: 'above' | 'below'
  onSkip: () => void
  onNext: () => void
  nextLabel: string
}

/** Breathing room around the lit element so it never looks clipped. */
const PAD = 6

/**
 * One tutorial step, drawn over the live app.
 *
 * The cut-out is four solid rectangles around the target, not a mask. CSS would
 * do this with a huge box-shadow spread; React Native has no equivalent, and the
 * alternatives — an SVG mask, a blend mode — cost a dependency or a repaint per
 * frame for a thing that never animates. Four Views are exact and free.
 *
 * The steps sit on the real screen rather than on illustrations because the
 * point is not to describe the app, it is to show someone a place they will
 * have to find again on their own.
 */
export function CoachMark({
  spotlight,
  step,
  totalSteps,
  title,
  body,
  placement = 'above',
  onSkip,
  onNext,
  nextLabel,
}: CoachMarkProps) {
  const { t } = useTranslation()
  const { width, height } = useWindowDimensions()

  const lit = spotlight
    ? {
      x: spotlight.x - PAD,
      y: spotlight.y - PAD,
      width: spotlight.width + PAD * 2,
      height: spotlight.height + PAD * 2,
      radius: spotlight.radius ?? Radius.md,
    }
    : null

  return (
    // Not a Modal: the point is to sit over the running app, and a Modal would
    // put a new surface between the scrim and the thing being pointed at.
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {lit ? (
        <>
          <View style={[styles.scrim, { top: 0, left: 0, right: 0, height: lit.y }]} />
          <View style={[styles.scrim, { top: lit.y + lit.height, left: 0, right: 0, bottom: 0 }]} />
          <View style={[styles.scrim, { top: lit.y, left: 0, width: lit.x, height: lit.height }]} />
          <View style={[styles.scrim, {
            top: lit.y,
            left: lit.x + lit.width,
            width: Math.max(0, width - lit.x - lit.width),
            height: lit.height,
          }]} />
          <View
            pointerEvents="none"
            style={[styles.ring, {
              top: lit.y,
              left: lit.x,
              width: lit.width,
              height: lit.height,
              borderRadius: lit.radius,
            }]}
          />
        </>
      ) : (
        <View style={[styles.scrim, StyleSheet.absoluteFillObject]} />
      )}

      <View
        style={[
          styles.callout,
          lit && placement === 'above'
            ? { bottom: Math.max(24, height - lit.y + 14) }
            : lit
              ? { top: lit.y + lit.height + 14 }
              : { top: height * 0.32 },
        ]}
      >
        <Text style={styles.step}>{t('tutorial.stepOf', { step, total: totalSteps })}</Text>
        <Text style={styles.title}>{title.toUpperCase()}</Text>
        <Text style={styles.body}>{body}</Text>

        <View style={styles.actions}>
          {/* Always skippable, at every step. A tutorial you cannot leave is a
              wall, and people who hit a wall on first open do not come back. */}
          <PressableScale onPress={onSkip} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.skip}>{t('tutorial.skip')}</Text>
          </PressableScale>
          <View style={styles.dots}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <View key={i} style={[styles.dot, i < step && styles.dotOn]} />
            ))}
          </View>
          <PressableScale style={styles.next} onPress={onNext} accessibilityRole="button">
            <Text style={styles.nextText}>{nextLabel}</Text>
          </PressableScale>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.78)' },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  callout: {
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
    fontSize: 25,
    letterSpacing: 1.25, // 0.05em @ 25 (heading register)
  },
  body: { color: Colors.inkSecondary, fontFamily: Fonts.inter, fontSize: 12.5, lineHeight: 18 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 3 },
  skip: { color: Colors.inkDisabled, fontFamily: Fonts.interSemiBold, fontSize: 11.5 },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: Radius.full, backgroundColor: Colors.line },
  dotOn: { backgroundColor: Colors.primary },
  next: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { color: Colors.onPrimary, fontFamily: Fonts.interBold, fontSize: 12.5 },
})
