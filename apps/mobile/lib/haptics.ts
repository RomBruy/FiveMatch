import * as Haptics from 'expo-haptics'

/**
 * Centralized haptics — every buzz in the app routes through here so the
 * mapping (selection vs impact vs success) lives in one place and every call is
 * guarded (expo-haptics rejects on hardware without a Taptic Engine / when the
 * OS disables it). Haptics are always paired with a visible state change — never
 * the only signal (DESIGN.md → Interaction & Feel).
 */

type ImpactStyle = 'Light' | 'Medium' | 'Heavy'

const IMPACT: Record<ImpactStyle, Haptics.ImpactFeedbackStyle> = {
  Light: Haptics.ImpactFeedbackStyle.Light,
  Medium: Haptics.ImpactFeedbackStyle.Medium,
  Heavy: Haptics.ImpactFeedbackStyle.Heavy,
}

/** A selection tick — segmented toggles, tab changes. */
function selection() {
  Haptics.selectionAsync().catch(() => {})
}

/** A physical tap — confirmations, share, the card landing. */
function impact(style: ImpactStyle = 'Medium') {
  Haptics.impactAsync(IMPACT[style]).catch(() => {})
}

/** A success flourish — the OVR reveal. */
function success() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {})
}

export const haptics = { selection, impact, success }
