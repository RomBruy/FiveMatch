import { GoogleGenerativeAI } from '@google/generative-ai'

export interface GeminiClient {
  generateCardPhoto(inputImageBase64: string, mimeType: string): Promise<Buffer>
}

export function createGeminiClient(apiKey: string): GeminiClient {
  const genAI = new GoogleGenerativeAI(apiKey)

  return {
    async generateCardPhoto(inputImageBase64: string, mimeType: string): Promise<Buffer> {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      const result = await model.generateContent([
        {
          inlineData: {
            data: inputImageBase64,
            mimeType,
          },
        },
        'Generate a stylized Panini football card portrait. Keep the face recognizable. Apply a bold graphic illustration style with high contrast and flat colors. Dark background. Output a square 512x512 image.',
      ])
      const imagePart = result.response.candidates?.[0]?.content?.parts?.find(
        (p: { inlineData?: { data: string; mimeType: string } }) => p.inlineData
      )
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
  return createGeminiClient(apiKey)
}
