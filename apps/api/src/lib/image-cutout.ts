import sharp from 'sharp'
import {
  CARD_CUTOUT_HEIGHT,
  CARD_CUTOUT_KEY_RGB,
  CARD_CUTOUT_KEY_TOLERANCE,
  CARD_CUTOUT_WIDTH,
  CARD_FACE_BOX_HEADROOM,
  CARD_FACE_BOX_SHOULDERS,
} from '@fivematch/types'

/**
 * Turn a generated portrait into the cut-out the card expects: head and
 * shoulders, correct aspect, nothing behind it.
 *
 * The card slot renders at 150x170 with `resizeMode="cover"` and falls back to a
 * duotone silhouette, so it was always designed around a cutout. Handing it a
 * rectangular photo with a background showing is the thing this avoids.
 */

/** Rekognition's box: fractions of image width/height, origin top-left. */
export type FaceBox = {
  left: number
  top: number
  width: number
  height: number
}

export type Rect = { left: number; top: number; width: number; height: number }

/**
 * Expand a face box to head-and-shoulders at the card's aspect ratio.
 *
 * Rekognition boxes the face alone — forehead to chin — which crops the top of
 * the head off and leaves no shoulders. The expansion adds headroom above and
 * body below, then widens or heightens whichever dimension is short of the
 * target aspect so nothing is squashed.
 *
 * Pure integer geometry, clamped to the image: the result is always a rectangle
 * that actually exists inside the source.
 */
export function faceBoxToCropRect(
  box: FaceBox,
  imageWidth: number,
  imageHeight: number,
): Rect {
  const faceLeft = box.left * imageWidth
  const faceTop = box.top * imageHeight
  const faceWidth = box.width * imageWidth
  const faceHeight = box.height * imageHeight

  // Grow around the face rather than from the image centre — an off-centre
  // subject must stay centred in the crop.
  const centreX = faceLeft + faceWidth / 2
  const top = faceTop - faceHeight * CARD_FACE_BOX_HEADROOM
  const bottom = faceTop + faceHeight * (1 + CARD_FACE_BOX_SHOULDERS)

  let height = bottom - top
  let width = height * (CARD_CUTOUT_WIDTH / CARD_CUTOUT_HEIGHT)

  // The face may be wider than the aspect allows; give it the room.
  const minWidth = faceWidth * (1 + CARD_FACE_BOX_SHOULDERS)
  if (width < minWidth) {
    width = minWidth
    height = width * (CARD_CUTOUT_HEIGHT / CARD_CUTOUT_WIDTH)
  }

  // Clamp into the image without changing the aspect: shrink, then re-centre.
  width = Math.min(width, imageWidth)
  height = Math.min(height, imageHeight)

  let left = centreX - width / 2
  let cropTop = top

  left = Math.max(0, Math.min(left, imageWidth - width))
  cropTop = Math.max(0, Math.min(cropTop, imageHeight - height))

  return {
    left: Math.round(left),
    top: Math.round(cropTop),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
  }
}

/**
 * Replace the flat key colour with transparency.
 *
 * The generator is asked to render the subject on one uniform colour that never
 * occurs in skin or hair, which is far more reliable than asking a model for a
 * transparent background it cannot actually produce. Anything within tolerance
 * of that colour becomes alpha 0.
 *
 * Tolerance is squared-distance in RGB rather than per-channel, so a pixel is
 * judged on how far it is from the key overall — a per-channel test lets a
 * colour drift a long way diagonally and still pass.
 */
export function keyOutBackground(
  rgba: Buffer,
  key: readonly [number, number, number] = CARD_CUTOUT_KEY_RGB,
  tolerance: number = CARD_CUTOUT_KEY_TOLERANCE,
): Buffer {
  const out = Buffer.from(rgba)
  const toleranceSquared = tolerance * tolerance

  for (let i = 0; i < out.length; i += 4) {
    const dr = out[i] - key[0]
    const dg = out[i + 1] - key[1]
    const db = out[i + 2] - key[2]

    if (dr * dr + dg * dg + db * db <= toleranceSquared) {
      out[i + 3] = 0
      // Neutralise the colour as well. A transparent pixel that still holds the
      // key colour bleeds back when the image is scaled or composited, which is
      // where the magenta fringe around a cutout comes from.
      out[i] = 0
      out[i + 1] = 0
      out[i + 2] = 0
    }
  }

  return out
}

/**
 * Remove the halo left along the subject's edge.
 *
 * Anti-aliasing blends skin into the key colour, so edge pixels are part
 * magenta but not magenta enough to be keyed — they survive as a pink fringe
 * around the cutout. Two passes fix it:
 *
 * 1. Despill: magenta is red and blue high with green low, so any pixel whose
 *    blue exceeds its green is pulled back to it. Skin runs blue below green,
 *    so real subject colour is untouched.
 * 2. Erode: any pixel touching a transparent one is cleared too, trimming the
 *    blend band away entirely. It costs a hair of the subject, which is
 *    invisible, where the fringe is not.
 */
export function despillAndErode(rgba: Buffer, width: number, height: number): Buffer {
  const out = Buffer.from(rgba)

  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue
    const g = out[i + 1]
    if (out[i + 2] > g && out[i] > g) out[i + 2] = g
  }

  // Erode against the original alpha so the pass does not cascade inward.
  const alpha = Buffer.alloc(width * height)
  for (let p = 0; p < width * height; p++) alpha[p] = out[p * 4 + 3]

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      if (alpha[p] === 0) continue

      const touchesHole =
        (x > 0 && alpha[p - 1] === 0) ||
        (x < width - 1 && alpha[p + 1] === 0) ||
        (y > 0 && alpha[p - width] === 0) ||
        (y < height - 1 && alpha[p + width] === 0)

      if (touchesHole) {
        const i = p * 4
        out[i] = 0
        out[i + 1] = 0
        out[i + 2] = 0
        out[i + 3] = 0
      }
    }
  }

  return out
}

/**
 * Full pipeline: crop to the subject, knock out the background, output a PNG
 * with alpha at the card's dimensions.
 *
 * `faceBox` is optional — without a detected face the image is centre-cropped to
 * the target aspect, which is worse but still correctly shaped.
 */
export async function buildCardCutout(
  input: Buffer,
  faceBox?: FaceBox,
): Promise<Buffer> {
  const metadata = await sharp(input).metadata()
  const imageWidth = metadata.width ?? 0
  const imageHeight = metadata.height ?? 0
  if (imageWidth === 0 || imageHeight === 0) throw new Error('CUTOUT_INVALID_IMAGE')

  const pipeline = sharp(input)

  if (faceBox) {
    pipeline.extract(faceBoxToCropRect(faceBox, imageWidth, imageHeight))
  }

  const { data, info } = await pipeline
    .resize(CARD_CUTOUT_WIDTH, CARD_CUTOUT_HEIGHT, { fit: 'cover', position: 'top' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const keyed = despillAndErode(keyOutBackground(data), info.width, info.height)

  return sharp(keyed, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9 })
    .toBuffer()
}
