import fs from 'node:fs'
import type { Request, Response } from 'express'
import { AppError } from '../../utils/AppError'
import { asyncHandler } from '../../utils/asyncHandler'
import { hasActiveSocket, notifyUser } from '../../realtime/socket'
import { sendPushToUser } from '../push/push.service'
import { absolutePathFor, deleteVoiceMessageFile, saveVoiceMessageFile } from '../voice-messages/storage'
import { sendVoiceMessageSchema, MAX_VOICE_MESSAGE_BYTES } from '../voice-messages/voice-messages.schemas'
import { createChatVoiceMessage, getChatMessageFile, editVoiceMessage, markVoiceConsumed } from './messages.service'

export const createVoice = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError('INVALID_AUDIO_FILE', 'Aucun fichier audio reçu.', 400)
  const parsed = sendVoiceMessageSchema.safeParse(req.body)
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Données invalides.')
  if (req.file.size > MAX_VOICE_MESSAGE_BYTES) throw new AppError('FILE_TOO_LARGE', 'Message vocal trop volumineux.', 413)
  if (!req.file.mimetype.startsWith('audio/')) throw new AppError('INVALID_AUDIO_FILE', 'Format audio non supporté.', 400)

  const { relativePath } = saveVoiceMessageFile(req.file.buffer, req.file.mimetype)
  try {
    const message = await createChatVoiceMessage(
      req.userId!,
      parsed.data.receiverUserId,
      parsed.data.durationSec,
      relativePath,
      req.file.mimetype,
      hasActiveSocket(parsed.data.receiverUserId),
      parsed.data.viewOnce,
    )
    notifyUser(parsed.data.receiverUserId, 'message:new', message)
    if (message.status === 'delivered') notifyUser(req.userId!, 'message:status', { messageId: message.id, status: 'delivered' })
    if (!hasActiveSocket(parsed.data.receiverUserId)) {
      sendPushToUser(parsed.data.receiverUserId, {
        title: 'Nouveau message vocal',
        body: `${message.sender.displayName} vous a envoyé un message vocal.`,
        url: '/messages',
        tag: 'message-voice',
      }).catch((err) => console.error('[push] échec notification vocal', err))
    }
    res.status(201).json({ message })
  } catch (err) {
    deleteVoiceMessageFile(relativePath)
    throw err
  }
})

export const voiceFile = asyncHandler(async (req: Request, res: Response) => {
  const message = await getChatMessageFile(req.params.messageId, req.userId!, 'voice')
  const absolutePath = absolutePathFor(message.fileUrl)
  let stat: fs.Stats
  try { stat = fs.statSync(absolutePath) } catch { throw new AppError('FILE_NOT_FOUND', 'Fichier audio introuvable.', 404) }

  res.setHeader('Content-Type', message.mimeType)
  res.setHeader('Accept-Ranges', 'bytes')
  const range = req.headers.range
  if (!range) {
    res.setHeader('Content-Length', stat.size)
    fs.createReadStream(absolutePath).pipe(res)
    return
  }
  const match = /bytes=(\d*)-(\d*)/.exec(range)
  const start = match?.[1] ? Number(match[1]) : 0
  const requestedEnd = match?.[2] ? Number(match[2]) : stat.size - 1
  const end = Math.min(requestedEnd, stat.size - 1)
  if (start > end || start >= stat.size) {
    res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end()
    return
  }
  res.status(206)
  res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
  res.setHeader('Content-Length', end - start + 1)
  fs.createReadStream(absolutePath, { start, end }).pipe(res)
})

export const editVoice = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError('INVALID_AUDIO_FILE', 'Aucun fichier audio reçu.', 400)
  if (req.file.size > MAX_VOICE_MESSAGE_BYTES) throw new AppError('FILE_TOO_LARGE', 'Message vocal trop volumineux.', 413)
  if (!req.file.mimetype.startsWith('audio/')) throw new AppError('INVALID_AUDIO_FILE', 'Format audio non supporté.', 400)

  const parsed = sendVoiceMessageSchema.pick({ durationSec: true }).safeParse(req.body)
  if (!parsed.success) throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Données invalides.')

  const { relativePath } = saveVoiceMessageFile(req.file.buffer, req.file.mimetype)
  try {
    const { message, previousFileUrl } = await editVoiceMessage(req.userId!, req.params.messageId, relativePath, req.file.mimetype, parsed.data.durationSec)
    notifyUser(message.receiverId, 'message:updated', message)
    if (previousFileUrl) deleteVoiceMessageFile(previousFileUrl)
    res.status(200).json({ message })
  } catch (err) {
    deleteVoiceMessageFile(relativePath)
    throw err
  }
})

// Thème 2 — appelé par le frontend dès que le destinataire démarre la
// lecture d'un vocal à écoute unique. Supprime le fichier du disque et
// notifie l'expéditeur pour que son UI reflète la consommation.
export const consumeVoice = asyncHandler(async (req: Request, res: Response) => {
  const result = await markVoiceConsumed(req.userId!, req.params.messageId)
  if (!result) {
    res.status(200).json({ consumed: false })
    return
  }
  if (result.previousFileUrl) deleteVoiceMessageFile(result.previousFileUrl)
  notifyUser(result.message.senderId, 'message:updated', result.message)
  res.status(200).json({ consumed: true, message: result.message })
})
