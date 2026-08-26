import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../utils/AppError'

// Limiteur volontairement minimal (en memoire, par IP) : une vraie
// protection anti brute-force (avec store partage, backoff progressif...)
// est prevue section 13 / Phase 11. Ici, on evite juste qu'un script puisse
// marteler /auth/login sans aucune limite d'ici la.
const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 20

const hits = new Map<string, { count: number; windowStart: number }>()

export function authRateLimit(req: Request, _res: Response, next: NextFunction) {
  const key = req.ip ?? 'unknown'
  const now = Date.now()
  const entry = hits.get(key)

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(key, { count: 1, windowStart: now })
    next()
    return
  }

  entry.count += 1
  if (entry.count > MAX_ATTEMPTS) {
    next(new AppError('VALIDATION_ERROR', 'Trop de tentatives. Reessayez dans une minute.', 429))
    return
  }

  next()
}
