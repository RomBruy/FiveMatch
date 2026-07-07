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
  it('rating=3 → ovr=51 (exact)', () => { expect(ovrService.calibrateMatchImpact(3)).toBe(51) })
  it('rating=5 → ovr=63 (exact)', () => { expect(ovrService.calibrateMatchImpact(5)).toBe(63) })
  it('rating=7 → ovr=76 (exact)', () => { expect(ovrService.calibrateMatchImpact(7)).toBe(76) })
  it('rating=9 → ovr=91 (exact)', () => { expect(ovrService.calibrateMatchImpact(9)).toBe(91) })
  it('rating=10 → ovr=99 (exact)', () => { expect(ovrService.calibrateMatchImpact(10)).toBe(99) })

  it('midpoint interpolation: rating=4 → 57', () => {
    // Between anchor {3,51} and {5,63}: t = (4-3)/(5-3) = 0.5; result = 51 + 0.5×12 = 57
    expect(ovrService.calibrateMatchImpact(4)).toBe(57)
  })

  it('midpoint interpolation: rating=8 → 83.5', () => {
    // Between anchor {7,76} and {9,91}: t = (8-7)/(9-7) = 0.5; result = 76 + 0.5×15 = 83.5
    expect(ovrService.calibrateMatchImpact(8)).toBe(83.5)
  })

  it('clamps below minimum: rating=0 → 40', () => { expect(ovrService.calibrateMatchImpact(0)).toBe(40) })
  it('clamps above maximum: rating=11 → 99', () => { expect(ovrService.calibrateMatchImpact(11)).toBe(99) })
  it('clamps negative: rating=-5 → 40', () => { expect(ovrService.calibrateMatchImpact(-5)).toBe(40) })
})
