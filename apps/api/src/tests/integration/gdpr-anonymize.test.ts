import { describe, it } from 'vitest'

describe('GDPR cascade anonymization', () => {
  describe('Epic 1 scope', () => {
    it.todo('users soft-delete sets deletedAt')
    it.todo('30-day window: hard-delete removes all PII')
    it.todo('hard-delete cascades to players, ratings, match_players')
  })
  // Epic 2–7 scopes added as TODO blocks in their respective epics
})
