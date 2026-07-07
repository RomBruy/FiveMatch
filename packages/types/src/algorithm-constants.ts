// algorithm-constants.ts v2.0 — changes require PR review and version bump in ALGORITHM_CONSTANTS_VERSION

export const ALGORITHM_CONSTANTS_VERSION = 'v2.0'

// ─── OVR Attribute Weights ────────────────────────────────────────────────────
// match_impact = Σ(attribute × weight). Weights sum to exactly 1.0.
// Technique + Defending highest — most decisive in 5v5.
// Mentality/personality attribute is collected but NOT included here; it is
// stored per-match and displayed as a social badge on the Panini Card only.
export const OVR_ATTRIBUTE_WEIGHTS = {
  technique: 0.25,
  defending: 0.20,
  effort: 0.20,
  passing: 0.15,
  physicality: 0.10,
  pace: 0.10,
} as const

// ─── Adaptive EMA — alpha constants ───────────────────────────────────────────
// Two roles, two mechanisms:
//   matchCount drives SETTLING: baseAlpha decays as you accumulate matches,
//     regardless of who rated you. OVR stabilises into a stable identity over time.
//   distinctRatersCount drives a DIVERSITY GUARD: a bounded +DIVERSITY_SPRING bonus
//     keeps alpha slightly springy when your evidence base is narrow relative to the
//     available group. Prevents alpha from freezing at floor in small groups where
//     everyone has already rated everyone (pure-diversity decay was a regression in
//     those groups because distinctRatersCount plateaued, breaking fix #4).
//
// Formula:
//   baseAlpha         = max(ALPHA_FLOOR, ALPHA_BASE − matchCount × ALPHA_DECAY)
//   diversityRatio    = distinctRatersCount / diversityTarget   (target = min(rosterSize-1, CAP))
//   diversityGuard    = DIVERSITY_SPRING × max(0, 1 − diversityRatio)
//   adjustedBaseAlpha = min(ALPHA_CEIL, baseAlpha + diversityGuard)
//   finalAlpha        = clamp(adjustedBaseAlpha × evidenceQuality × tierMultiplier, FLOOR, CEIL)
//   new_ovr           = clamp(oldOvr + finalAlpha × (matchImpact − oldOvr), 40, 99)
export const ALPHA_BASE  = 0.22   // starts lower than v1 (0.25) — OVR is stable skill, not recent form
export const ALPHA_DECAY = 0.006  // per-match decay; floor reached after ~20 matches
export const ALPHA_FLOOR = 0.10   // minimum alpha; veteran OVR stays stable
export const ALPHA_CEIL  = 0.30   // maximum alpha; honest upper bound (tier×evidenceQuality can't exceed this)

// Diversity guard — keeps alpha slightly springy when evidence is genuinely narrow.
// DIVERSITY_SPRING: max additive bonus on baseAlpha (at zero diverse raters).
//   At evidenceQuality=0.6, club tier: +0.05×0.6 = +0.03 to effective alpha.
//   For a 20-OVR gap that's ~0.6 OVR extra per match — sub-threshold but accumulates.
//   ⚠ UNVALIDATED — tune once historical match data is available.
// DIVERSITY_TARGET_CAP: cap on min(rosterSize-1, CAP). Groups of 9+ are treated
//   identically, matching recreational 5v5 group sizes.
export const DIVERSITY_SPRING     = 0.05
export const DIVERSITY_TARGET_CAP = 8

// ─── Rater count divisor ──────────────────────────────────────────────────────
// 5v5: only the opposing 5 can rate you. v1 used /6, which under-weighted every
// update by ~17% and capped evidence quality at 0.833.
export const RATER_FULL = 5

// ─── Group Tier Multipliers ───────────────────────────────────────────────────
// Folded into alpha inside a single honest clamp (v2 fix #1).
// In v1, tier was applied after the alpha clamp, pushing elite to 0.36 and
// amateur to 0.08 — both outside the stated [0.10, 0.30] bound.
export const GROUP_TIER_MULTIPLIERS = {
  amateur: 0.8,
  club: 1.0,
  semiPro: 1.1,
  elite: 1.2,
} as const

// ─── Group Tier Thresholds ────────────────────────────────────────────────────
// Number of group matches required to reach each tier (inclusive lower bound).
// Source: PRD FR-42: Amateur (0–4), Club (5–19), Semi-Pro (20–49), Elite (50+)
export const GROUP_TIER_THRESHOLDS = {
  amateur: 0,
  club: 5,
  semiPro: 20,
  elite: 50,
} as const

