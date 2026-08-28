import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../../middleware/requireAuth'
import { MAX_STORY_IMAGE_BYTES, storyFile } from './stories.storage'
import {
  uploadStory,
  getMyStories,
  getContactsStories,
  viewStory,
  getViewers,
  removeStory,
} from './stories.controller'

export const storiesRouter = Router()

const storyUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_STORY_IMAGE_BYTES } })

storiesRouter.post('/', requireAuth, storyUpload.single('image'), uploadStory)
storiesRouter.get('/mine', requireAuth, getMyStories)
storiesRouter.get('/', requireAuth, getContactsStories)
storiesRouter.get('/media/:filename', storyFile)
storiesRouter.post('/:storyId/view', requireAuth, viewStory)
storiesRouter.get('/:storyId/viewers', requireAuth, getViewers)
storiesRouter.delete('/:storyId', requireAuth, removeStory)
