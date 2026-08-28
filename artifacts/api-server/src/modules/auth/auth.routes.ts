import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../../middleware/requireAuth'
import { authRateLimit } from '../../middleware/authRateLimit'
import { login, logout, me, register, remove, updateProfileController } from './auth.controller'
import { uploadAvatar, avatarFile, MAX_AVATAR_BYTES } from './auth.avatar'

export const authRouter = Router()

authRouter.post('/register', authRateLimit, register)
authRouter.post('/login', authRateLimit, login)
authRouter.post('/logout', logout)
authRouter.get('/me', requireAuth, me)
authRouter.put('/profile', requireAuth, updateProfileController)

const avatarUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_AVATAR_BYTES } })
authRouter.post('/avatar', requireAuth, avatarUpload.single('avatar'), uploadAvatar)
authRouter.get('/avatar/:filename', avatarFile)

// Phase 11, section 13 : suppression de compte et de ses donnees.
authRouter.delete('/me', requireAuth, remove)