// ─── Player Tier Thresholds ───────────────────────────────────────────────────
// Minimum ovrScore (integer, 40–99 scale) to reach each tier.
// Rookie: ovrScore < 55 (default until enough match data)
// Joueur: 55 ≤ ovrScore ≤ 67
// Performeur: 68 ≤ ovrScore ≤ 78
// Crack: ovrScore ≥ 79
export const PLAYER_TIER_THRESHOLDS = {
  joueur: 55,       // >= 55 → Joueur
  performeur: 68,   // >= 68 → Performeur
  crack: 79,        // >= 79 → Crack
  // < joueur → Rookie (default)
} as const

export type PlayerTier = 'rookie' | 'joueur' | 'performeur' | 'crack'

// ─── Tier Hysteresis ──────────────────────────────────────────────────────────
// A player must cross a boundary by this margin before a tier change fires.
// Prevents flip-flopping and PLAYER_TIER_CHANGED notification spam for players
// parked near a boundary.
export const TIER_MARGIN = 0.5

// ─── Organizer Rating Weight ──────────────────────────────────────────────────
// Organizer's rating counts 2× when computing initial OVR from peer ratings.
export const ORGANIZER_RATING_WEIGHT = 2

// ─── Form Window Weights ──────────────────────────────────────────────────────
// Raw weights for last 3–5 matches, most recent first (index 0 = most recent).
// Consumer normalises: weight[i] / sum(FORM_WEIGHTS).
// [5,4,3,2,1] → sum=15; most recent match = 5/15 ≈ 33% of form value.
export const FORM_WEIGHTS = [5, 4, 3, 2, 1] as const

// ─── Objective Signals (Step 5) ───────────────────────────────────────────────
// Small capped nudges added to matchImpactBase after calibration.
// Together at most ≈ +5.5 / −2 OVR on the match target, which the EMA (α ≈ 0.10–0.20)
// shrinks to well under ±1 OVR of actual movement per match.
// Peer opinion remains the dominant driver.

// MVP: one-directional additive bonus on the calibrated OVR target.
// Replaces v1 blend (matchImpactClamped × 0.97 + 80 × 0.03) which penalised
// elite players (fixed point at 80 dragged down anyone performing above 80).
export const MVP_BONUS = 1.5

// Goals/assists: explicit, capped, diminishing.
// Replaces v1 ephemeral attribute boost (removed to avoid double-counting —
// the 5 opponents already saw the goals and rated technique/finishing accordingly).
export const GOAL_PT  = 0.6   // per goal, OVR scale
export const ASSIST_PT = 0.4  // per assist, OVR scale
export const OBJECTIVE_GOAL_CAP = 2.0  // hat-trick can't explode the rating

// Match result: Playtomic-style expected-adjusted.
// Win/draw/loss only — a 9-0 blowout counts the same as 1-0.
// Rewards over-performing vs expectation; beating a team you were meant to beat gives ≈ 0.
// Not scoring is never a penalty; only losing to a weaker side dings you.
export const OUTCOME_WEIGHT   = 2.0   // max +/−2 OVR from match result
export const EXPECTED_SCALE_D = 40    // OVR gap for ~64% expected win probability

// ─── Pronos Scoring Points ────────────────────────────────────────────────────
// Points awarded per correct prediction type. Exact score and result are exclusive:
// if exact score is correct, PRONOS_POINTS_EXACT_SCORE is awarded instead of
// PRONOS_POINTS_RESULT (not in addition). MVP is always independent.
// Maximum achievable: PRONOS_POINTS_EXACT_SCORE + PRONOS_POINTS_MVP = 70.
export const PRONOS_POINTS_EXACT_SCORE = 50
export const PRONOS_POINTS_RESULT = 30
export const PRONOS_POINTS_MVP = 20

// PRONOS_MVP_SIGNAL_VALUE / PRONOS_MVP_SIGNAL_WEIGHT are intentionally NOT defined here.
// OVR = player performance. Pronos = prediction accuracy. These systems are fully separate.
// See: docs/algorithm-decisions.md §"Core Principle" and §"Pronos Signal"

// ─── OVR Clamping ─────────────────────────────────────────────────────────────
// Per FR-15: OVR is always clamped to [40, 99] after any EMA update.
// 40 = minimum achievable OVR (prevents collapse to 0 for poor performers).
// 99 = maximum (preserves room above for exceptional future data).
export const OVR_CLAMP_MIN = 40
export const OVR_CLAMP_MAX = 99

// ─── OVR Trend Display ────────────────────────────────────────────────────────
// Float delta below this threshold is displayed as "Stable" rather than up/down.
// Prevents noise when sub-integer EMA moves are too small to be meaningful.
export const OVR_TREND_STABILITY_THRESHOLD = 0.15

