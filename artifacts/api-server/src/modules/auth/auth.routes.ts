import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth'
import { authRateLimit } from '../../middleware/authRateLimit'
import { login, logout, me, register, remove } from './auth.controller'

export const authRouter = Router()

authRouter.post('/register', authRateLimit, register)
authRouter.post('/login', authRateLimit, login)
authRouter.post('/logout', logout)
authRouter.get('/me', requireAuth, me)
// Phase 11, section 13 : suppression de compte et de ses donnees.
authRouter.delete('/me', requireAuth, remove)
