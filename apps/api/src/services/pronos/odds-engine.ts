// odds-engine.ts — the Pronos "cote" (decimal odds) engine (Story 11.1).
//
// Pure, deterministic, server-only. Builds the three betting markets from the two
// locked team OVRs, exactly as a bookmaker builds them: estimate true probabilities,
// convert to decimal odds (odds = MARGIN / p), clamp. No numeric literals live here —
// every knob comes from @fivematch/types/algorithm-constants (version-locked).
//
// OVR-neutral: this module only READS OVR; it never writes it.
import {
  EXPECTED_SCALE_D,
  PRONOS_DRAW_BASE,
  PRONOS_DRAW_SCALE,
  PRONOS_MARGIN,
  PRONOS_ODDS_MIN,
  PRONOS_ODDS_MAX,
  PRONOS_BASE_GOALS,
  PRONOS_GOAL_TILT_SCALE,
  PRONOS_GOAL_TILT_MAX,
  PRONOS_SCORE_GRID_MAX,
} from '@fivematch/types/algorithm-constants'

export type MatchResult = 'teamA' | 'draw' | 'teamB'

export interface ResultProbabilities {
  teamA: number
  draw: number
  teamB: number
}

export interface ResultOdds {
  teamA: number
  draw: number
  teamB: number
}

export interface ScorelineProbability {
  scoreA: number
  scoreB: number
  prob: number
}

export interface ScorelineOdds {
  scoreA: number
  scoreB: number
  odds: number
}

export interface MvpOdds {
  playerId: string
  odds: number
}

export interface MatchOdds {
  result: ResultOdds
  scores: ScorelineOdds[]
  mvp: MvpOdds[]
}

// ─── Primitives ───────────────────────────────────────────────────────────────

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))

// Round to 2 decimals — the register cotes are displayed in (e.g. 2.13).
const round2 = (x: number) => Math.round(x * 100) / 100

/** Convert a probability to a clamped, rounded decimal cote. */
export function decimalOdds(prob: number): number {
  if (prob <= 0) return PRONOS_ODDS_MAX
  return round2(clamp(PRONOS_MARGIN / prob, PRONOS_ODDS_MIN, PRONOS_ODDS_MAX))
}

function factorial(n: number): number {
  let f = 1
  for (let i = 2; i <= n; i++) f *= i
  return f
}

/** Poisson probability mass P(X = k) for rate lambda. */
function poissonPmf(k: number, lambda: number): number {
  return (Math.exp(-lambda) * Math.pow(lambda, k)) / factorial(k)
}

/** Which 1X2 outcome a scoreline represents. Shared with settlement (Story 11.3). */
export function resultOf(scoreA: number, scoreB: number): MatchResult {
  if (scoreA > scoreB) return 'teamA'
  if (scoreB > scoreA) return 'teamB'
  return 'draw'
}

// ─── Result market (1X2) ────────────────────────────────────────────────────

/**
 * True 1X2 probabilities from the two team OVRs.
 * Win/loss split reuses the existing Elo-style logistic (EXPECTED_SCALE_D); the draw
 * is a gaussian that peaks at OVR parity and decays as the mismatch grows. The three
 * always sum to 1.
 */
export function resultProbabilities(teamAOvr: number, teamBOvr: number): ResultProbabilities {
  const gap = teamAOvr - teamBOvr
  const pWinA = 1 / (1 + Math.pow(10, -gap / EXPECTED_SCALE_D)) // 2-way win prob for A
  const pDraw = PRONOS_DRAW_BASE * Math.exp(-Math.pow(gap / PRONOS_DRAW_SCALE, 2))
  const nonDraw = 1 - pDraw
  return {
    teamA: nonDraw * pWinA,
    draw: pDraw,
    teamB: nonDraw * (1 - pWinA),
  }
}

export function computeResultOdds(teamAOvr: number, teamBOvr: number): ResultOdds {
  const p = resultProbabilities(teamAOvr, teamBOvr)
  return {
    teamA: decimalOdds(p.teamA),
    draw: decimalOdds(p.draw),
    teamB: decimalOdds(p.teamB),
  }
}

