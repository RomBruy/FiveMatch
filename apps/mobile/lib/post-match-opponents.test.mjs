import assert from 'node:assert/strict'
import test from 'node:test'
import { getOpposingParticipants, mapPostMatchRatingError } from './post-match-opponents.mjs'

const participants = [
  { playerId: 'me', displayName: 'P-A1', teamSide: 'A' },
  { playerId: 'teammate', displayName: 'P-A2', teamSide: 'A' },
  { playerId: 'opponent-1', displayName: 'P-B1', teamSide: 'B' },
  { playerId: 'opponent-2', displayName: 'P-B2', teamSide: 'B' },
  { playerId: null, displayName: 'ANON', teamSide: 'B' },
]

test('lists opposing final participants, never teammates or anonymized rows', () => {
  assert.deepEqual(
    getOpposingParticipants(participants, 'me').map((participant) => participant.playerId),
    ['opponent-1', 'opponent-2'],
  )
})

test('returns a safe empty state when the viewer has no final participant snapshot', () => {
  assert.deepEqual(getOpposingParticipants(participants, 'missing'), [])
  assert.deepEqual(getOpposingParticipants(participants, null), [])
})

test('maps controlled server rejections to existing UI states', () => {
  assert.equal(mapPostMatchRatingError('ALREADY_RATED'), 'rated')
  assert.equal(mapPostMatchRatingError('RATING_WINDOW_CLOSED'), 'window_closed')
  assert.equal(mapPostMatchRatingError('CANNOT_RATE_TEAMMATE'), 'generic_error')
})
