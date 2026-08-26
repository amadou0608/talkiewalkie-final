import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../utils/AppError'
import { verifySession } from '../utils/jwt'

const SESSION_COOKIE = 'talkie_session'

// Utilise par /auth/me des la Phase 3, et par toutes les routes protegees
// des phases suivantes (contacts, messages vocaux...).
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE]
  const payload = token ? verifySession(token) : null

  if (!payload) {
    next(new AppError('UNAUTHENTICATED', 'Session invalide ou expiree.', 401))
    return
  }

  req.userId = payload.userId
  next()
}

export { SESSION_COOKIE }
