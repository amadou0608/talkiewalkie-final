import type { NextFunction, Request, Response } from 'express'
import { MulterError } from 'multer'
import { AppError } from '../utils/AppError'

// Doit rester le dernier middleware monte dans index.ts (4 arguments =
// Express le reconnait comme gestionnaire d'erreurs).
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ code: err.code, message: err.message })
    return
  }

  // Upload de vocal invalide (Phase 8, section 13 : "limitation des fichiers
  // audio") — ex. fichier trop volumineux (LIMIT_FILE_SIZE). Traite a part
  // car multer leve ses propres erreurs, pas des AppError.
  if (err instanceof MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    res.status(status).json({ code: 'INVALID_AUDIO_FILE', message: 'Fichier audio invalide ou trop volumineux.' })
    return
  }

  // Erreur inattendue : on ne renvoie jamais le detail brut au client
  // (section 13 : logs sans donnees sensibles inutiles, mais aussi pas de
  // fuite d'implementation vers l'exterieur).
  console.error('[error]', err)
  res.status(500).json({ code: 'UNKNOWN', message: 'Une erreur interne est survenue.' })
}
