import fs from 'node:fs'
import type { Request, Response } from 'express'
import { AppError } from '../../utils/AppError'
import { asyncHandler } from '../../utils/asyncHandler'
import { hasActiveSocket, notifyUser } from '../../realtime/socket'
import { sendPushToUser } from '../push/push.service'
import { absolutePathFor } from './storage'
import { sendVoiceMessageSchema, voiceMessageIdParamSchema } from './voice-messages.schemas'
import {
  createVoiceMessage,
  getVoiceMessageForAccess,
  listInbox,
  markListened,
} from './voice-messages.service'

// req.userId est garanti present : toutes les routes de ce module passent
// par requireAuth (voir voice-messages.routes.ts).

export const list = asyncHandler(async (req: Request, res: Response) => {
  const messages = await listInbox(req.userId!)
  res.status(200).json({ messages })
})

export const send = asyncHandler(async (req: Request, res: Response) => {
  // multer (voir routes.ts, upload.single('audio')) place le fichier sur
  // req.file — jamais dans req.body.
  if (!req.file) {
    throw new AppError('INVALID_AUDIO_FILE', 'Aucun fichier audio recu.', 400)
  }

  const parsed = sendVoiceMessageSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Donnees invalides.')
  }

  const message = await createVoiceMessage(req.userId!, parsed.data.receiverUserId, parsed.data.durationSec, {
    buffer: req.file.buffer,
    mimetype: req.file.mimetype,
    size: req.file.size,
  })

  notifyUser(parsed.data.receiverUserId, 'voice-message:new', {
    id: message.id,
    senderId: req.userId,
  })

  // Section 11, exemple donne par le cahier des charges : "Nouveau message
  // vocal de Moussa". Seulement si le destinataire n'a aucun socket ouvert
  // (voir hasActiveSocket) — sinon il vient deja de recevoir l'evenement
  // 'voice-message:new' ci-dessus. Ne bloque jamais la reponse HTTP : un
  // echec d'envoi push ne doit pas faire echouer l'envoi du vocal lui-meme.
  if (!hasActiveSocket(parsed.data.receiverUserId)) {
    sendPushToUser(parsed.data.receiverUserId, {
      title: 'Nouveau message vocal',
      body: `${message.sender.displayName} vous a envoye un message vocal.`,
      url: '/messages',
      tag: 'voice-message',
    }).catch((err) => console.error('[push] echec notification message vocal', err))
  }

  res.status(201).json({ message })
})

export const listened = asyncHandler(async (req: Request, res: Response) => {
  const parsed = voiceMessageIdParamSchema.safeParse(req.params)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Identifiant de message invalide.')
  }

  const result = await markListened(parsed.data.id, req.userId!)
  res.status(200).json(result)
})

// Seule route qui sert le contenu audio — jamais de fichier statique
// exposable directement (section 13/14). Supporte les requetes partielles
// (Range) pour une lecture fluide cote navigateur (section 19).
export const audio = asyncHandler(async (req: Request, res: Response) => {
  const parsed = voiceMessageIdParamSchema.safeParse(req.params)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Identifiant de message invalide.')
  }

  const row = await getVoiceMessageForAccess(parsed.data.id, req.userId!)
  const absolutePath = absolutePathFor(row.storage_path)

  let stat: fs.Stats
  try {
    stat = fs.statSync(absolutePath)
  } catch {
    // Ligne DB presente mais fichier disparu du disque (ex. redeploiement
    // sans volume persistant — limite connue, voir storage.ts).
    throw new AppError('VOICE_MESSAGE_NOT_FOUND', 'Fichier audio introuvable.', 404)
  }

  res.setHeader('Content-Type', row.mime_type)
  res.setHeader('Accept-Ranges', 'bytes')

  const range = req.headers.range
  if (!range) {
    res.setHeader('Content-Length', stat.size)
    fs.createReadStream(absolutePath).pipe(res)
    return
  }

  const match = /bytes=(\d*)-(\d*)/.exec(range)
  const start = match?.[1] ? Number(match[1]) : 0
  const end = match?.[2] ? Number(match[2]) : stat.size - 1

  res.status(206)
  res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
  res.setHeader('Content-Length', end - start + 1)
  fs.createReadStream(absolutePath, { start, end }).pipe(res)
})
