import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { AppError } from '../../utils/AppError'
import { saveStoryImage, saveStoryVideo } from './stories.storage'
import {
  createStory,
  listMyStories,
  listContactsStories,
  markStoryViewed,
  getStoryViewers,
  deleteStory,
} from './stories.service'
import type { Story, StoryRow, StoryVisibilityMode, StoryType } from './stories.types'

function toStory(row: StoryRow): Story {
  return {
    id: row.id,
    userId: row.user_id,
    imageUrl: row.image_url,
    type: row.type,
    textContent: row.text_content,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    viewed: false,
    visibilityMode: row.visibility_mode,
  }
}

export const uploadStory = asyncHandler(async (req: Request, res: Response) => {
  const type: StoryType = (req.body.type as StoryType) || (req.file ? 'image' : 'text')
  if (!['image', 'video', 'text'].includes(type)) {
    throw new AppError('INVALID_STORY_TYPE', 'Type de story invalide.', 400)
  }

  const visibilityMode: StoryVisibilityMode = (req.body.visibilityMode as StoryVisibilityMode) || 'all'
  if (!['all', 'except', 'only'].includes(visibilityMode)) {
    throw new AppError('INVALID_VISIBILITY_MODE', 'Mode de confidentialite invalide.', 400)
  }

  let targetUserIds: string[] = []
  if (visibilityMode !== 'all') {
    const raw = req.body.targetUserIds
    if (typeof raw === 'string' && raw.length > 0) {
      targetUserIds = JSON.parse(raw)
    } else if (Array.isArray(raw)) {
      targetUserIds = raw
    }
  }

  let imageUrl: string | null = null
  let textContent: string | null = null

  if (type === 'text') {
    textContent = typeof req.body.textContent === 'string' ? req.body.textContent.trim() : ''
    if (!textContent) throw new AppError('INVALID_TEXT_CONTENT', 'Le texte du statut est vide.', 400)
  } else if (type === 'image') {
    if (!req.file) throw new AppError('INVALID_IMAGE_FILE', 'Aucune image recue.', 400)
    imageUrl = saveStoryImage(req.file)
    textContent = typeof req.body.textContent === 'string' && req.body.textContent.trim() ? req.body.textContent.trim() : null
  } else if (type === 'video') {
    if (!req.file) throw new AppError('INVALID_VIDEO_FILE', 'Aucune video recue.', 400)
    imageUrl = saveStoryVideo(req.file)
    textContent = typeof req.body.textContent === 'string' && req.body.textContent.trim() ? req.body.textContent.trim() : null
  }

  const story = await createStory(req.userId!, type, imageUrl, textContent, visibilityMode, targetUserIds)
  res.status(201).json({ story: toStory(story) })
})

export const getMyStories = asyncHandler(async (req: Request, res: Response) => {
  const stories = await listMyStories(req.userId!)
  res.status(200).json({ stories: stories.map(toStory) })
})

export const getContactsStories = asyncHandler(async (req: Request, res: Response) => {
  const groups = await listContactsStories(req.userId!)
  res.status(200).json({ groups })
})

export const viewStory = asyncHandler(async (req: Request, res: Response) => {
  await markStoryViewed(req.params.storyId, req.userId!)
  res.status(204).send()
})

export const getViewers = asyncHandler(async (req: Request, res: Response) => {
  const viewers = await getStoryViewers(req.params.storyId, req.userId!)
  res.status(200).json({ viewers })
})

export const removeStory = asyncHandler(async (req: Request, res: Response) => {
  await deleteStory(req.userId!, req.params.storyId)
  res.status(204).send()
})
