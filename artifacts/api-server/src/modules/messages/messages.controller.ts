import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { AppError } from '../../utils/AppError'
import { createTextMessageSchema, listMessagesQuerySchema, messageIdParamSchema } from './messages.schemas'
import { createTextMessage, listConversation, markDelivered, markRead, markConversationRead, editTextMessage, deleteMessage, getConversationSummaries } from './messages.service'
import { hasActiveSocket, notifyUser } from '../../realtime/socket'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const parsed = listMessagesQuerySchema.safeParse(req.query)
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Requête invalide.')
  const messages = await listConversation(req.userId!, parsed.data.with, parsed.data.limit, parsed.data.before)
  res.json({ messages })
})

export const createText = asyncHandler(async (req: Request, res: Response) => {
  const parsed = createTextMessageSchema.safeParse(req.body)
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Données invalides.')
  const delivered = hasActiveSocket(parsed.data.receiverId)
  const message = await createTextMessage(req.userId!, parsed.data.receiverId, parsed.data.content, delivered)
  notifyUser(parsed.data.receiverId, 'message:new', message)
  if (delivered) notifyUser(req.userId!, 'message:status', { messageId: message.id, status: 'delivered' })
  res.status(201).json({ message })
})

export const delivered = asyncHandler(async (req: Request, res: Response) => {
  const parsed = messageIdParamSchema.safeParse(req.params)
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Identifiant de message invalide.')
  const message = await markDelivered(req.userId!, parsed.data.messageId)
  if (message) notifyUser(message.senderId, 'message:status', { messageId: message.id, status: 'delivered' })
  res.json({ message })
})

export const read = asyncHandler(async (req: Request, res: Response) => {
  const parsed = messageIdParamSchema.safeParse(req.params)
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Identifiant de message invalide.')
  const message = await markRead(req.userId!, parsed.data.messageId)
  if (message) notifyUser(message.senderId, 'message:status', { messageId: message.id, status: 'read' })
  res.json({ message })
})

export const readConversation = asyncHandler(async (req: Request, res: Response) => {
  const parsed = listMessagesQuerySchema.pick({ with: true }).safeParse(req.query)
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Identifiant de conversation invalide.')
  const changed = await markConversationRead(req.userId!, parsed.data.with)
  for (const row of changed) notifyUser(row.sender_id, 'message:status', { messageId: row.id, status: 'read' })
  res.json({ count: changed.length })
})

export const summaries = asyncHandler(async (req: Request, res: Response) => {
  res.json({ conversations: await getConversationSummaries(req.userId!) })
})

export const edit = asyncHandler(async (req: Request, res: Response) => {
  const parsed = messageIdParamSchema.merge(createTextMessageSchema.pick({ content: true })).safeParse({ ...req.params, ...req.body })
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Données invalides.')
  const message = await editTextMessage(req.userId!, parsed.data.messageId, parsed.data.content)
  notifyUser(message.receiverId, 'message:updated', message)
  res.json({ message })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const parsed = messageIdParamSchema.safeParse(req.params)
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', 'Identifiant de message invalide.')
  const result = await deleteMessage(req.userId!, parsed.data.messageId)
  notifyUser(result.receiverId, 'message:deleted', { messageId: result.id })
  res.json({ messageId: result.id })
})
