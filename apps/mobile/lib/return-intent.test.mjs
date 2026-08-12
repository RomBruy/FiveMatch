import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_LANDING,
  encodeReturnIntent,
  parseReturnIntent,
  returnIntentPath,
} from './return-intent.mjs'

const MATCH_ID = '11111111-1111-4111-8111-111111111111'

test('round-trips a match intent', () => {
  const token = encodeReturnIntent('match', MATCH_ID)
  assert.deepEqual(parseReturnIntent(token), { kind: 'match', id: MATCH_ID })
  assert.equal(returnIntentPath(token), `/(app)/match/${MATCH_ID}`)
})

test('round-trips a crew intent', () => {
  const token = encodeReturnIntent('crew', MATCH_ID)
  assert.equal(returnIntentPath(token), `/(app)/groups/${MATCH_ID}`)
})

test('falls back to the app root when there is no intent', () => {
  for (const value of [undefined, null, '', '   ']) {
    assert.equal(returnIntentPath(value), DEFAULT_LANDING)
  }
})

test('refuses an unknown kind', () => {
  assert.equal(parseReturnIntent(`admin:${MATCH_ID}`), null)
  assert.equal(returnIntentPath(`admin:${MATCH_ID}`), DEFAULT_LANDING)
})

test('refuses an id that is not a uuid', () => {
  assert.equal(parseReturnIntent('match:../../admin'), null)
  assert.equal(parseReturnIntent('match:1'), null)
  assert.equal(parseReturnIntent('match:'), null)
})

test('cannot be talked into an arbitrary destination', () => {
  // The whole point: a path is never accepted, so none of these can produce
  // one. Every route this module returns is a literal in its own source.
  const attacks = [
    'https://evil.example.com',
    '//evil.example.com',
    '/(app)/admin',
    'match:https://evil.example.com',
    `match:${MATCH_ID}/../../admin`,
    `match:${MATCH_ID}?next=/(app)/admin`,
    'crew:../../../etc/passwd',
    `match:${MATCH_ID}\n/(app)/admin`,
  ]

  for (const attack of attacks) {
    const path = returnIntentPath(attack)
    assert.equal(path, DEFAULT_LANDING, `expected fallback for ${JSON.stringify(attack)}`)
  }
})

test('only ever returns one of the known route shapes', () => {
  // Fuzz the parser: whatever goes in, the output is the default or a route
  // built from a validated uuid.
  const fragments = ['match', 'crew', 'admin', ':', '/', '..', MATCH_ID, '', 'x']
  for (let i = 0; i < 400; i++) {
    const raw = Array.from({ length: 4 }, () =>
      fragments[Math.floor(Math.random() * fragments.length)]).join('')

    const path = returnIntentPath(raw)
    const valid = path === DEFAULT_LANDING
      || path === `/(app)/match/${MATCH_ID}`
      || path === `/(app)/groups/${MATCH_ID}`

    assert.ok(valid, `unexpected path ${path} from ${JSON.stringify(raw)}`)
  }
})

test('ignores anything after the first separator being another separator', () => {
  // `match:a:b` must not smuggle a second segment through.
  assert.equal(parseReturnIntent(`match:${MATCH_ID}:extra`), null)
})
