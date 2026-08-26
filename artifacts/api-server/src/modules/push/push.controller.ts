import type { Request, Response } from 'express'
import { AppError } from '../../utils/AppError'
import { asyncHandler } from '../../utils/asyncHandler'
import { deleteDevice, upsertDevice } from './push.repository'
import { getPublicKey, isPushEnabled } from './push.service'
import { subscribeSchema, unsubscribeSchema } from './push.schemas'

// req.userId est garanti present : ce module passe par requireAuth (voir
// push.routes.ts).

export const publicKey = asyncHandler(async (_req: Request, res: Response) => {
  res.status(200).json({ enabled: isPushEnabled(), publicKey: isPushEnabled() ? getPublicKey() : null })
})

export const subscribe = asyncHandler(async (req: Request, res: Response) => {
  const parsed = subscribeSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Abonnement invalide.')
  }
  await upsertDevice(req.userId!, parsed.data)
  res.status(201).json({ subscribed: true })
})

export const unsubscribe = asyncHandler(async (req: Request, res: Response) => {
  const parsed = unsubscribeSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Endpoint invalide.')
  }
  await deleteDevice(req.userId!, parsed.data.endpoint)
  res.status(200).json({ subscribed: false })
})
