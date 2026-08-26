// Protection CSRF — Phase 11 (section 13 : "protection CSRF lorsque
// necessaire").
//
// Le cookie de session est deja `sameSite: 'lax'` (voir auth.controller.ts),
// ce qui bloque l'envoi du cookie sur la plupart des requetes cross-site
// "simples". Et les endpoints en JSON forcent deja un `Content-Type:
// application/json`, que seule une requete JS peut poser (une balise <form>
// HTML ne le peut pas) — ce qui protege deja ces routes-la.
//
// La faille restante : POST /voice-messages utilise multipart/form-data
// (obligatoire pour l'upload audio, voir voice-messages.routes.ts), un type
// de contenu qu'une <form> HTML classique PEUT emettre depuis un site tiers.
// Plutot que de traiter cette route a part, on applique la meme regle a
// toutes les requetes qui modifient un etat : elles doivent porter un
// en-tete personnalise (X-Requested-With) que seul du code JavaScript peut
// ajouter a une requete fetch/XHR — une soumission de <form> ordinaire ne le
// peut pas, quel que soit son Content-Type.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const HEADER_NAME = 'x-requested-with'

import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../utils/AppError'

export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) {
    next()
    return
  }

  if (!req.headers[HEADER_NAME]) {
    next(new AppError('CSRF_REJECTED', 'Requete refusee (en-tete manquant).', 403))
    return
  }

  next()
}
