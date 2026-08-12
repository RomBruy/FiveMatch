/**
 * Where to send someone after they finish signing up.
 *
 * A shared match link used to lose its target at the first hop: the preview
 * screen sent people to sign-up, sign-up sent them to profile completion, and
 * profile completion sent them to the app root. Someone who tapped a friend's
 * link to join Thursday's game landed on a discovery feed with no idea where
 * the match went (AF-002).
 *
 * The obvious fix — carry the destination path through the flow — is an open
 * redirect waiting to happen: anything that accepts a path from outside will
 * eventually be handed one pointing somewhere it should not.
 *
 * So a path is never accepted. Only a kind and an id travel through the flow,
 * both validated, and this module builds the route itself. There is no input
 * that can make it produce a route other than the two literals below.
 *
 * Plain JS with a .d.mts sibling so the mobile `node --test` runner can cover
 * it, matching post-match-opponents. Security logic without tests is a wish.
 */

const INTENT_KINDS = ['match', 'crew']

/** Ids in this app are UUIDs; anything else is not one of ours. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Where the app lands when there is no intent, or it did not survive. */
export const DEFAULT_LANDING = '/(app)'

export function encodeReturnIntent(kind, id) {
  return `${kind}:${id}`
}

/**
 * Parse a `kind:id` token. Returns null for anything unrecognised — a caller
 * that cannot parse its target should land on the default, never guess.
 */
export function parseReturnIntent(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null

  const separator = raw.indexOf(':')
  if (separator === -1) return null

  const kind = raw.slice(0, separator)
  const id = raw.slice(separator + 1)

  if (!INTENT_KINDS.includes(kind)) return null
  if (!UUID_PATTERN.test(id)) return null

  return { kind, id }
}

/**
 * Build the route. Every path is a literal here — the only thing a caller
 * influences is which of them, and which id is interpolated into it.
 */
export function returnIntentPath(raw) {
  const intent = parseReturnIntent(raw)
  if (!intent) return DEFAULT_LANDING

  if (intent.kind === 'match') return `/(app)/match/${intent.id}`
  return `/(app)/groups/${intent.id}`
}
