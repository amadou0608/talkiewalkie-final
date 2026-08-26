import type { Request, Response } from 'express'
import { AppError } from '../../utils/AppError'
import { asyncHandler } from '../../utils/asyncHandler'
import {
  addContactSchema,
  contactUserIdParamSchema,
  searchQuerySchema,
} from './contacts.schemas'
import {
  addContact,
  blockContact,
  listBlocked,
  listContacts,
  removeContact,
  searchUser,
  unblockContact,
} from './contacts.service'

// req.userId est garanti present : toutes les routes de ce module passent
// par requireAuth (voir contacts.routes.ts).

export const list = asyncHandler(async (req: Request, res: Response) => {
  const contacts = await listContacts(req.userId!)
  res.status(200).json(contacts)
})

export const blocked = asyncHandler(async (req: Request, res: Response) => {
  const items = await listBlocked(req.userId!)
  res.status(200).json({ blocked: items })
})

export const search = asyncHandler(async (req: Request, res: Response) => {
  const parsed = searchQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Requete invalide.')
  }

  const user = await searchUser(req.userId!, parsed.data.q)
  res.status(200).json({ user })
})

export const add = asyncHandler(async (req: Request, res: Response) => {
  const parsed = addContactSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Donnees invalides.')
  }

  const contact = await addContact(req.userId!, parsed.data.username)
  res.status(201).json({ contact })
})

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const parsed = contactUserIdParamSchema.safeParse(req.params)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Identifiant de contact invalide.')
  }

  await removeContact(req.userId!, parsed.data.contactUserId)
  res.status(204).end()
})

export const block = asyncHandler(async (req: Request, res: Response) => {
  const parsed = contactUserIdParamSchema.safeParse(req.params)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Identifiant de contact invalide.')
  }

  await blockContact(req.userId!, parsed.data.contactUserId)
  res.status(204).end()
})

export const unblock = asyncHandler(async (req: Request, res: Response) => {
  const parsed = contactUserIdParamSchema.safeParse(req.params)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Identifiant de contact invalide.')
  }

  await unblockContact(req.userId!, parsed.data.contactUserId)
  res.status(204).end()
})
