// Service d'authentification — Phase 3.
//
// Remplace le mock localStorage de la Phase 2 par de vrais appels au backend
// (/backend, voir section 3-4 du cahier des charges). La signature de chaque
// fonction exportee est inchangee depuis la Phase 2 : AuthContext et les
// pages Login/Register n'ont pas eu a bouger.
//
// Le serveur pose un cookie de session httpOnly (voir backend/src/modules/
// auth/auth.controller.ts) ; `credentials: 'include'` est donc indispensable
// sur chaque appel pour que le navigateur l'envoie/le recoive.
import type { PresenceStatus, User } from '@/types'

const API_URL = import.meta.env.VITE_API_URL || '/api'

// L'URL renvoyee par le backend pour l'avatar est relative (/api/auth/avatar/xxx).
// On la complete avec l'origine du serveur pour obtenir une URL chargeable
// par le navigateur (frontend et backend sont sur des domaines differents).
export function resolveAvatarUrl(avatarUrl?: string): string | undefined {
  if (!avatarUrl) return undefined
  if (avatarUrl.startsWith('http')) return avatarUrl
  const origin = API_URL.replace(/\/api\/?$/, '')
  return `${origin}${avatarUrl}`
}

export interface AuthError {
  code: string
  message: string
}

export class AuthApiError extends Error {
  code: string
  constructor(err: AuthError) {
    super(err.message)
    this.code = err.code
  }
}

interface ApiUser {
  id: string
  username: string
  displayName: string
  avatarColor: string
  avatarUrl?: string
  bio: string
  phoneNumber?: string
  status: PresenceStatus
  lastSeen: string
}

const USERNAME_RE = /^[a-z0-9_]{3,24}$/
const PASSWORD_MIN_LEN = 8

// Validation cote client, pour un retour immediat avant meme d'appeler le
// serveur. Le serveur revalide toujours de son cote (auth.schemas.ts) — on
// ne fait jamais confiance uniquement au frontend.
export function validateUsername(username: string): AuthError | null {
  const clean = username.trim().replace(/^@/, '').toLowerCase()
  if (!USERNAME_RE.test(clean)) {
    return {
      code: 'INVALID_USERNAME',
      message: '3 a 24 caracteres : lettres minuscules, chiffres, underscore uniquement.',
    }
  }
  return null
}

export function validatePassword(password: string): AuthError | null {
  if (password.length < PASSWORD_MIN_LEN) {
    return { code: 'WEAK_PASSWORD', message: `${PASSWORD_MIN_LEN} caracteres minimum.` }
  }
  return null
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      // X-Requested-With : requis par le backend (Phase 11, voir
      // backend/src/middleware/csrfProtection.ts) pour toute requete qui
      // modifie un etat — une simple <form> HTML tierce ne peut pas poser
      // cet en-tete, ce qui bloque une soumission CSRF.
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'talkie-web' },
      ...options,
    })
  } catch {
    throw new AuthApiError({ code: 'NETWORK_ERROR', message: 'Serveur injoignable. Vérifiez votre connexion.' })
  }

  if (response.status === 204) {
    return undefined as T
  }

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new AuthApiError({
  code: body?.code ?? 'UNKNOWN',
  message: body?.message ?? `Erreur ${response.status}: ${JSON.stringify(body)}`,
});
  }

  return body as T
}

export interface RegisterPayload {
  displayName: string
  username: string
  password: string
}

export async function apiRegister(payload: RegisterPayload): Promise<User> {
  const { user } = await request<{ user: ApiUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return user
}

export async function apiLogin(username: string, password: string): Promise<User> {
  const { user } = await request<{ user: ApiUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  return user
}

export async function apiLogout(): Promise<void> {
  await request<void>('/auth/logout', { method: 'POST' })
}

// Suppression de compte — Phase 11 (section 13 du cahier des charges).
export async function apiDeleteAccount(): Promise<void> {
  await request<void>('/auth/me', { method: 'DELETE' })
}

export interface UpdateProfilePayload {
  displayName?: string
  bio?: string
}

export async function apiUpdateProfile(payload: UpdateProfilePayload): Promise<User> {
  const { user } = await request<{ user: ApiUser }>('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return user
}

export async function apiUploadAvatar(file: File): Promise<User> {
  const formData = new FormData()
  formData.append('avatar', file)
  const { user } = await request<{ user: ApiUser }>('/auth/avatar', {
    method: 'POST',
    headers: { 'X-Requested-With': 'talkie-web' },
    body: formData,
  })
  return user
}

// Restaure la session au chargement de l'app via le cookie httpOnly. Une
// reponse 401 est un cas normal (pas de session) : on renvoie null plutot
// que de faire remonter une erreur.
export async function apiGetSession(): Promise<User | null> {
  try {
    const { user } = await request<{ user: ApiUser }>('/auth/me', { method: 'GET' })
    return user
  } catch (err) {
    if (err instanceof AuthApiError && err.code === 'UNAUTHENTICATED') return null
    return null
  }
    }
