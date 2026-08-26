import { z } from 'zod'

export const userIdParamSchema = z.object({ userId: z.string().uuid() })
export const messageIdParamSchema = z.object({ messageId: z.string().uuid() })
export const listMessagesQuerySchema = z.object({
  with: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
})
export const createTextMessageSchema = z.object({
  receiverId: z.string().uuid(),
  content: z.string().trim().min(1).max(4000),
})
