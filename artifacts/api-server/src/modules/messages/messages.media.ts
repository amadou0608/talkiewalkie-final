import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import { AppError } from '../../utils/AppError'
import { asyncHandler } from '../../utils/asyncHandler'
import { hasActiveSocket, notifyUser } from '../../realtime/socket'
import { sendPushToUser } from '../push/push.service'
import { createChatMediaMessage, getChatMessageFile } from './messages.service'

export const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const UPLOADS_ROOT = path.join(__dirname, '..', '..', '..', 'uploads', 'images')
fs.mkdirSync(UPLOADS_ROOT, { recursive: true })

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
}

function saveImage(buffer: Buffer, mimeType: string) {
  const filename = `${randomUUID()}.${EXTENSIONS[mimeType] ?? 'bin'}`
  fs.writeFileSync(path.join(UPLOADS_ROOT, filename), buffer)
  return filename
}

function imagePath(relativePath: string) {
  return path.join(UPLOADS_ROOT, path.basename(relativePath))
}

export const createImage = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError('INVALID_IMAGE_FILE', 'Aucune image reçue.', 400)
  if (req.file.size > MAX_IMAGE_BYTES) throw new AppError('FILE_TOO_LARGE', 'Image trop volumineuse.', 413)
  if (!EXTENSIONS[req.file.mimetype]) throw new AppError('INVALID_IMAGE_FILE', 'Format image non supporté. Utilisez JPG, PNG, WebP ou GIF.', 400)
  const receiverId = typeof req.body.receiverUserId === 'string' ? req.body.receiverUserId : ''
  if (!receiverId) throw new AppError('VALIDATION_ERROR', 'Destinataire invalide.', 400)

  const relativePath = saveImage(req.file.buffer, req.file.mimetype)
  try {
    const delivered = hasActiveSocket(receiverId)
    const message = await createChatMediaMessage(req.userId!, receiverId, 'image', relativePath, req.file.mimetype, delivered)
    notifyUser(receiverId, 'message:new', message)
    if (delivered) notifyUser(req.userId!, 'message:status', { messageId: message.id, status: 'delivered' })
    if (!delivered) {
      sendPushToUser(receiverId, { title: 'Nouvelle photo', body: `${message.sender.displayName} vous a envoyé une photo.`, url: '/messages', tag: 'message-image' })
        .catch((err) => console.error('[push] échec notification photo', err))
    }
    res.status(201).json({ message })
  } catch (err) {
    try { fs.unlinkSync(imagePath(relativePath)) } catch { /* already absent */ }
    throw err
  }
})

export const imageFile = asyncHandler(async (req: Request, res: Response) => {
  const message = await getChatMessageFile(req.params.messageId, req.userId!, 'image')
  const absolutePath = imagePath(message.fileUrl)
  let stat: fs.Stats
  try { stat = fs.statSync(absolutePath) } catch { throw new AppError('FILE_NOT_FOUND', 'Image introuvable.', 404) }
  res.setHeader('Content-Type', message.mimeType)
  res.setHeader('Content-Length', stat.size)
  res.setHeader('Cache-Control', 'private, max-age=3600')
  fs.createReadStream(absolutePath).pipe(res)
})
