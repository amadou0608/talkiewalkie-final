import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { AppError } from '../../utils/AppError'
import { saveStoryImage } from './stories.storage'
import {
  createStory,
  listMyStories,
  listContactsStories,
  markStoryViewed,
  getStoryViewers,
  deleteStory,
} from './stories.service'
import type { Story, StoryVisibilityMode } from './stories.types'

function toStory(row: {
  id: string
  user_id: string
  image_url: string
  created_at: Date
  expires_at: Date
  visibility_mode: StoryVisibilityMode
}): Story {
  return {
    id: row.id,
    userId: row.user_id,
    imageUrl: row.image_url,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    viewed: false,
    visibilityMode: row.visibility_mode,
  }
}

export const uploadStory = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError('INVALID_IMAGE_FILE', 'Aucune image recue.', 400)

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

  const imageUrl = saveStoryImage(req.file)
  const story = await createStory(req.userId!, imageUrl, visibilityMode, targetUserIds)
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
