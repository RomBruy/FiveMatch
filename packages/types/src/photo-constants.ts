/**
 * Panini photo processing constants (Phase 5, ADR-030).
 *
 * Shared with mobile because the consent screen must state the same policy
 * version, purpose and retention that the server records. A consent whose text
 * and stored record can drift apart is not evidence of anything.
 */

/**
 * Bump when the consent text changes in any way that affects what the player
 * agreed to. Existing consents keep the version they were given under, and a
 * player whose stored version is older than this is treated as not having
 * current consent (rule 35: explicit AND current).
 */
export const PHOTO_CONSENT_POLICY_VERSION = 'v1'

/** What the player is agreeing to. Stored on the consent record verbatim. */
export const PHOTO_PROCESSING_PURPOSE = 'panini_card_portrait_generation'

/** How long a generated photo is kept once consent is withdrawn. */
export const PHOTO_RETENTION_DAYS_AFTER_WITHDRAWAL = 0

/** Ceiling on a fetched source image. Refused, not truncated. */
export const PHOTO_MAX_INPUT_BYTES = 10 * 1024 * 1024

/** Only these are accepted as a source image. */
export const PHOTO_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** Abort a source fetch that stalls. */
export const PHOTO_FETCH_TIMEOUT_MS = 10_000

/** Generations allowed per player per calendar month. */
export const PHOTO_GENERATIONS_PER_MONTH = 3
