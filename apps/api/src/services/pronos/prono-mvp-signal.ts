import type { OvrSignal } from '../players/ovr-signal'

// PRONOS signals MUST NOT be registered with non-zero weight in the OVR pipeline.
// OVR = player performance. Pronos = prediction accuracy. These systems are fully separate.
// See: docs/algorithm-decisions.md §"Pronos Signal" and §"Core Principle"
// Story 6.4 planned to give this signal weight=0.3; that implementation is permanently blocked.
export function createPronosMvpSignal(playerId: string, groupId: string): OvrSignal {
  return {
    type: 'pronos_mvp',
    playerId,
    groupId,
    value: 0,
    weight: 0,
    computedAt: new Date(),
  }
}
