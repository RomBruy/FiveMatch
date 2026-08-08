import { eq, and, isNull, isNotNull, count } from 'drizzle-orm'
import { db } from '../../db'
import { players, matchAttendances } from '../../db/schema'
import {
  TEAM_GEN_MINIMUM_RATED_PLAYERS,
  TEAM_GEN_CONFIDENCE_THRESHOLD,
  TEAM_GEN_EXHAUSTIVE_THRESHOLD,
  TEAM_GEN_SAMPLE_POOL_SIZE,
  TEAM_GEN_STRATIFIED_STRATEGY,
  TEAM_GEN_WEIGHTS,
  TEAM_GEN_OVR_FALLBACK,
} from '@fivematch/types/algorithm-constants'

// ─── Public types (imported by Story 3.5 route handler) ──────────────────────

export interface GeneratorPlayer {
  id: string
  displayName: string
  ovrScore: number | null          // null → TEAM_GEN_OVR_FALLBACK substituted internally
  avgPace: number | null
  avgTechnique: number | null
  avgPassing: number | null
  avgDefending: number | null
  avgPhysicality: number | null
  avgEffort: number | null
  isGoalkeeper?: boolean           // required for goalkeeperMode = 'fixed'
  position?: string                // for positionStylePenalty (ATT/MIL/DEF/GK)
  formScore?: number               // pre-computed form value from caller; 0 if absent
}

export interface GeneratorOptions {
  goalkeeperMode: 'fixed' | 'rotating' | 'none'
  generatorStyle: 'pure_ovr' | 'position_aware' | 'mixed'
  previousTeamSides?: Record<string, 'A' | 'B'>  // playerId → last match side (repetition penalty)
}

export interface GeneratorResult {
  teamA: GeneratorPlayer[]
  teamB: GeneratorPlayer[]
  fairnessScore: number  // composite penalty of chosen split — lower is more balanced
}

// ─── Status types (existing from Story 2.5) ───────────────────────────────────

