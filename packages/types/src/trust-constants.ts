/**
 * Trust constants — reliability and fair play (Phase 3).
 *
 * These live apart from `algorithm-constants.ts` on purpose, and the separation
 * is load-bearing in two directions:
 *
 * 1. Reliability and fair play must never influence OVR. A separate module with
 *    its own version makes that boundary something you can test rather than
 *    something you have to remember.
 * 2. The OVR golden regression freezes ALGORITHM_CONSTANTS_VERSION by exact
 *    value. Adding a trust constant there would bump that version and break the
 *    guard protecting the OVR formula — the guard would fail for a change that
 *    has nothing to do with OVR, and the temptation would be to weaken it.
 *
 * See ADR-019 and ADR-028.
 */

/** Bumped when any constant below changes. Independent of the OVR version. */
export const TRUST_CONSTANTS_VERSION = 'v1.0'

// ─── Cancellation (ADR-028) ───────────────────────────────────────────────────

/**
 * Hours before kickoff separating an excused absence from a late cancellation.
 * A crew may override it via `groups.cancellation_deadline_hours`; a standalone
 * match has no crew and always uses this default.
 *
 * Twelve is deliberate: 24 is punitive for amateur five-a-side, 6 leaves no
 * realistic chance of finding a replacement. This gives a host one evening.
 */
export const DEFAULT_CANCELLATION_DEADLINE_HOURS = 12

/**
 * Why a player gave up a seat, as they declared it. One tap, never typed.
 *
 * Explicitly NOT an input to reliability. `excused` vs `late_cancel` remains a
 * function of when they withdrew against the deadline above — a self-declared
 * reason is not evidence, and scoring it would only teach everyone to pick the
 * softest option. This exists so the organiser reads a sentence instead of
 * guessing at a gap, which is what makes withdrawing cheaper than going silent.
 */
export const CANCELLATION_REASONS = ['unexpected', 'injured', 'wrong_date'] as const

export type CancellationReason = typeof CANCELLATION_REASONS[number]

/**
 * Hours after completion before the system finalizes attendance itself (ADR-029).
 *
 * Card eligibility requires a finalized `attended` outcome, so without this a
 * player's card progression would hang on whether their host remembered to
 * confirm the sheet. Automatic finalization derives outcomes from the same
 * stored facts a host would have confirmed — it decides nothing new.
 */
export const CARD_AUTO_FINALIZE_HOURS = 48

// ─── Behaviour reports (ADR-027) ──────────────────────────────────────────────

/**
 * Independent reporters who must agree before a report finalizes without a
 * validator. One person must never be able to move another player's standing
 * on their own say-so.
 */
export const BEHAVIOUR_CORROBORATION_MIN_REPORTERS = 2

/**
 * How long a pending report stays open. After this it expires and counts for
 * nothing, permanently.
 *
 * A standalone match has no crew authority to resolve anything, and FiveMatch
 * operates no moderation team. An expiring report is honest about that; a report
 * that waits forever for a reviewer who does not exist is not.
 */
export const BEHAVIOUR_REPORT_WINDOW_HOURS = 72

/** Categories that count against fair play, with their relative severity. */
export const BEHAVIOUR_NEGATIVE_WEIGHTS = {
  dangerous_play: 3,
  aggression: 3,
  abusive_language: 2,
  unsporting: 1,
} as const

/** Categories that credit fair play. Their total contribution is capped. */
export const BEHAVIOUR_POSITIVE_WEIGHTS = {
  good_spirit: 1,
  helped_organize: 1,
} as const

// ─── Projections (ADR-019) ────────────────────────────────────────────────────

/**
 * How far back reliability and fair play remember. Roughly half a season of
 * weekly football: long enough that one bad night does not define you, short
 * enough that a real pattern surfaces. Older matches fall out entirely.
 */
export const TRUST_WINDOW_MATCHES = 20

/** Matches until a record carries half its original weight. */
export const TRUST_RECENCY_HALF_LIFE = 10

/** Finalized records needed before a score is calculated at all. */
export const TRUST_MIN_SAMPLE = 4

export const RELIABILITY_WEIGHTS = {
  attended: 1.0,
  /** Turned up, but late. Still turned up. */
  attendedLate: 0.85,
  /** Cancelled with notice, beyond the free allowance below. */
  excused: 0.7,
  lateCancel: 0.3,
  noShow: 0.0,
} as const

/**
 * Excused absences inside the window that cost nothing. Scoped to the window, so
 * the allowance refreshes as old records age out — no separate counter is stored.
 * Life happens; the third cancellation in twenty matches is a pattern.
 */
export const RELIABILITY_FREE_EXCUSES = 2

/**
 * The public check mark. Both bars must be cleared.
 *
 * The match minimum is not a quality bar — it exists so that most players
 * *without* the mark simply have not played enough yet. If absence of the mark
 * ever becomes a reliable negative signal, this number is too low and the mark
 * has quietly turned into the scarlet letter ADR-019 rejects.
 */
export const RELIABLE_CHECK_MIN_MATCHES = 8
export const RELIABLE_CHECK_MIN_SCORE = 85

export const FAIR_PLAY_START = 100
/** Score subtracted per unit of negative category weight. */
export const FAIR_PLAY_PENALTY_PER_WEIGHT = 5
/** Score added per unit of positive category weight. */
export const FAIR_PLAY_CREDIT_PER_WEIGHT = 2
/** Ceiling on total positive contribution, which bounds any praise-farming. */
export const FAIR_PLAY_POSITIVE_CAP = 10