// ─── Correct-score market ────────────────────────────────────────────────────

/** Per-team expected goals (Poisson λ), tilted by the OVR gap. Both stay > 0. */
export function goalRates(teamAOvr: number, teamBOvr: number): { lambdaA: number; lambdaB: number } {
  const gap = teamAOvr - teamBOvr
  const tilt = clamp(gap / PRONOS_GOAL_TILT_SCALE, -PRONOS_GOAL_TILT_MAX, PRONOS_GOAL_TILT_MAX)
  return {
    lambdaA: PRONOS_BASE_GOALS * (1 + tilt),
    lambdaB: PRONOS_BASE_GOALS * (1 - tilt),
  }
}

/**
 * Correct-score probabilities over the 0..GRID_MAX × 0..GRID_MAX scoreline grid.
 * Independent-Poisson goals give the SHAPE within each result bucket; each bucket is
 * then renormalized and scaled by the logistic result probability. Consequence: the
 * scoreline probabilities within a result sum to exactly that result's probability,
 * and the whole grid sums to 1 — the score market can never disagree with the 1X2.
 */
export function scorelineProbabilities(teamAOvr: number, teamBOvr: number): ScorelineProbability[] {
  const res = resultProbabilities(teamAOvr, teamBOvr)
  const { lambdaA, lambdaB } = goalRates(teamAOvr, teamBOvr)

  const buckets: Record<MatchResult, { scoreA: number; scoreB: number; weight: number }[]> = {
    teamA: [],
    draw: [],
    teamB: [],
  }
  for (let a = 0; a <= PRONOS_SCORE_GRID_MAX; a++) {
    for (let b = 0; b <= PRONOS_SCORE_GRID_MAX; b++) {
      const weight = poissonPmf(a, lambdaA) * poissonPmf(b, lambdaB)
      buckets[resultOf(a, b)].push({ scoreA: a, scoreB: b, weight })
    }
  }

  const out: ScorelineProbability[] = []
  for (const r of ['teamA', 'draw', 'teamB'] as const) {
    const cells = buckets[r]
    const total = cells.reduce((s, c) => s + c.weight, 0)
    for (const c of cells) {
      out.push({
        scoreA: c.scoreA,
        scoreB: c.scoreB,
        prob: total > 0 ? (res[r] * c.weight) / total : 0,
      })
    }
  }
  return out
}

/** Correct-score cotes, most-likely scoreline first. */
export function computeScoreOdds(teamAOvr: number, teamBOvr: number): ScorelineOdds[] {
  return scorelineProbabilities(teamAOvr, teamBOvr)
    .sort((x, y) => y.prob - x.prob)
    .map((s) => ({ scoreA: s.scoreA, scoreB: s.scoreB, odds: decimalOdds(s.prob) }))
}

// ─── MVP market ──────────────────────────────────────────────────────────────

/**
 * MVP cotes for the confirmed-IN players. Win-MVP probability is proportional to a
 * player's share of the total OVR on the pitch — the strongest player is the shortest
 * price. Non-positive OVRs are treated as 0 share.
 */
export function computeMvpOdds(players: { playerId: string; ovr: number }[]): MvpOdds[] {
  const totalOvr = players.reduce((s, p) => s + Math.max(0, p.ovr), 0)
  return players
    .map((p) => ({
      playerId: p.playerId,
      odds: decimalOdds(totalOvr > 0 ? Math.max(0, p.ovr) / totalOvr : 0),
    }))
    .sort((a, b) => a.odds - b.odds)
}

// ─── Convenience ─────────────────────────────────────────────────────────────

/** All three markets for a locked match in one call. */
export function computeMatchOdds(
  teamAOvr: number,
  teamBOvr: number,
  players: { playerId: string; ovr: number }[],
): MatchOdds {
  return {
    result: computeResultOdds(teamAOvr, teamBOvr),
    scores: computeScoreOdds(teamAOvr, teamBOvr),
    mvp: computeMvpOdds(players),
  }
}
