import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../../middleware/requireAuth'
import { createText, delivered, list, read, readConversation, summaries, edit, remove } from './messages.controller'
import { createVoice, voiceFile } from './messages.voice'
import { createImage, imageFile, MAX_IMAGE_BYTES } from './messages.media'
import { createVideo, videoFile, MAX_VIDEO_BYTES } from './messages.video'
import { MAX_VOICE_MESSAGE_BYTES } from '../voice-messages/voice-messages.schemas'

export const messagesRouter = Router()
messagesRouter.use(requireAuth)
messagesRouter.get('/', list)
messagesRouter.get('/summary', summaries)
messagesRouter.post('/', createText)
messagesRouter.post('/:messageId/delivered', delivered)
messagesRouter.post('/:messageId/read', read)
messagesRouter.post('/read-conversation', readConversation)
messagesRouter.patch('/:messageId', edit)
messagesRouter.delete('/:messageId', remove)

const voiceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_VOICE_MESSAGE_BYTES } })
messagesRouter.post('/voice', voiceUpload.single('audio'), createVoice)
messagesRouter.get('/:messageId/voice', voiceFile)

const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGE_BYTES } })
messagesRouter.post('/image', imageUpload.single('image'), createImage)
messagesRouter.get('/:messageId/image', imageFile)

const videoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_VIDEO_BYTES } })
messagesRouter.post('/video', videoUpload.single('video'), createVideo)
messagesRouter.get('/:messageId/video', videoFile)
