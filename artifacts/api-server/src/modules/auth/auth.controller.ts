import type { CookieOptions, Request, Response } from 'express'
import { env } from '../../env'
import { AppError } from '../../utils/AppError'
import { asyncHandler } from '../../utils/asyncHandler'
import { signSession, verifySession } from '../../utils/jwt'
import { SESSION_COOKIE } from '../../middleware/requireAuth'
import { disconnectUserSockets, forceOffline } from '../../realtime/socket'
import { deleteAccount, findById, loginUser, registerUser } from './auth.service'
import { loginSchema, registerSchema } from './auth.schemas'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// httpOnly : le JS du navigateur ne peut pas lire le cookie (protection XSS
// basique sur le token) ; sameSite=lax limite les envois cross-site (CSRF) ;
// secure en production uniquement (HTTPS obligatoire, section 13).
const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProduction,
  maxAge: SEVEN_DAYS_MS,
  path: '/',
}

function setSessionCookie(res: Response, userId: string) {
  const token = signSession({ userId })
  res.cookie(SESSION_COOKIE, token, cookieOptions)
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Donnees invalides.')
  }

  const user = await registerUser(parsed.data)
  setSessionCookie(res, user.id)
  res.status(201).json({ user })
})

export const login = asyncHandler(async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError('VALIDATION_ERROR', 'Identifiant et mot de passe requis.')
  }

  const user = await loginUser(parsed.data)
  setSessionCookie(res, user.id)
  res.status(200).json({ user })
})

export const logout = asyncHandler(async (req: Request, res: Response) => {
  // Volontairement tolerant : meme si le cookie est absent/expire, on
  // repond succes (l'objectif — ne plus avoir de session — est deja atteint).
  const token = req.cookies?.[SESSION_COOKIE]
  const payload = token ? verifySession(token) : null
  if (payload) {
    // Deconnexion explicite : passage hors ligne immediat plutot que le
    // delai de grace habituel (voir realtime/socket.ts), et fermeture des
    // sockets WebSocket ouverts pour cette session.
    disconnectUserSockets(payload.userId)
    await forceOffline(payload.userId)
  }
  res.clearCookie(SESSION_COOKIE, { path: '/' })
  res.status(204).end()
})

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = req.userId ? await findById(req.userId) : null
  if (!user) {
    throw new AppError('UNAUTHENTICATED', 'Session invalide ou expiree.', 401)
  }
  res.status(200).json({ user })
})

// Suppression de compte — Phase 11, section 13. Meme traitement qu'un
// logout (sockets fermes, hors ligne notifie) avant l'effacement effectif,
// pour que les contacts en ligne voient la deconnexion plutot qu'un statut
// fige a "en ligne" pour un compte qui n'existe plus.
export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.userId!
  disconnectUserSockets(userId)
  await deleteAccount(userId)
  res.clearCookie(SESSION_COOKIE, { path: '/' })
  res.status(204).end()
})
