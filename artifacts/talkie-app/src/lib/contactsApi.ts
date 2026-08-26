// Service contacts — Phase 4.
// Remplace les donnees fictives de data/mockData.ts (contacts) par de vrais
// appels au backend (/backend/src/modules/contacts). Meme pattern que
// lib/authApi.ts : cookie de session httpOnly, donc `credentials: 'include'`
// sur chaque appel.
import type { Contact, ContactRelation, User } from '@/types'
import { AuthApiError } from '@/lib/authApi'

const API_URL = import.meta.env.VITE_API_URL || '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'talkie-web' },
      ...options,
    })
  } catch {
    throw new AuthApiError({ code: 'NETWORK_ERROR', message: 'Serveur injoignable. Verifiez votre connexion.' })
  }

  if (response.status === 204) {
    return undefined as T
  }

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new AuthApiError({
      code: body?.code ?? 'UNKNOWN',
      message: body?.message ?? 'Une erreur est survenue.',
    })
  }

  return body as T
}

interface ApiContact {
  user: User
  relation: ContactRelation
}

export async function apiListContacts(): Promise<{ accepted: Contact[]; pending: Contact[] }> {
  const { accepted, pending } = await request<{ accepted: ApiContact[]; pending: ApiContact[] }>('/contacts')
  return { accepted, pending }
}

export async function apiListBlocked(): Promise<Contact[]> {
  const { blocked } = await request<{ blocked: ApiContact[] }>('/contacts/blocked')
  return blocked
}

// Renvoie l'utilisateur trouve, ou null si aucun utilisateur ne correspond
// (au lieu de laisser remonter l'erreur USER_NOT_FOUND — c'est un resultat
// de recherche normal, pas une erreur reseau/serveur).
export async function apiSearchUser(query: string): Promise<User | null> {
  try {
    const { user } = await request<{ user: User }>(`/contacts/search?q=${encodeURIComponent(query)}`)
    return user
  } catch (err) {
    if (err instanceof AuthApiError && err.code === 'USER_NOT_FOUND') return null
    throw err
  }
}

export async function apiAddContact(username: string): Promise<Contact> {
  const { contact } = await request<{ contact: ApiContact }>('/contacts', {
    method: 'POST',
    body: JSON.stringify({ username }),
  })
  return contact
}

export async function apiRemoveContact(contactUserId: string): Promise<void> {
  await request<void>(`/contacts/${contactUserId}`, { method: 'DELETE' })
}

export async function apiBlockContact(contactUserId: string): Promise<void> {
  await request<void>(`/contacts/${contactUserId}/block`, { method: 'POST' })
}

export async function apiUnblockContact(contactUserId: string): Promise<void> {
  await request<void>(`/contacts/${contactUserId}/unblock`, { method: 'POST' })
}