interface TeamGeneratorStatus {
  canGenerate: boolean
  reason: string | null
  ratedPlayerCount: number
  minimumRequired: number
  fairnessConfidenceDisclaimer: string | null
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function* combinations<T>(arr: T[], k: number): Generator<T[]> {
  if (k === 0) { yield []; return }
  for (let i = 0; i <= arr.length - k; i++) {
    for (const rest of combinations(arr.slice(i + 1), k - 1)) {
      yield [arr[i], ...rest]
    }
  }
}

function computePenalty(
  teamA: GeneratorPlayer[],
  teamB: GeneratorPlayer[],
  options: GeneratorOptions,
  effectiveOvr: (p: GeneratorPlayer) => number,
): number {
  // w1: OVR rating gap (primary balance signal)
  const ovrA = teamA.reduce((s, p) => s + effectiveOvr(p), 0) / teamA.length
  const ovrB = teamB.reduce((s, p) => s + effectiveOvr(p), 0) / teamB.length
  const ratingGap = Math.abs(ovrA - ovrB)

  // w2: Attribute gap — average of per-attribute average differences
  const attrs = ['avgPace', 'avgTechnique', 'avgPassing', 'avgDefending', 'avgPhysicality', 'avgEffort'] as const
  const attrGap = attrs.reduce((sum, attr) => {
    const avgA = teamA.reduce((s, p) => s + (Number(p[attr]) || 0), 0) / teamA.length
    const avgB = teamB.reduce((s, p) => s + (Number(p[attr]) || 0), 0) / teamB.length
    return sum + Math.abs(avgA - avgB)
  }, 0) / attrs.length

  // w3: Goalkeeper penalty — only active when goalkeeperMode = 'fixed'
  let goalkeeperPenalty = 0
  if (options.goalkeeperMode === 'fixed') {
    const gkA = teamA.filter(p => p.isGoalkeeper === true).length
    const gkB = teamB.filter(p => p.isGoalkeeper === true).length
    // Penalty when all designated goalkeepers land on one side
    if ((gkA > 0 && gkB === 0) || (gkB > 0 && gkA === 0)) {
      goalkeeperPenalty = 1
    }
  }

  // w4: Position style penalty — active for position_aware and mixed styles
  let positionPenalty = 0
  if (options.generatorStyle !== 'pure_ovr') {
    const positions = ['ATT', 'MIL', 'DEF']
    positionPenalty = positions.reduce((sum, pos) => {
      const cA = teamA.filter(p => p.position === pos).length
      const cB = teamB.filter(p => p.position === pos).length
      return sum + Math.abs(cA - cB)
    }, 0) / positions.length
  }

  // w5: Form penalty — penalise concentrating in-form players on one side
  const formA = teamA.reduce((s, p) => s + (p.formScore ?? 0), 0) / teamA.length
  const formB = teamB.reduce((s, p) => s + (p.formScore ?? 0), 0) / teamB.length
  const formPenalty = Math.abs(formA - formB)

  // w6: Repetition penalty — fraction of players on same side as their last match
  let repetitionPenalty = 0
  if (options.previousTeamSides) {
    const prev = options.previousTeamSides
    let sameAsLast = 0
    for (const p of teamA) {
      if (prev[p.id] === 'A') sameAsLast++
    }
    for (const p of teamB) {
      if (prev[p.id] === 'B') sameAsLast++
    }
    repetitionPenalty = sameAsLast / (teamA.length + teamB.length)
  }

  // w7: Generator style penalty — additional style imbalance for non-pure-ovr styles
  const generatorStylePenalty = options.generatorStyle === 'pure_ovr' ? 0 : positionPenalty * 0.5

  return (
    TEAM_GEN_WEIGHTS.w1_ratingGap            * ratingGap +
    TEAM_GEN_WEIGHTS.w2_attributeGap         * attrGap +
    TEAM_GEN_WEIGHTS.w3_goalkeeperPenalty    * goalkeeperPenalty +
    TEAM_GEN_WEIGHTS.w4_positionStylePenalty * positionPenalty +
    TEAM_GEN_WEIGHTS.w5_formPenalty          * formPenalty +
    TEAM_GEN_WEIGHTS.w6_repetitionPenalty    * repetitionPenalty +
    TEAM_GEN_WEIGHTS.w7_generatorStylePenalty * generatorStylePenalty
  )
}

function stratifiedSample(
  players: GeneratorPlayer[],
  effectiveOvr: (p: GeneratorPlayer) => number,
): [GeneratorPlayer[], GeneratorPlayer[]] {
  // Strategy: 'weighted-random-by-tier' — sort by OVR then snake-draft to balance talent
  const sorted = [...players].sort((a, b) => effectiveOvr(b) - effectiveOvr(a))
  const teamA: GeneratorPlayer[] = []
  const teamB: GeneratorPlayer[] = []

  // Snake draft: A,B,B,A,A,B,B,A… balances tier distribution across both teams
  for (let i = 0; i < sorted.length; i++) {
    const cycle = Math.floor(i / 2) % 2
    if (i % 2 === 0) {
      if (cycle === 0) { teamA.push(sorted[i]) } else { teamB.push(sorted[i]) }
    } else {
      if (cycle === 0) { teamB.push(sorted[i]) } else { teamA.push(sorted[i]) }
    }
  }
  return [teamA, teamB]
}

// ─── Main generate function ───────────────────────────────────────────────────

function generate(players: GeneratorPlayer[], options: GeneratorOptions): GeneratorResult {
  if (players.length < 2) {
    throw Object.assign(new Error('INSUFFICIENT_PLAYERS'), { code: 'INSUFFICIENT_PLAYERS', statusCode: 422 })
  }

  // OVR null substitution — TEAM_GEN_OVR_FALLBACK used when ovrScore is null (player has < 4 matches).
  // This reduces split precision for groups with many unrated players.
  const effectiveOvr = (p: GeneratorPlayer): number =>
    p.ovrScore !== null ? p.ovrScore : TEAM_GEN_OVR_FALLBACK

  const teamSize = Math.floor(players.length / 2)

  if (players.length <= TEAM_GEN_EXHAUSTIVE_THRESHOLD) {
    // Exhaustive path: evaluate all C(n, n/2) candidate splits (deterministic)
    let bestPenalty = Infinity
    let bestOvrGap = Infinity
    let bestTeamA: GeneratorPlayer[] = []
    let bestTeamB: GeneratorPlayer[] = []

    for (const teamA of combinations(players, teamSize)) {
      const teamASet = new Set(teamA.map(p => p.id))
      const teamB = players.filter(p => !teamASet.has(p.id))
      const penalty = computePenalty(teamA, teamB, options, effectiveOvr)

      // Primary: lowest composite penalty. Tie-break: smallest OVR gap.
      const ovrGap = Math.abs(
        teamA.reduce((s, p) => s + effectiveOvr(p), 0) -
        teamB.reduce((s, p) => s + effectiveOvr(p), 0),
      )

      if (
        penalty < bestPenalty ||
        (penalty === bestPenalty && ovrGap < bestOvrGap)
      ) {
        bestPenalty = penalty
        bestOvrGap = ovrGap
        bestTeamA = teamA
        bestTeamB = teamB
      }
    }

    return { teamA: bestTeamA, teamB: bestTeamB, fairnessScore: bestPenalty }
  }

  // Stratified path — strategy resolved from constant at runtime
  if (TEAM_GEN_STRATIFIED_STRATEGY !== 'weighted-random-by-tier') {
    throw new Error(`Unknown stratified strategy: ${TEAM_GEN_STRATIFIED_STRATEGY}`)
  }

  // Seed with snake-draft base split, then explore neighbourhood of TEAM_GEN_SAMPLE_POOL_SIZE swaps
  const [baseA, baseB] = stratifiedSample(players, effectiveOvr)
  let bestPenalty = computePenalty(baseA, baseB, options, effectiveOvr)
  let bestTeamA = baseA
  let bestTeamB = baseB

  for (let attempt = 0; attempt < TEAM_GEN_SAMPLE_POOL_SIZE; attempt++) {
    const candidateA = [...bestTeamA]
    const candidateB = [...bestTeamB]
    const iA = Math.floor(Math.random() * candidateA.length)
    const iB = Math.floor(Math.random() * candidateB.length)
    ;[candidateA[iA], candidateB[iB]] = [candidateB[iB], candidateA[iA]]

    const penalty = computePenalty(candidateA, candidateB, options, effectiveOvr)
    if (penalty < bestPenalty) {
      bestPenalty = penalty
      bestTeamA = candidateA
      bestTeamB = candidateB
    }
  }

  return { teamA: bestTeamA, teamB: bestTeamB, fairnessScore: bestPenalty }
}

// ─── Status (Story 2.5) ───────────────────────────────────────────────────────

/**
 * Readiness is a property of the match, not of a crew: what matters is how many
 * of the people actually confirmed for THIS match carry an OVR. A pickup game of
 * ten strangers is the normal case now, and it should say so plainly rather than
 * measuring a group the players may not belong to.
 */
async function getStatus(matchId: string): Promise<TeamGeneratorStatus> {
  const [{ value: rawCount }] = await db
    .select({ value: count() })
    .from(matchAttendances)
    .innerJoin(players, eq(players.id, matchAttendances.playerId))
    .where(
      and(
        eq(matchAttendances.matchId, matchId),
        eq(matchAttendances.status, 'in'),
        isNull(matchAttendances.waitlistPosition),
        isNotNull(players.ovrScoreFloat),
        isNull(players.deletedAt),
      ),
    )

  const ratedPlayerCount = Number(rawCount)
  const canGenerate = ratedPlayerCount >= TEAM_GEN_MINIMUM_RATED_PLAYERS

  if (!canGenerate) {
    return {
      canGenerate: false,
      reason: 'INSUFFICIENT_RATED_PLAYERS',
      ratedPlayerCount,
      minimumRequired: TEAM_GEN_MINIMUM_RATED_PLAYERS,
      fairnessConfidenceDisclaimer: null,
    }
  }

  const fairnessConfidenceDisclaimer =
    ratedPlayerCount < TEAM_GEN_CONFIDENCE_THRESHOLD ? 'FAIRNESS_CONFIDENCE_LOW' : null

  return {
    canGenerate: true,
    reason: null,
    ratedPlayerCount,
    minimumRequired: TEAM_GEN_MINIMUM_RATED_PLAYERS,
    fairnessConfidenceDisclaimer,
  }
}

export const teamGeneratorService = { getStatus, generate }
