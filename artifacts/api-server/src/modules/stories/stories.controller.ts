import type { Request, Response } from 'express'
import { asyncHandler } from '../../utils/asyncHandler'
import { AppError } from '../../utils/AppError'
import { saveStoryImage } from './stories.storage'
import {
  createStory,
  listMyStories,
  listContactsStories,
  markStoryViewed,
  deleteStory,
} from './stories.service'
import type { Story } from './stories.types'

function toStory(row: {
  id: string
  user_id: string
  image_url: string
  created_at: Date
  expires_at: Date
}): Story {
  return {
    id: row.id,
    userId: row.user_id,
    imageUrl: row.image_url,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
    viewed: false,
  }
}

export const uploadStory = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new AppError('INVALID_IMAGE_FILE', 'Aucune image recue.', 400)
  const imageUrl = saveStoryImage(req.file)
  const story = await createStory(req.userId!, imageUrl)
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

export const removeStory = asyncHandler(async (req: Request, res: Response) => {
  await deleteStory(req.userId!, req.params.storyId)
  res.status(204).send()
})
