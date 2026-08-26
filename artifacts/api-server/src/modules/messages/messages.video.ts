import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import { AppError } from '../../utils/AppError'
import { asyncHandler } from '../../utils/asyncHandler'
import { hasActiveSocket, notifyUser } from '../../realtime/socket'
import { sendPushToUser } from '../push/push.service'
import { createChatMediaMessage, getChatMessageFile } from './messages.service'

export const MAX_VIDEO_BYTES = 60 * 1024 * 1024
export const MAX_VIDEO_DURATION_SEC = 5 * 60

const UPLOADS_ROOT = path.join(__dirname, '..', '..', '..', 'uploads', 'videos')
fs.mkdirSync(UPLOADS_ROOT, { recursive: true })

const EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/ogg': 'ogv',
  'video/x-matroska': 'mkv',
}

function saveVideo(buffer: Buffer, mimeType: string) {
  const filename = `${randomUUID()}.${EXTENSIONS[mimeType] ?? 'bin'}`
  fs.writeFileSync(path.join(UPLOADS_ROOT, filename), buffer)
  return filename
}

function videoPath(relativePath: string) {
  return path.join(UPLOADS_ROOT, path.basename(relativePath))
}

export const createVideo = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError('INVALID_VIDEO_FILE', 'Aucune vidéo reçue.', 400)
  if (req.file.size > MAX_VIDEO_BYTES) throw new AppError('FILE_TOO_LARGE', 'Vidéo trop volumineuse. Limite : 60 Mo.', 413)
  if (!EXTENSIONS[req.file.mimetype]) throw new AppError('INVALID_VIDEO_FILE', 'Format vidéo non supporté. Utilisez MP4, WebM, MOV ou OGV.', 400)

  const receiverId = typeof req.body.receiverUserId === 'string' ? req.body.receiverUserId : ''
  const rawDuration = Number(req.body.durationSec)
  if (!receiverId) throw new AppError('VALIDATION_ERROR', 'Destinataire invalide.', 400)
  if (!Number.isFinite(rawDuration) || rawDuration <= 0 || rawDuration > MAX_VIDEO_DURATION_SEC) {
    throw new AppError('VIDEO_TOO_LONG', 'La vidéo doit durer au maximum 5 minutes.', 400)
  }

  const durationSec = Math.ceil(rawDuration)
  const relativePath = saveVideo(req.file.buffer, req.file.mimetype)
  try {
    const delivered = hasActiveSocket(receiverId)
    const message = await createChatMediaMessage(
      req.userId!, receiverId, 'video', relativePath, req.file.mimetype, delivered, durationSec,
    )
    notifyUser(receiverId, 'message:new', message)
    if (delivered) notifyUser(req.userId!, 'message:status', { messageId: message.id, status: 'delivered' })
    if (!delivered) {
      sendPushToUser(receiverId, {
        title: 'Nouvelle vidéo',
        body: `${message.sender.displayName} vous a envoyé une vidéo.`,
        url: '/messages',
        tag: 'message-video',
      }).catch((err) => console.error('[push] échec notification vidéo', err))
    }
    res.status(201).json({ message })
  } catch (err) {
    try { fs.unlinkSync(videoPath(relativePath)) } catch { /* déjà absent */ }
    throw err
  }
})

export const videoFile = asyncHandler(async (req: Request, res: Response) => {
  const message = await getChatMessageFile(req.params.messageId, req.userId!, 'video')
  const absolutePath = videoPath(message.fileUrl)
  let stat: fs.Stats
  try { stat = fs.statSync(absolutePath) } catch { throw new AppError('FILE_NOT_FOUND', 'Vidéo introuvable.', 404) }

  res.setHeader('Content-Type', message.mimeType)
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Cache-Control', 'private, max-age=3600')
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
  if (!Number.isInteger(start) || !Number.isInteger(end) || start > end || start >= stat.size) {
    res.status(416).setHeader('Content-Range', `bytes */${stat.size}`).end()
    return
  }

  res.status(206)
  res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`)
  res.setHeader('Content-Length', end - start + 1)
  fs.createReadStream(absolutePath, { start, end }).pipe(res)
})
