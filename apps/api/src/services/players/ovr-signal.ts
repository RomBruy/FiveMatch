// NOTE: OvrSignal is the interface for OVR-influencing signals only.
// Pronos-based signals (pronos_mvp type) must always have weight=0.
// See: docs/algorithm-decisions.md §"Core Principle"
export interface OvrSignal {
  type: string
  playerId: string
  groupId: string
  value: number
  weight: number
  computedAt: Date
}
