/**
 * How many places a match is offering, in one place.
 *
 * This arithmetic existed in three copies — the attendance service, the public
 * preview route and the match detail service. When 6A changed what a null
 * `openSpots` means, only one copy was updated, so a freshly created public
 * match advertised itself as full on its own shared link and on discovery.
 *
 * Pure and dependency-free so every caller can share it and so it can be tested
 * without a database.
 */

export type PublicationState = {
  visibility: 'private' | 'public'
  publicOpensAt: Date | null
}

/**
 * Whether outsiders may take a place yet.
 *
 * Public visibility alone is not enough: a crew-first match stays private until
 * `publicOpensAt` passes, so the crew gets first refusal on their own fixture
 * (ADR-033).
 */
export function isPubliclyOpen(match: PublicationState, now: Date = new Date()): boolean {
  if (match.visibility !== 'public') return false
  return match.publicOpensAt === null || match.publicOpensAt.getTime() <= now.getTime()
}

/**
 * Places on offer to outsiders.
 *
 * `openSpots` is a CAP on the places that actually remain, never a separate
 * pool: null means "publish whatever is left", and a cap larger than the real
 * remainder cannot conjure places (ADR-033).
 */
export function publicSpotsRemaining(input: {
  capacity: number
  confirmed: number
  openConfirmed: number
  openSpots: number | null
  publiclyOpen: boolean
}): number {
  if (!input.publiclyOpen) return 0

  const actuallyLeft = Math.max(0, input.capacity - input.confirmed)
  const allowance = input.openSpots === null
    ? actuallyLeft
    : Math.max(0, input.openSpots - input.openConfirmed)

  return Math.min(actuallyLeft, allowance)
}
