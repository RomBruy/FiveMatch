// Specced render treatments — gradient stops and one-off render colors from
// DESIGN.md component specs. These are not palette tokens (they never carry
// semantics on their own); they live here so no hex literal exists outside constants/.
import { Colors } from './colors'

export const Gradients = {
  /** Panini card bone ground (L'Éditoriale frame spec). */
  paperCard: ['#F4F1EA', '#E7E3D8'],
  /** Duotone avatar grounds (135deg spec). */
  duotoneDefault: ['#3B3B44', '#222227'],
  duotoneEmber: ['#4A2320', '#2A1512', '#1A0E0C'],
  /** Ember gradient corner (NarrativeLoader texture). */
  emberCorner: ['#4A2320', 'rgba(42,21,18,0.35)', 'rgba(16,16,19,0)'],
  /** Next-match hero card ground (Accueil mockup: 150deg #221316 → surface at 55%). */
  heroEmber: ['#221316', Colors.surface],
  /** MVP ceremony card deep-red 140deg gradient. */
  mvpCeremony: ['#E23A2E', Colors.primaryDeep, '#6E140E'],
  /** Pitch board tactical surface (NOT grass green — anti-reference). */
  pitch: ['#17171C', '#101014'],
  /** Card silhouette cutouts — paper and dark palettes. */
  silhouettePaperHead: ['#8B8B95', '#5E5E68'],
  silhouettePaperTorso: ['#7E7E88', '#54545E', '#44444C'],
  silhouetteDarkHead: ['#42424C', '#1E1E24'],
  silhouetteDarkTorso: ['#3D3D47', '#23232B', '#17171C'],
} as const

/** Story share graphic radial ember ground (150% 110% at 50% 0%). */
export const StoryEmber = {
  center: '#3A1713',
  mid: '#170B09',
  edge: '#0C0C0E',
} as const

export const RenderColors = {
  /** Équipe B ring on the pitch board (mockup .av.ring-white). */
  teamBRing: '#E8E8EE',
  /** Ember duotone initials. */
  emberInitials: '#E8A9A2',
  /** Drop shadows. */
  shadow: '#000000',
} as const
