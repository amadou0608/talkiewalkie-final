import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import { AppError } from '../../utils/AppError'
import { asyncHandler } from '../../utils/asyncHandler'
import { pool } from '../../db/pool'
import { toPublicUser } from '../users/user.mapper'
import type { UserRow } from '../users/user.types'

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024

const UPLOADS_ROOT = path.join(__dirname, '..', '..', '..', 'uploads', 'avatars')
fs.mkdirSync(UPLOADS_ROOT, { recursive: true })

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const uploadAvatar = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError('INVALID_IMAGE_FILE', 'Aucune image recue.', 400)
  if (req.file.size > MAX_AVATAR_BYTES) {
    throw new AppError('FILE_TOO_LARGE', 'Image trop volumineuse.', 413)
  }
  if (!EXTENSIONS[req.file.mimetype]) {
    throw new AppError('INVALID_IMAGE_FILE', 'Format non supporte. Utilisez JPG, PNG ou WebP.', 400)
  }

  const userId = req.userId!
  const filename = `${randomUUID()}.${EXTENSIONS[req.file.mimetype]}`
  fs.writeFileSync(path.join(UPLOADS_ROOT, filename), req.file.buffer)

  const avatarUrl = `/api/auth/avatar/${filename}`
  const result = await pool.query<UserRow>(
    'UPDATE users SET avatar_url = $2 WHERE id = $1 RETURNING *',
    [userId, avatarUrl]
  )
  res.status(200).json({ user: toPublicUser(result.rows[0]) })
})

export const avatarFile = asyncHandler(async (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename)
  const absolutePath = path.join(UPLOADS_ROOT, filename)
  let stat: fs.Stats
  try {
    stat = fs.statSync(absolutePath)
  } catch {
    throw new AppError('FILE_NOT_FOUND', 'Image introuvable.', 404)
  }
  res.setHeader('Content-Length', stat.size)
  res.setHeader('Cache-Control', 'public, max-age=3600')
  fs.createReadStream(absolutePath).pipe(res)
})
