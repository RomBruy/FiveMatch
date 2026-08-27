// Design v2 "Prime Time" tokens — source of truth: DESIGN.md (v2, canonical 2026-07-12)
// RN letterSpacing is in points (not em): values below are pre-converted at each register's base size.
import { Easing } from 'react-native-reanimated'

/** Closed radius scale — nothing outside it. Containers 12/16/24; pressables are pills; the card is 20. */
export const Radius = {
  sm: 12,
  md: 16,
  lg: 24,
  full: 999,
  card: 20,
} as const

/** PostScript names of the five loaded faces (loaded once in app/_layout.tsx). */
export const Fonts = {
  bebas: 'BebasNeue_400Regular',
  inter: 'Inter_400Regular',
  interMedium: 'Inter_500Medium',
  interSemiBold: 'Inter_600SemiBold',
  interBold: 'Inter_700Bold',
} as const

/**
 * Typography registers. Bebas is single-weight — hierarchy by size/spacing, never fake bold.
 * One display voice dominates per screen; `numeral` appears at most once per screen.
 * Size ranges (e.g. numeral 72–96) expose min/max; pick within range at the call site.
 */
export const Type = {
  /** Kick-off time, score, OVR hero, date numeral. ONE per screen. Tabular. */
  numeral: {
    fontFamily: Fonts.bebas,
    minSize: 72,
    maxSize: 96,
    letterSpacing: -0.72, // -0.01em @ 72
    fontVariant: ['tabular-nums'] as const,
  },
  /** Screen titles. */
  display: {
    fontFamily: Fonts.bebas,
    minSize: 36,
    maxSize: 44,
    letterSpacing: 1.44, // 0.04em @ 36
  },
  /** Card name, team headers, rank OVR. */
  heading: {
    fontFamily: Fonts.bebas,
    minSize: 18,
    maxSize: 24,
    letterSpacing: 2.16, // 0.12em @ 18 (range 0.10–0.14em)
  },
  /** Outline background texture: never content, always aria-hidden. */
  texture: {
    fontFamily: Fonts.bebas,
    minSize: 140,
    maxSize: 220,
    letterSpacing: 2.8, // 0.02em @ 140
  },
  /** OVR pills, counters, code boxes (invite code widens to 0.34em ≈ 6.1 @ 18). */
  stat: {
    fontFamily: Fonts.bebas,
    minSize: 14,
    maxSize: 22,
    letterSpacing: 0.56, // 0.04em @ 14
  },
  /** Body copy. */
  body: {
    fontFamily: Fonts.inter,
    minSize: 14,
    maxSize: 15,
    letterSpacing: 0,
  },
  /** CTAs (sentence case, never uppercase) and names. */
  bodyStrong: {
    fontFamily: Fonts.interBold,
    minSize: 15,
    maxSize: 15,
    letterSpacing: 0.3, // 0.02em @ 15
  },
  /** Section labels, phase text. Uppercase at call site. */
  labelCaps: {
    fontFamily: Fonts.interSemiBold,
    minSize: 10,
    maxSize: 11,
    letterSpacing: 1.54, // 0.14em @ 11 (range 0.14–0.16em)
  },
  /** Card footer, badges. */
  micro: {
    fontFamily: Fonts.interSemiBold,
    minSize: 8.5,
    maxSize: 10,
    letterSpacing: 1.2, // mid of 0.06–0.2em range @ 10
  },
} as const

/** Motion durations (ms) and delays. Animate transform/opacity only; respect reduced motion. */
export const Motion = {
  press: 120,
  toggle: 180,
  screen: 280,
  sheet: 320,
  reveal: 800,
  ovrPop: 550,
  ovrPopDelay: 900,
  ctaSlide: 500,
  ctaSlideDelay: 1000,
  dockActivate: 250,
  ringSweep: 600,
  countdownTick: 1000,
  /** Screen entrance cascade: per-item delay step and single-item fade-up duration (Story 10.3). */
  staggerStep: 70,
  staggerItem: 500,
  /** Live numeral climb when a value changes in view (Story 10.5). */
  countUp: 900,
  /** Native-to-React brand-frame handoff (Story 10.6). */
  splashHandoff: 400,
  /**
   * Floor for how long the brand frame stays up before it starts fading.
   *
   * Bootstrap on a warm start finishes before the first frame is even composited,
   * so the fade began immediately and testers reported seeing no splash at all.
   * The frame is the one moment the app has undivided attention; it needs to be
   * on screen long enough to read the promise line.
   */
  splashMinDwell: 1100,
} as const

/** Reanimated-compatible easing/spring configs matching the motion table. */
export const MotionEasing = {
  /** Screen transitions, card reveal: cubic-bezier(.16,1,.3,1). */
  signature: Easing.bezier(0.16, 1, 0.3, 1),
  /** Button press, toggles, ring sweep, CTA slide-up. */
  out: Easing.out(Easing.ease),
} as const

/** Bottom sheet + tab dock activation spring. */
export const MotionSpring = {
  sheet: { damping: 24, stiffness: 260 },
} as const
