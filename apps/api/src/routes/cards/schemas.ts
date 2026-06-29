import { z } from 'zod'

export const generateCardPhotoSchema = z.object({
  // No body required; idempotency key comes from header
})
