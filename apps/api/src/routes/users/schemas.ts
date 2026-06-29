import { z } from 'zod'
import { NOTIFICATION_TYPES } from '../../db/schema'

export const updateNotificationPreferenceSchema = z.object({
  type: z.enum(NOTIFICATION_TYPES),
  enabled: z.boolean(),
})
