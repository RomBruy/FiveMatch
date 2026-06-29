import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../db', () => ({
  db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() },
}))
vi.mock('../../../services/notifications/notification.service', () => ({
  notificationService: { send: vi.fn() },
}))
vi.mock('../seeding.service', () => ({
  seedingService: { computeInitialSeed: vi.fn() },
}))

import { ovrService } from '../ovr.service'

describe('ovrService.calibrateMatchImpact — anchor boundary tests', () => {
  it('rating=1 → ovr=40 (exact)', () => { expect(ovrService.calibrateMatchImpact(1)).toBe(40) })
  it('rating=3 → ovr=52 (exact)', () => { expect(ovrService.calibrateMatchImpact(3)).toBe(52) })
  it('rating=5 → ovr=65 (exact)', () => { expect(ovrService.calibrateMatchImpact(5)).toBe(65) })
  it('rating=7 → ovr=76 (exact)', () => { expect(ovrService.calibrateMatchImpact(7)).toBe(76) })
  it('rating=9 → ovr=90 (exact)', () => { expect(ovrService.calibrateMatchImpact(9)).toBe(90) })
  it('rating=10 → ovr=99 (exact)', () => { expect(ovrService.calibrateMatchImpact(10)).toBe(99) })

  it('midpoint interpolation: rating=4 → 58.5', () => {
    // Between anchor {3,52} and {5,65}: t = (4-3)/(5-3) = 0.5; result = 52 + 0.5×13 = 58.5
    expect(ovrService.calibrateMatchImpact(4)).toBe(58.5)
  })

  it('midpoint interpolation: rating=8 → 83', () => {
    // Between anchor {7,76} and {9,90}: t = (8-7)/(9-7) = 0.5; result = 76 + 0.5×14 = 83
    expect(ovrService.calibrateMatchImpact(8)).toBe(83)
  })

  it('clamps below minimum: rating=0 → 40', () => { expect(ovrService.calibrateMatchImpact(0)).toBe(40) })
  it('clamps above maximum: rating=11 → 99', () => { expect(ovrService.calibrateMatchImpact(11)).toBe(99) })
  it('clamps negative: rating=-5 → 40', () => { expect(ovrService.calibrateMatchImpact(-5)).toBe(40) })
})
