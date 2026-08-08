/**
 * Match operation constants (Phase 6).
 *
 * Deliberately apart from OVR and trust constants: these govern how a fixture is
 * run, not how anyone is scored, and nothing here may ever reach a rating path.
 */

/**
 * Fewest confirmed players before attendance may be locked (ADR-032).
 *
 * Not a quality bar — the host decides whether the game is on. Below four there
 * is simply no match to play.
 */
export const MATCH_MIN_PLAYABLE_TOTAL = 4
