import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import { AppError } from '../../utils/AppError'
import { asyncHandler } from '../../utils/asyncHandler'

export const MAX_STORY_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_STORY_VIDEO_BYTES = 60 * 1024 * 1024

const STORIES_ROOT = path.join(__dirname, '..', '..', '..', 'uploads', 'stories')
fs.mkdirSync(STORIES_ROOT, { recursive: true })

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const VIDEO_EXTENSIONS: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
}

export function saveStoryImage(file: Express.Multer.File): string {
  if (file.size > MAX_STORY_IMAGE_BYTES) {
    throw new AppError('FILE_TOO_LARGE', 'Image trop volumineuse.', 413)
  }
  if (!IMAGE_EXTENSIONS[file.mimetype]) {
    throw new AppError('INVALID_IMAGE_FILE', 'Format non supporte. Utilisez JPG, PNG ou WebP.', 400)
  }
  const filename = `${randomUUID()}.${IMAGE_EXTENSIONS[file.mimetype]}`
  fs.writeFileSync(path.join(STORIES_ROOT, filename), file.buffer)
  return `/api/stories/media/${filename}`
}

export function saveStoryVideo(file: Express.Multer.File): string {
  if (file.size > MAX_STORY_VIDEO_BYTES) {
    throw new AppError('FILE_TOO_LARGE', 'Video trop volumineuse.', 413)
  }
  if (!VIDEO_EXTENSIONS[file.mimetype]) {
    throw new AppError('INVALID_VIDEO_FILE', 'Format non supporte. Utilisez MP4, WebM ou MOV.', 400)
  }
  const filename = `${randomUUID()}.${VIDEO_EXTENSIONS[file.mimetype]}`
  fs.writeFileSync(path.join(STORIES_ROOT, filename), file.buffer)
  return `/api/stories/media/${filename}`
}

export const storyFile = asyncHandler(async (req: Request, res: Response) => {
  const filename = path.basename(req.params.filename)
  const absolutePath = path.join(STORIES_ROOT, filename)
  let stat: fs.Stats
  try {
    stat = fs.statSync(absolutePath)
  } catch {
    throw new AppError('FILE_NOT_FOUND', 'Media introuvable.', 404)
  }
  res.setHeader('Content-Length', stat.size)
  res.setHeader('Cache-Control', 'public, max-age=3600')
  fs.createReadStream(absolutePath).pipe(res)
})
