import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import {
  CARD_CUTOUT_HEIGHT,
  CARD_CUTOUT_KEY_RGB,
  CARD_CUTOUT_WIDTH,
} from '@fivematch/types'
import { buildCardCutout, faceBoxToCropRect, keyOutBackground } from '../image-cutout'

/**
 * A magenta field with an opaque subject rectangle in it, standing in for a
 * generated portrait on the key colour.
 */
async function syntheticGeneration(options: {
  width?: number
  height?: number
  subject?: { left: number; top: number; width: number; height: number }
} = {}) {
  const width = options.width ?? 512
  const height = options.height ?? 512
  const subject = options.subject ?? { left: 156, top: 100, width: 200, height: 260 }

  const subjectLayer = await sharp({
    create: {
      width: subject.width,
      height: subject.height,
      channels: 4,
      background: { r: 200, g: 150, b: 120, alpha: 1 },
    },
  }).png().toBuffer()

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: CARD_CUTOUT_KEY_RGB[0], g: CARD_CUTOUT_KEY_RGB[1], b: CARD_CUTOUT_KEY_RGB[2], alpha: 1 },
    },
  })
    .composite([{ input: subjectLayer, left: subject.left, top: subject.top }])
    .png()
    .toBuffer()
}

/** Alpha of one pixel, for asserting what actually survived the key-out. */
async function alphaAt(png: Buffer, x: number, y: number): Promise<number> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const index = (y * info.width + x) * 4
  return data[index + 3]
}

describe('faceBoxToCropRect', () => {
  const image = { width: 1000, height: 1000 }

  it('expands a face box into head and shoulders', () => {
    const face = { left: 0.4, top: 0.4, width: 0.2, height: 0.2 }
    const rect = faceBoxToCropRect(face, image.width, image.height)

    // Rekognition boxes forehead to chin; the crop must reach above the skull
    // and below the collarbone or the card shows a floating face.
    expect(rect.top).toBeLessThan(face.top * image.height)
    expect(rect.top + rect.height).toBeGreaterThan((face.top + face.height) * image.height)
  })

  it('produces the card aspect ratio', () => {
    const rect = faceBoxToCropRect({ left: 0.4, top: 0.4, width: 0.2, height: 0.2 }, 1000, 1000)
    const ratio = rect.width / rect.height
    expect(ratio).toBeCloseTo(CARD_CUTOUT_WIDTH / CARD_CUTOUT_HEIGHT, 1)
  })

  it('keeps an off-centre subject centred in the crop', () => {
    const face = { left: 0.05, top: 0.4, width: 0.2, height: 0.2 }
    const rect = faceBoxToCropRect(face, 1000, 1000)

    const faceCentre = (face.left + face.width / 2) * 1000
    const cropCentre = rect.left + rect.width / 2
    // Clamped to the image edge, so exact centring is impossible — but the face
    // must still be inside the crop rather than half out of it.
    expect(faceCentre).toBeGreaterThanOrEqual(rect.left)
    expect(faceCentre).toBeLessThanOrEqual(rect.left + rect.width)
    expect(cropCentre).toBeGreaterThan(0)
  })

  it('never returns a rectangle outside the image', () => {
    const corners = [
      { left: 0, top: 0, width: 0.3, height: 0.3 },
      { left: 0.7, top: 0.7, width: 0.3, height: 0.3 },
      { left: 0.02, top: 0.9, width: 0.1, height: 0.08 },
    ]

    for (const face of corners) {
      const rect = faceBoxToCropRect(face, image.width, image.height)
      expect(rect.left).toBeGreaterThanOrEqual(0)
      expect(rect.top).toBeGreaterThanOrEqual(0)
      expect(rect.left + rect.width).toBeLessThanOrEqual(image.width)
      expect(rect.top + rect.height).toBeLessThanOrEqual(image.height)
      expect(rect.width).toBeGreaterThan(0)
      expect(rect.height).toBeGreaterThan(0)
    }
  })

  it('handles a face filling most of the frame', () => {
    const rect = faceBoxToCropRect({ left: 0.05, top: 0.05, width: 0.9, height: 0.9 }, 1000, 1000)
    expect(rect.width).toBeLessThanOrEqual(1000)
    expect(rect.height).toBeLessThanOrEqual(1000)
  })
})

describe('keyOutBackground', () => {
  it('makes the key colour transparent and leaves the subject opaque', () => {
    const rgba = Buffer.from([
      255, 0, 255, 255, // exact key
      200, 150, 120, 255, // skin
    ])
    const out = keyOutBackground(rgba)

    expect(out[3]).toBe(0)
    expect(out[7]).toBe(255)
  })

  it('clears the colour of transparent pixels, not just their alpha', () => {
    const out = keyOutBackground(Buffer.from([255, 0, 255, 255]))

    // A transparent pixel still holding magenta bleeds back when the image is
    // scaled or composited — that is where a fringe around a cutout comes from.
    expect([out[0], out[1], out[2]]).toEqual([0, 0, 0])
  })

  it('tolerates slight compression drift in the key colour', () => {
    const nearlyKey = Buffer.from([250, 4, 251, 255])
    expect(keyOutBackground(nearlyKey)[3]).toBe(0)
  })

  it('does not remove a colour that merely leans magenta', () => {
    // A red shirt or pink skin must survive.
    const shirt = Buffer.from([200, 60, 180, 255])
    expect(keyOutBackground(shirt)[3]).toBe(255)
  })
})

describe('buildCardCutout', () => {
  it('outputs a PNG at the card dimensions', async () => {
    const png = await buildCardCutout(await syntheticGeneration())
    const meta = await sharp(png).metadata()

    expect(meta.format).toBe('png')
    expect(meta.width).toBe(CARD_CUTOUT_WIDTH)
    expect(meta.height).toBe(CARD_CUTOUT_HEIGHT)
    expect(meta.hasAlpha).toBe(true)
  })

  it('leaves nothing behind the subject', async () => {
    const png = await buildCardCutout(await syntheticGeneration({
      subject: { left: 156, top: 0, width: 200, height: 512 },
    }))

    // Corners are background in the source, so they must be fully transparent —
    // this is the whole requirement: only the subject, nothing behind it.
    expect(await alphaAt(png, 2, 2)).toBe(0)
    expect(await alphaAt(png, CARD_CUTOUT_WIDTH - 3, 2)).toBe(0)

    // The subject band survives.
    expect(await alphaAt(png, Math.floor(CARD_CUTOUT_WIDTH / 2), 40)).toBe(255)
  })

  it('crops to the face box when one is given', async () => {
    const source = await syntheticGeneration({
      subject: { left: 300, top: 300, width: 150, height: 150 },
    })

    const withBox = await buildCardCutout(source, {
      left: 300 / 512, top: 300 / 512, width: 150 / 512, height: 150 / 512,
    })
    const withoutBox = await buildCardCutout(source)

    // Cropping to the subject must produce a different image from taking the
    // whole frame, or the face box is being ignored.
    expect(withBox.equals(withoutBox)).toBe(false)
  })

  it('still produces a correctly shaped image with no face box', async () => {
    const png = await buildCardCutout(await syntheticGeneration())
    const meta = await sharp(png).metadata()

    // Worse framing, but never a wrongly shaped asset.
    expect(meta.width).toBe(CARD_CUTOUT_WIDTH)
    expect(meta.height).toBe(CARD_CUTOUT_HEIGHT)
  })

  it('rejects something that is not an image', async () => {
    await expect(buildCardCutout(Buffer.from('not an image'))).rejects.toThrow()
  })
})
