// algorithm-constants.ts v1.0 — changes require PR review and version bump in ALGORITHM_CONSTANTS_VERSION

export const ALGORITHM_CONSTANTS_VERSION = 'v1.0'

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

// ─── Adaptive EMA ─────────────────────────────────────────────────────────────
// alpha = max(EMA_ALPHA_MIN, EMA_ALPHA_START - matchCount × EMA_ALPHA_DECAY)
// new_ovr = (1 - alpha) × old_ovr + alpha × match_impact
// Boundary: first match (matchCount=0, no prior OVR) → new_ovr = match_impact
export const EMA_ALPHA_MIN = 0.10      // Floor — veteran OVR stays stable
export const EMA_ALPHA_DECAY = 0.005  // Per-match decay rate
export const EMA_ALPHA_START = 0.25   // Starting alpha for a new player

// ─── Group Tier Multipliers ───────────────────────────────────────────────────
// Applied forward-only from tier change. Modulates effective alpha:
//   effective_alpha = max(EMA_ALPHA_MIN, raw_alpha × tierMultiplier)
// Amateur: forgiving (slow OVR movement). Elite: tight (fast OVR movement).
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

// ─── Organizer Rating Weight ──────────────────────────────────────────────────
// Organizer's rating counts 2× when computing initial OVR from peer ratings.
export const ORGANIZER_RATING_WEIGHT = 2

// ─── Form Window Weights ──────────────────────────────────────────────────────
// Raw weights for last 3–5 matches, most recent first (index 0 = most recent).
// Consumer normalises: weight[i] / sum(FORM_WEIGHTS).
// [5,4,3,2,1] → sum=15; most recent match = 5/15 ≈ 33% of form value.
export const FORM_WEIGHTS = [5, 4, 3, 2, 1] as const

// ─── Goal / Assist Attribute Boosts ──────────────────────────────────────────
// Small bonus added to the contributing attribute's rating for the match.
// Goal scorer: technique bonus (skill) + pace bonus (acceleration to score).
// Assist: passing bonus (vision + delivery).
// Applied BEFORE the EMA update, increasing match_impact for that attribute.
export const GOAL_TECHNIQUE_BOOST = 0.5
export const GOAL_PACE_BOOST = 0.3
export const ASSIST_PASSING_BOOST = 0.5

// ─── MVP Blend Constants ──────────────────────────────────────────────────────
// MVP contributes exactly MVP_WEIGHT (3%) to match impact toward MVP_FIXED_CONTRIBUTION (80).
// Formula: matchImpactAfterMvp = matchImpactClamped * (1 - MVP_WEIGHT) + MVP_FIXED_CONTRIBUTION * MVP_WEIGHT
// See: docs/algorithm-decisions.md §"MVP Signal"
export const MVP_WEIGHT = 0.03
export const MVP_FIXED_CONTRIBUTION = 80

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

// ─── OVR Calibration Anchors ─────────────────────────────────────────────────
// Piecewise-linear mapping from attribute score (1–10 scale) to OVR domain (40–99).
// Semantic anchors (from algorithm-decisions.md):
//   1/10  → 40  (Very poor)
//   3/10  → 52  (Weak)
//   5/10  → 65  (Acceptable / average recreational performance)
//   7/10  → 76  (Strong performance)
//   9/10  → 90  (Dominant performance)
//   10/10 → 99  (Exceptional)
// UI requirement: 5/10 must be labeled "acceptable / average overall" — not "normal for you."
// The scale is ABSOLUTE, not relative to the player's level.
export const OVR_CALIBRATION_ANCHORS = [
  { rating: 1,  ovr: 40 },
  { rating: 3,  ovr: 52 },
  { rating: 5,  ovr: 65 },
  { rating: 7,  ovr: 76 },
  { rating: 9,  ovr: 90 },
  { rating: 10, ovr: 99 },
] as const

// ─── Initial Seed (Bayesian Shrinkage) ───────────────────────────────────────
// TARGET_SEED_WEIGHT: total weight at which the prior has zero influence.
// ORGANIZER_SEED_WEIGHT: organizer rating counts as 2 peer ratings.
// SEED_PRIOR_OVR_FALLBACK: used when group has fewer than SEED_PRIOR_MIN_UNLOCKED_PLAYERS.
// SEED_SINGLE_RATER_AGREEMENT_FACTOR: fixed agreement factor when only 1 rater rated the player
//   (stdDev is undefined for a single value; 0.70 reflects low-confidence seed).
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
