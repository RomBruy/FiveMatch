import { GoogleGenAI } from '@google/genai'
import { CARD_CUTOUT_KEY_RGB } from '@fivematch/types'

export interface GeminiClient {
  generateCardPhoto(inputImageBase64: string, mimeType: string): Promise<Buffer>
}

/**
 * Which model renders the card portrait.
 *
 * Configurable because image-model names move faster than this codebase does,
 * and swapping one should not need a deploy of changed source.
 */
export const DEFAULT_IMAGE_MODEL = 'gemini-2.5-flash-image'

const keyColourHex = `#${CARD_CUTOUT_KEY_RGB.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`

/**
 * The card portrait prompt.
 *
 * Two things it must deliver beyond the look:
 *
 * 1. A flat, uniform background in exactly the key colour. The card shows a
 *    cutout with nothing behind it, and asking a model for real transparency
 *    does not work — it is removed afterwards instead, which needs one solid
 *    colour that appears nowhere in the subject.
 * 2. A recognisable face. A vintage sticker style pulls toward caricature, and
 *    a portrait nobody recognises is not worth generating.
 */
export const CARD_PHOTO_PROMPT = [
  'Redraw this person as a 1970s Panini football sticker portrait.',
  'Head and shoulders only, facing forward, centred, filling most of the frame.',
  'Style: vintage offset lithography with slight colour misregistration, visible',
  'halftone dot texture, faded sun-bleached palette, warm yellowed tones, soft',
  'grain, gently absurd deadpan expression like an old team sticker.',
  'Keep the face clearly recognisable as the same person.',
  `Place the subject on a completely flat, uniform, solid ${keyColourHex} background.`,
  'The background must be one single solid colour with no gradient, no shadow,',
  'no texture, no vignette and no objects. Do not let that colour appear anywhere',
  'on the person, their hair or their clothing.',
  'Portrait orientation, taller than wide.',
].join(' ')

export function createGeminiClient(apiKey: string, model = DEFAULT_IMAGE_MODEL): GeminiClient {
  const client = new GoogleGenAI({ apiKey })

  return {
    async generateCardPhoto(inputImageBase64: string, mimeType: string): Promise<Buffer> {
      const response = await client.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: inputImageBase64, mimeType } },
              { text: CARD_PHOTO_PROMPT },
            ],
          },
        ],
        config: {
          // Without this the model answers about the image instead of returning
          // one, which is how the previous implementation failed: it asked a
          // text-only model for image bytes and never found any.
          responseModalities: ['IMAGE'],
        },
      })

      const parts = response.candidates?.[0]?.content?.parts ?? []
      const imagePart = parts.find((part) => part.inlineData?.data)

      if (!imagePart?.inlineData?.data) {
        throw new Error('Gemini returned no image data')
      }

      return Buffer.from(imagePart.inlineData.data, 'base64')
    },
  }
}

export function createGeminiClientFromEnv(): GeminiClient {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')
  return createGeminiClient(apiKey, process.env.GEMINI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL)
}
