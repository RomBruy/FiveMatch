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

// ─── Card cutout (the photo the card actually renders) ───────────────────────

/**
 * Output dimensions. The card slot is 150x170 at scale 1 and the export surface
 * is 1080 wide, so the asset is rendered at 4x the slot to stay sharp when the
 * card is exported rather than merely viewed.
 */
export const CARD_CUTOUT_WIDTH = 600
export const CARD_CUTOUT_HEIGHT = 680

/**
 * The flat colour the generator renders behind the subject, knocked out to
 * transparency afterwards. Pure magenta occurs in neither skin nor hair, so
 * nothing of the subject is removed with it.
 */
export const CARD_CUTOUT_KEY_RGB = [255, 0, 255] as const

/** Squared-distance tolerance for matching the key colour, 0-441. */
export const CARD_CUTOUT_KEY_TOLERANCE = 90

/**
 * How far to grow a detected face box into head and shoulders, as multiples of
 * the face height. Rekognition boxes forehead to chin, which crops the skull and
 * leaves no body.
 */
export const CARD_FACE_BOX_HEADROOM = 0.65
export const CARD_FACE_BOX_SHOULDERS = 0.85
