export const Colors = {
  bg: '#111111',
  surface: '#1C1C1E',
  surfaceRaised: '#2C2C2E',
  primary: '#FF3B47',
  primaryHover: '#E5303C',
  primarySubtle: 'rgba(255,59,71,0.15)',
  gold: '#FFD60A',
  goldDim: '#C9A800',
  rankSilver: '#A8A8B0',
  rankBronze: '#C47B3A',
  success: '#32D74B',
  ink: '#FFFFFF',
  inkSecondary: '#8E8E93',
  inkDisabled: '#48484A',
} as const

export type ColorKey = keyof typeof Colors
