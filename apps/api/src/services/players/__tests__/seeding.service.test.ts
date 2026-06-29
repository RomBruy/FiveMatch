import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── hoisted mocks — defined before any module is imported ────────────────────
const mocks = vi.hoisted(() => {
  const mockInsertReturning = vi.fn()
  const mockInsertValues = vi.fn(() => ({ returning: mockInsertReturning }))
  const mockInsert = vi.fn(() => ({ values: mockInsertValues }))

  const mockUpdateWhere = vi.fn()
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }))
  const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }))

  const mockTx = {
    insert: mockInsert,
    update: mockUpdate,
  }

  const mockTransaction = vi.fn()

  return {
    mockInsert,
    mockInsertValues,
    mockInsertReturning,
    mockUpdate,
    mockUpdateSet,
    mockUpdateWhere,
    mockTransaction,
    mockTx,
  }
})

vi.mock('../../../db', () => ({
  db: {
    transaction: mocks.mockTransaction,
  },
}))

vi.mock('../../../db/schema', () => ({
  rawInitialSeedRatings: { id: 'id', sourceType: 'sourceType', rating: 'rating', weight: 'weight' },
  ratingEvents: {},
  players: { id: 'id' },
}))

import { buildSeedContext, seedingService } from '../seeding.service'
import type { SeedInput } from '../seeding.service'

const PLAYER_ID = 'player-uuid-1'
const GROUP_ID = 'group-uuid-1'
const ORGANIZER_USER_ID = 'organizer-user-uuid'

describe('buildSeedContext — organizer-only (PROVISIONAL)', () => {
  const input: SeedInput = {
    playerId: PLAYER_ID,
    groupId: GROUP_ID,
    organizerRating: 80,
    organizerUserId: ORGANIZER_USER_ID,
    peerRatings: [],
    groupMedianUnlockedOvr: null, // < 5 unlocked → fallback 65
  }

  it('seededOvr = 70.0 ((80×2 + 65×4) / 6)', () => {
    const ctx = buildSeedContext(input)
    expect(ctx.seededOvr).toBeCloseTo(70.0, 5)
  })

  it('seedStatus = PROVISIONAL (observedWeight 2 < TARGET 6)', () => {
    const ctx = buildSeedContext(input)
    expect(ctx.seedStatus).toBe('PROVISIONAL')
  })

  it('seedRatingStdDev = null (single rater)', () => {
    const ctx = buildSeedContext(input)
    expect(ctx.seedRatingStdDev).toBeNull()
  })

  it('agreementFactor = SEED_SINGLE_RATER_AGREEMENT_FACTOR (0.70)', () => {
    const ctx = buildSeedContext(input)
    expect(ctx.agreementFactor).toBe(0.70)
  })

  it('priorWeight = max(0, 6 - 2) = 4', () => {
    const ctx = buildSeedContext(input)
    expect(ctx.priorWeight).toBe(4)
  })

  it('observedWeight = 2 (organizer only)', () => {
    const ctx = buildSeedContext(input)
    expect(ctx.observedWeight).toBe(2)
  })

  it('priorOvr = 65 (fallback when groupMedianUnlockedOvr is null)', () => {
    const ctx = buildSeedContext(input)
    expect(ctx.priorOvr).toBe(65)
  })
})

describe('buildSeedContext — organizer + 4 peers (CONFIDENT)', () => {
  const input: SeedInput = {
    playerId: PLAYER_ID,
    groupId: GROUP_ID,
    organizerRating: 80,
    organizerUserId: ORGANIZER_USER_ID,
    peerRatings: [
      { raterUserId: 'peer-1', rating: 70 },
      { raterUserId: 'peer-2', rating: 75 },
      { raterUserId: 'peer-3', rating: 68 },
      { raterUserId: 'peer-4', rating: 72 },
    ],
    groupMedianUnlockedOvr: null,
  }

  it('seededOvr ≈ 74.17 ((80×2 + 70+75+68+72) / 6)', () => {
    const ctx = buildSeedContext(input)
    expect(ctx.seededOvr).toBeCloseTo(74.1667, 3)
  })

  it('seedStatus = CONFIDENT (observedWeight 6 >= TARGET 6)', () => {
    const ctx = buildSeedContext(input)
    expect(ctx.seedStatus).toBe('CONFIDENT')
  })

  it('priorWeight = max(0, 6 - 6) = 0', () => {
    const ctx = buildSeedContext(input)
    expect(ctx.priorWeight).toBe(0)
  })

  it('observedWeight = 2 + 4 = 6', () => {
    const ctx = buildSeedContext(input)
    expect(ctx.observedWeight).toBe(6)
  })
})

