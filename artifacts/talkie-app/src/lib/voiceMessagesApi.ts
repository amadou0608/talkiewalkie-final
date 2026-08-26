// Service messages vocaux hors ligne — Phase 8 (section 10 du cahier des
// charges). Meme pattern que lib/contactsApi.ts (cookie de session httpOnly,
// donc `credentials: 'include'` sur chaque appel), sauf pour l'envoi qui
// utilise multipart/form-data (fichier audio) plutot que du JSON.
import type { VoiceMessage } from '@/types'
import { AuthApiError } from '@/lib/authApi'

const API_URL = import.meta.env.VITE_API_URL || '/api'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_URL}${path}`, {
      credentials: 'include',
      // Pas de Content-Type manuel ici (voir plus bas, l'upload reste en
      // multipart/form-data), mais X-Requested-With reste necessaire —
      // requis par le backend (Phase 11) pour toute requete qui modifie un
      // etat, POST /voice-messages y compris.
      headers: { 'X-Requested-With': 'talkie-web' },
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

export async function apiListVoiceMessages(): Promise<VoiceMessage[]> {
  const { messages } = await request<{ messages: VoiceMessage[] }>('/voice-messages')
  return messages
}

// `audio` est le Blob enregistre par useVoiceRecorder (MediaRecorder) —
// jamais de champ Content-Type manuel a poser : le navigateur genere la
// boundary multipart correcte lui-meme des qu'on passe un FormData au fetch.
export async function apiSendVoiceMessage(
  receiverUserId: string,
  audio: Blob,
  durationSec: number,
): Promise<VoiceMessage> {
  const form = new FormData()
  form.append('receiverUserId', receiverUserId)
  form.append('durationSec', String(Math.max(1, Math.round(durationSec))))
  form.append('audio', audio, `vocal.${audio.type.includes('ogg') ? 'ogg' : 'webm'}`)

  const { message } = await request<{ message: VoiceMessage }>('/voice-messages', {
    method: 'POST',
    body: form,
  })
  return message
}

export async function apiMarkVoiceMessageListened(id: string): Promise<void> {
  await request<void>(`/voice-messages/${id}/listened`, { method: 'POST' })
}

// Construit l'URL de streaming authentifie d'un vocal. A utiliser avec
// crossOrigin="use-credentials" sur l'element <audio> (voir Messages.tsx) —
// sans ça le navigateur n'envoie pas le cookie de session cross-origin et le
// serveur repond 401 (la route n'est jamais servie en statique, voir
// backend/src/modules/voice-messages/storage.ts).
export function voiceMessageAudioUrl(id: string): string {
  return `${API_URL}/voice-messages/${id}/audio`
}
