// Service Web Push — Phase 9 (section 11 du cahier des charges).
// Meme pattern que lib/contactsApi.ts : cookie de session httpOnly, donc
// `credentials: 'include'` sur chaque appel.
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

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new AuthApiError({
      code: body?.code ?? 'UNKNOWN',
      message: body?.message ?? 'Une erreur est survenue.',
    })
  }

  return body as T
}

export async function apiGetPushPublicKey(): Promise<{ enabled: boolean; publicKey: string | null }> {
  return request('/push/public-key')
}

export async function apiSubscribePush(subscription: PushSubscriptionJSON, platform: string): Promise<void> {
  await request('/push/subscribe', {
    method: 'POST',
    body: JSON.stringify({ ...subscription, platform }),
  })
}

export async function apiUnsubscribePush(endpoint: string): Promise<void> {
  await request('/push/unsubscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint }),
  })
}
