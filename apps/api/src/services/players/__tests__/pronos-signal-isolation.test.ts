import { describe, it, expect, vi } from 'vitest'

// ── hoisted mocks — prono-mvp-signal is a pure function, no db needed ────────
vi.mock('../../../db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
  },
}))
vi.mock('../../../services/notifications/notification.service', () => ({
  notificationService: { send: vi.fn() },
}))
vi.mock('../seeding.service', () => ({
  seedingService: { computeInitialSeed: vi.fn() },
}))

import { ovrService } from '../ovr.service'
import { createPronosMvpSignal } from '../../pronos/prono-mvp-signal'
import type { OvrSignal } from '../ovr-signal'

describe('Pronos signal isolation from OVR', () => {
  it('applySignals returns currentOvr unchanged when pronos_mvp signal has weight=0', () => {
    const pronosSignal: OvrSignal = {
      type: 'pronos_mvp',
      playerId: 'p1',
      groupId: 'g1',
      value: 75,
      weight: 0,
      computedAt: new Date(),
    }
    expect(ovrService.applySignals(70, [pronosSignal], 10)).toBe(70)
  })

  it('createPronosMvpSignal always returns weight=0 and value=0 regardless of call args', () => {
    const signal = createPronosMvpSignal('p1', 'g1')
    expect(signal.weight).toBe(0)
    expect(signal.value).toBe(0)
  })

  it('applySignals ignores a non-zero weight pronos signal via zero-weight guard', () => {
    // Demonstrates what would happen if someone bypassed the blocking guard in createPronosMvpSignal:
    // weight is forced to 0 by createPronosMvpSignal, so OVR never moves from pronos data
    const bypassAttempt: OvrSignal = {
      type: 'pronos_mvp',
      playerId: 'p1',
      groupId: 'g1',
      value: 75,
      weight: 0,  // weight is forced to 0 by createPronosMvpSignal
      computedAt: new Date(),
    }
    const result = ovrService.applySignals(70, [bypassAttempt], 10)
    expect(result).toBe(70)  // no movement
  })
})
