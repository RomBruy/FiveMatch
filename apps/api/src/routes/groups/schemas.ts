import { z } from 'zod'

export const transferOrganizerSchema = z.object({
  newOrganizerId: z.string().uuid(),
})

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  formatPreset: z.enum(['5v5', '6v6', '7v7', 'custom']),
  goalkeeperMode: z.enum(['fixed', 'rotating', 'none']),
  playStyle: z.enum(['fixed', 'flexible', 'rotating', 'hybrid']).optional(),
  generatorStyle: z.enum(['pure_ovr', 'position_aware', 'mixed']).default('pure_ovr'),
})

export const updateGroupSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    formatPreset: z.enum(['5v5', '6v6', '7v7', 'custom']).optional(),
    goalkeeperMode: z.enum(['fixed', 'rotating', 'none']).optional(),
    playStyle: z.enum(['fixed', 'flexible', 'rotating', 'hybrid']).nullable().optional(),
    generatorStyle: z.enum(['pure_ovr', 'position_aware', 'mixed']).optional(),
    searchable: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field required' })
