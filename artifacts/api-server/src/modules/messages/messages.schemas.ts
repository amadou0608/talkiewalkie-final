import { z } from 'zod'
import { DISAPPEAR_AFTER_OPTIONS_SEC } from './disappearing'

export const userIdParamSchema = z.object({ userId: z.string().uuid() })
export const messageIdParamSchema = z.object({ messageId: z.string().uuid() })
export const listMessagesQuerySchema = z.object({
  with: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
})

// Theme 2 — suppression programmee : disappearAfterSec est optionnel, doit
// correspondre a l'un des delais autorises (voir disappearing.ts) si fourni.
const disappearAfterSecSchema = z.union([
  z.literal(30), z.literal(300), z.literal(3600), z.literal(86400), z.literal(604800),
]).optional().nullable()

export const createTextMessageSchema = z.object({
  receiverId: z.string().uuid(),
  content: z.string().trim().min(1).max(4000),
  disappearAfterSec: disappearAfterSecSchema,
})

export { DISAPPEAR_AFTER_OPTIONS_SEC }