// ─── OVR Calibration Anchors (smoothed, monotonic slopes) ────────────────────
// Piecewise-linear mapping from attribute score (1–10 scale) to OVR domain (40–99).
// Slopes: 5.5 → 6 → 6.5 → 7.5 → 8, strictly increasing so improvement always pays
// off, more so at the top of the scale.
// Semantic anchors (from algorithm-decisions.md):
//   1/10  → 40  (Very poor)
//   3/10  → 51  (Weak)
//   5/10  → 63  (Acceptable / average recreational performance)
//   7/10  → 76  (Strong performance)
//   9/10  → 91  (Dominant performance)
//   10/10 → 99  (Exceptional)
// UI requirement: 5/10 must be labeled "acceptable / average overall" — not "normal for you."
// The scale is ABSOLUTE, not relative to the player's level.
export const OVR_CALIBRATION_ANCHORS = [
  { rating: 1,  ovr: 40 },
  { rating: 3,  ovr: 51 },
  { rating: 5,  ovr: 63 },
  { rating: 7,  ovr: 76 },
  { rating: 9,  ovr: 91 },
  { rating: 10, ovr: 99 },
] as const

// ─── Initial Seed (Bayesian Shrinkage) ───────────────────────────────────────
// Phase 0 is unchanged from v1. organizerWeight 2 + up to 5 peers makes
// TARGET_SEED_WEIGHT = 6 reachable, so that constant is correct — only the
// match path had the wrong /6 divisor (fixed to RATER_FULL = 5 in v2).
export const TARGET_SEED_WEIGHT = 6
export const ORGANIZER_SEED_WEIGHT = 2
export const SEED_PRIOR_OVR_FALLBACK = 65
export const SEED_PRIOR_MIN_UNLOCKED_PLAYERS = 5
export const SEED_SINGLE_RATER_AGREEMENT_FACTOR = 0.70

// ─── Team Generator ───────────────────────────────────────────────────────────
// Exhaustive path: evaluates all C(n, n/2) candidate splits.
// C(16,8) = 12,870 — within 1s target. C(17,8) = 24,310 — switches to stratified.
export const TEAM_GEN_EXHAUSTIVE_THRESHOLD = 16
// Stratified path: minimum candidate pool size before scoring begins.
export const TEAM_GEN_SAMPLE_POOL_SIZE = 50
// Locked sampling strategy — change requires algorithm PR + version bump.
export const TEAM_GEN_STRATIFIED_STRATEGY = 'weighted-random-by-tier' as const
// Minimum rated players (ovrScore IS NOT NULL) before team generation is permitted.
// Source: PRD FR-44 ("at least 10 Members with an initial OVR set").
export const TEAM_GEN_MINIMUM_RATED_PLAYERS = 10
// Below this count, a fairness confidence disclaimer is shown (initial OVR only, no match data).
// Aligned with TEAM_GEN_EXHAUSTIVE_THRESHOLD — same squad size enables reliable initial splits.
export const TEAM_GEN_CONFIDENCE_THRESHOLD = 16
// Fallback OVR used when a player's ovrScore is null (< 4 played matches).
// Set to a mid-range value — substitution reduces split precision for groups with many unrated players.
export const TEAM_GEN_OVR_FALLBACK = 65
// Maximum team-generation API calls per group per 60-second window.
// Enforced by route-level rate-limit middleware, not the generator function itself.
export const TEAM_GEN_RATE_LIMIT_PER_MIN = 10
// Maximum number of regeneration attempts before the Organizer must lock.
export const TEAM_GEN_MAX_GENERATIONS = 5

// ─── Team Generator Composite Penalty Weights ─────────────────────────────────
// composite = w1*rating_gap + w2*attribute_gap + w3*goalkeeper_penalty
//           + w4*position_style_penalty + w5*form_penalty
//           + w6*repetition_penalty + w7*generator_style_penalty
// Best split = minimum composite score.
// w3 is intentionally the largest — goalkeeper imbalance dominates in 5v5.
export const TEAM_GEN_WEIGHTS = {
  w1_ratingGap: 1.0,             // Primary fairness signal
  w2_attributeGap: 0.5,          // Per-attribute balance
  w3_goalkeeperPenalty: 2.0,     // Large fixed penalty for GK-mode imbalance
  w4_positionStylePenalty: 0.3,
  w5_formPenalty: 0.2,           // Prevent concentrating in-form players on one side
  w6_repetitionPenalty: 0.15,    // Penalise repeating last 3 match lineups
  w7_generatorStylePenalty: 0.25,
} as const
