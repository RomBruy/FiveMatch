import { describe, it, expect } from 'vitest'
import { randomUUID } from 'crypto'
import {
  teamGeneratorService,
  type GeneratorPlayer,
  type GeneratorOptions,
} from '../../services/matches/team-generator.service'
import {
  TEAM_GEN_EXHAUSTIVE_THRESHOLD,
} from '@fivematch/types/algorithm-constants'

// generate() is a pure function — no DB needed; build fixtures in-memory
function buildPlayers(count: number, nullOvrUntil = 0): GeneratorPlayer[] {
  return Array.from({ length: count }, (_, i) => ({
    id: randomUUID(),
    displayName: `Player ${i}`,
    ovrScore: i < nullOvrUntil ? null : 60 + Math.floor((i * 29) / Math.max(count - 1, 1)),
    avgPace: null,
    avgTechnique: null,
    avgPassing: null,
    avgDefending: null,
    avgPhysicality: null,
    avgEffort: null,
  }))
}

const options: GeneratorOptions = {
  goalkeeperMode: 'none',
  generatorStyle: 'pure_ovr',
}

describe('team-generator service — performance and correctness', () => {
  it(`exhaustive path: ${TEAM_GEN_EXHAUSTIVE_THRESHOLD - 1} players completes in ≤ 1 000ms`, () => {
    const players = buildPlayers(TEAM_GEN_EXHAUSTIVE_THRESHOLD - 1)
    const t0 = Date.now()
    const result = teamGeneratorService.generate(players, options)
    const elapsed = Date.now() - t0
    expect(elapsed).toBeLessThanOrEqual(1000)
    expect(result.teamA.length + result.teamB.length).toBe(TEAM_GEN_EXHAUSTIVE_THRESHOLD - 1)
    expect(result.fairnessScore).toBeGreaterThanOrEqual(0)
  })

  it(`exhaustive path boundary: ${TEAM_GEN_EXHAUSTIVE_THRESHOLD} players completes in ≤ 1 000ms`, () => {
    const players = buildPlayers(TEAM_GEN_EXHAUSTIVE_THRESHOLD)
    const t0 = Date.now()
    const result = teamGeneratorService.generate(players, options)
    const elapsed = Date.now() - t0
    expect(elapsed).toBeLessThanOrEqual(1000)
    expect(result.teamA.length + result.teamB.length).toBe(TEAM_GEN_EXHAUSTIVE_THRESHOLD)
  })

  it(`stratified path: ${TEAM_GEN_EXHAUSTIVE_THRESHOLD + 1} players completes in ≤ 1 000ms`, () => {
    const players = buildPlayers(TEAM_GEN_EXHAUSTIVE_THRESHOLD + 1)
    const t0 = Date.now()
    const result = teamGeneratorService.generate(players, options)
    const elapsed = Date.now() - t0
    expect(elapsed).toBeLessThanOrEqual(1000)
    expect(result.teamA.length + result.teamB.length).toBe(TEAM_GEN_EXHAUSTIVE_THRESHOLD + 1)
  })

  it('stratified path: 32 players completes in ≤ 1 000ms', () => {
    const players = buildPlayers(32)
    const t0 = Date.now()
    const result = teamGeneratorService.generate(players, options)
    const elapsed = Date.now() - t0
    expect(elapsed).toBeLessThanOrEqual(1000)
    expect(result.teamA.length + result.teamB.length).toBe(32)
  })

  it('substitutes TEAM_GEN_OVR_FALLBACK when ovrScore is null — output preserves null', () => {
    const players = buildPlayers(10, 3)
    const result = teamGeneratorService.generate(players, options)
    expect(result.teamA.length + result.teamB.length).toBe(10)
    const nullCount =
      result.teamA.filter(p => p.ovrScore === null).length +
      result.teamB.filter(p => p.ovrScore === null).length
    expect(nullCount).toBe(3)
  })

  it('exhaustive path is deterministic — same input produces same split', () => {
    const players = buildPlayers(10)
    const r1 = teamGeneratorService.generate(players, options)
    const r2 = teamGeneratorService.generate(players, options)
    expect(r1.teamA.map(p => p.id).sort()).toEqual(r2.teamA.map(p => p.id).sort())
    expect(r1.fairnessScore).toBe(r2.fairnessScore)
  })

  it('every player appears exactly once across both teams', () => {
    const players = buildPlayers(14)
    const result = teamGeneratorService.generate(players, options)
    const allIds = [...result.teamA, ...result.teamB].map(p => p.id)
    expect(new Set(allIds).size).toBe(14)
    expect(allIds.length).toBe(14)
  })

  it('returns fairnessScore ≥ 0', () => {
    const players = buildPlayers(12)
    const result = teamGeneratorService.generate(players, options)
    expect(result.fairnessScore).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(result.fairnessScore)).toBe(true)
  })
})