describe('buildSeedContext — PROVISIONAL/CONFIDENT boundary', () => {
  it('observedWeight = 5 → PROVISIONAL', () => {
    const input: SeedInput = {
      playerId: PLAYER_ID,
      groupId: GROUP_ID,
      organizerRating: 75,
      organizerUserId: ORGANIZER_USER_ID,
      peerRatings: [
        { raterUserId: 'p1', rating: 70 },
        { raterUserId: 'p2', rating: 72 },
        { raterUserId: 'p3', rating: 68 },
      ],
      groupMedianUnlockedOvr: null,
    }
    const ctx = buildSeedContext(input)
    expect(ctx.observedWeight).toBe(5) // 2 + 3
    expect(ctx.seedStatus).toBe('PROVISIONAL')
  })

  it('observedWeight = 6 → CONFIDENT', () => {
    const input: SeedInput = {
      playerId: PLAYER_ID,
      groupId: GROUP_ID,
      organizerRating: 75,
      organizerUserId: ORGANIZER_USER_ID,
      peerRatings: [
        { raterUserId: 'p1', rating: 70 },
        { raterUserId: 'p2', rating: 72 },
        { raterUserId: 'p3', rating: 68 },
        { raterUserId: 'p4', rating: 74 },
      ],
      groupMedianUnlockedOvr: null,
    }
    const ctx = buildSeedContext(input)
    expect(ctx.observedWeight).toBe(6) // 2 + 4
    expect(ctx.seedStatus).toBe('CONFIDENT')
  })
})

describe('buildSeedContext — single rater agreement factor', () => {
  it('single rater (organizer only) → agreementFactor = 0.70 (fixed constant, not from stdDev)', () => {
    const ctx = buildSeedContext({
      playerId: PLAYER_ID,
      groupId: GROUP_ID,
      organizerRating: 80,
      organizerUserId: ORGANIZER_USER_ID,
      peerRatings: [],
      groupMedianUnlockedOvr: null,
    })
    expect(ctx.seedRatingStdDev).toBeNull()
    expect(ctx.agreementFactor).toBe(0.70)
  })
})

describe('seedingService.computeInitialSeed — ratingRef uses row id, NOT raterUserId', () => {
  const RATING_ROW_ID = 'raw-rating-uuid-abc123'
  const RATER_USER_ID = 'rater-user-uuid-should-not-appear'

  beforeEach(() => {
    mocks.mockInsertReturning.mockResolvedValue([
      { id: RATING_ROW_ID, sourceType: 'ORGANIZER', rating: 80, weight: 2 },
    ])
    mocks.mockInsert.mockReturnValue({ values: mocks.mockInsertValues })
    mocks.mockInsertValues.mockReturnValue({ returning: mocks.mockInsertReturning })
    mocks.mockUpdateWhere.mockResolvedValue([])
    mocks.mockUpdateSet.mockReturnValue({ where: mocks.mockUpdateWhere })
    mocks.mockUpdate.mockReturnValue({ set: mocks.mockUpdateSet })

    mocks.mockTransaction.mockImplementation((callback: (tx: typeof mocks.mockTx) => Promise<unknown>) =>
      callback(mocks.mockTx),
    )
  })

  it('breakdown.seedRatings[].ratingRef = raw_initial_seed_ratings.id, never raterUserId', async () => {
    const input: SeedInput = {
      playerId: PLAYER_ID,
      groupId: GROUP_ID,
      organizerRating: 80,
      organizerUserId: RATER_USER_ID,
      peerRatings: [],
      groupMedianUnlockedOvr: null,
    }

    await seedingService.computeInitialSeed(input)

    // Verify ratingEvents insert was called
    expect(mocks.mockInsert).toHaveBeenCalledTimes(2) // rawInitialSeedRatings + ratingEvents

    // Capture the ratingEvents insert call (second insert call)
    const allInsertValuesCalls = mocks.mockInsertValues.mock.calls as unknown as unknown[][]
    const ratingEventsInsertCall = allInsertValuesCalls[1]?.[0] as {
      breakdown: { seedRatings: { ratingRef: string }[] }
    }

    expect(ratingEventsInsertCall).toBeDefined()
    const ratingRef = ratingEventsInsertCall.breakdown.seedRatings[0].ratingRef
    expect(ratingRef).toBe(RATING_ROW_ID)
    expect(ratingRef).not.toBe(RATER_USER_ID)
  })

  it('returns seededOvr and seedStatus', async () => {
    const input: SeedInput = {
      playerId: PLAYER_ID,
      groupId: GROUP_ID,
      organizerRating: 80,
      organizerUserId: ORGANIZER_USER_ID,
      peerRatings: [],
      groupMedianUnlockedOvr: null,
    }

    const result = await seedingService.computeInitialSeed(input)
    expect(result.seededOvr).toBeCloseTo(70.0, 5)
    expect(result.seedStatus).toBe('PROVISIONAL')
  })
})
