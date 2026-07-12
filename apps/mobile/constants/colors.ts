// Design v2 "Prime Time" palette — source of truth: DESIGN.md (v2, canonical 2026-07-12)
export const Colors = {
  // Ground (dark, core app)
  bg: '#101013',
  surface: '#1B1B1F',
  surfaceRaised: '#26262C',

  // Primary — Rouge maillot
  primary: '#FF4438',
  primaryPress: '#E23A2E',
  primaryDeep: '#A8231C', // gradient stop — hero bands & card band ONLY
  primarySubtle: 'rgba(255,68,56,0.14)',
  glow: 'rgba(255,68,56,0.35)', // one glow max per screen
  onPrimary: '#FFFFFF',

  // Prestige
  gold: '#FFD60A',
  goldDim: '#C9A800',
  rankSilver: '#A9A9B2',
  rankBronze: '#C47B3A',

  // Semantics
  success: '#32D74B',
  successSubtle: 'rgba(50,215,75,0.14)',

  // Text
  ink: '#FFFFFF',
  inkSecondary: '#9A9AA3',
  inkDisabled: '#54545E',

  // Borders
  line: '#2B2B32',
  hairline: 'rgba(255,255,255,0.07)',

  // Paper (light editorial surface — date picker, join/[code], share export ONLY)
  paper: '#EDEAE3',
  paperCard: '#F6F4EF',
  paperInk: '#141412',
  paperInk2: '#6E6A61',
  paperDot: '#D8D4CA',
  paperRed: '#D42D22', // primary deepens on paper for contrast; carries prestige on paper (no gold on bone)
} as const

export type ColorKey = keyof typeof Colors
