import type { ChatMessage, ChatMessageStatus, ChatMessageUser, MessageEditHistoryEntry } from '@/types'
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
    throw new AuthApiError({ code: 'NETWORK_ERROR', message: 'Serveur injoignable. Vérifiez votre connexion.' })
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new AuthApiError({ code: body?.code ?? 'UNKNOWN', message: body?.message ?? 'Une erreur est survenue.' })
  return body as T
}

export async function apiListMessages(userId: string): Promise<ChatMessage[]> {
  const { messages } = await request<{ messages: ChatMessage[] }>(`/messages?with=${encodeURIComponent(userId)}&limit=100`)
  return messages
}

// Theme 2 : disappearAfterSec (30/300/3600/86400/604800 secondes, ou null
// pour desactive) declenche la suppression programmee du message des que le
// destinataire le lit (voir apiMarkMessageRead / apiMarkConversationRead).
export async function apiSendTextMessage(receiverId: string, content: string, disappearAfterSec: number | null = null): Promise<ChatMessage> {
  const { message } = await request<{ message: ChatMessage }>('/messages', {
    method: 'POST', body: JSON.stringify({ receiverId, content, disappearAfterSec }),
  })
  return message
}

export async function apiMarkMessageDelivered(messageId: string): Promise<void> {
  await request(`/messages/${messageId}/delivered`, { method: 'POST' })
}

// Theme 2 : viewOnce (defaut false) marque le vocal comme "ecoute unique" —
// le fichier sera supprime du disque des que le destinataire le consomme
// (voir apiConsumeVoiceMessage / apiFetchVoiceBlob). disappearAfterSec est
// ignore cote serveur si viewOnce est actif (les deux mecanismes ne se
// cumulent pas).
export async function apiSendVoiceChatMessage(receiverId: string, audio: Blob, durationSec: number, viewOnce = false, disappearAfterSec: number | null = null): Promise<ChatMessage> {
  const form = new FormData()
  form.append('receiverUserId', receiverId)
  form.append('durationSec', String(Math.max(1, Math.round(durationSec))))
  form.append('viewOnce', String(viewOnce))
  if (disappearAfterSec !== null) form.append('disappearAfterSec', String(disappearAfterSec))
  form.append('audio', audio, `vocal.${audio.type.includes('ogg') ? 'ogg' : 'webm'}`)

  let response: Response
  try {
    response = await fetch(`${API_URL}/messages/voice`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-Requested-With': 'talkie-web' },
      body: form,
    })
  } catch {
    throw new AuthApiError({ code: 'NETWORK_ERROR', message: 'Serveur injoignable. Vérifiez votre connexion.' })
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new AuthApiError({ code: body?.code ?? 'UNKNOWN', message: body?.message ?? 'Une erreur est survenue.' })
  return body.message as ChatMessage
}

export function chatVoiceUrl(messageId: string): string {
  return `${API_URL}/messages/${messageId}/voice`
}

// Theme 2 : telecharge l'audio en memoire (blob) avant de le jouer, plutot
// que de laisser un <audio> natif streamer depuis le serveur. Necessaire
// pour un vocal a ecoute unique : le fichier est supprime du disque des que
// apiConsumeVoiceMessage est appele, et un <audio> qui streame encore a ce
// moment-la verrait sa lecture coupee en cours de route.
export async function apiFetchVoiceBlob(messageId: string): Promise<Blob> {
  let response: Response
  try {
    response = await fetch(chatVoiceUrl(messageId), {
      credentials: 'include',
      headers: { 'X-Requested-With': 'talkie-web' },
    })
  } catch {
    throw new AuthApiError({ code: 'NETWORK_ERROR', message: 'Serveur injoignable. Vérifiez votre connexion.' })
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new AuthApiError({ code: body?.code ?? 'UNKNOWN', message: body?.message ?? 'Le vocal n\'a pas pu être chargé.' })
  }
  return response.blob()
}

// Theme 2 : a appeler une fois la lecture demarree (le fichier est deja
// telecharge en blob a ce stade, voir apiFetchVoiceBlob) — marque le vocal
// consomme cote serveur et declenche la suppression du fichier disque.
// Renvoie le message a jour (consumedAt rempli), ou null si deja consomme
// avant (rejeu impossible, appel idempotent).
export async function apiConsumeVoiceMessage(messageId: string): Promise<ChatMessage | null> {
  const body = await request<{ consumed: boolean; message?: ChatMessage }>(`/messages/${messageId}/voice/consume`, { method: 'POST' })
  return body.message ?? null
}

// Theme 2 : disappearAfterSec sur une photo — meme mecanisme que le texte.
export async function apiSendImageMessage(receiverId: string, image: Blob, filename = 'photo.jpg', disappearAfterSec: number | null = null): Promise<ChatMessage> {
  const form = new FormData()
  form.append('receiverUserId', receiverId)
  if (disappearAfterSec !== null) form.append('disappearAfterSec', String(disappearAfterSec))
  form.append('image', image, filename)
  let response: Response
  try {
    response = await fetch(`${API_URL}/messages/image`, {
      method: 'POST', credentials: 'include',
      headers: { 'X-Requested-With': 'talkie-web' }, body: form,
    })
  } catch {
    throw new AuthApiError({ code: 'NETWORK_ERROR', message: 'Serveur injoignable. Vérifiez votre connexion.' })
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new AuthApiError({ code: body?.code ?? 'UNKNOWN', message: body?.message ?? 'La photo n’a pas pu être envoyée.' })
  return body.message as ChatMessage
}

export function chatImageUrl(messageId: string): string {
  return `${API_URL}/messages/${messageId}/image`
}


// Theme 2 : disappearAfterSec sur une video — meme mecanisme que le texte.
export async function apiSendVideoMessage(receiverId: string, video: Blob, durationSec: number, filename = 'video.mp4', disappearAfterSec: number | null = null): Promise<ChatMessage> {
  const form = new FormData()
  form.append('receiverUserId', receiverId)
  form.append('durationSec', String(Math.ceil(durationSec)))
  if (disappearAfterSec !== null) form.append('disappearAfterSec', String(disappearAfterSec))
  form.append('video', video, filename)
  let response: Response
  try {
    response = await fetch(`${API_URL}/messages/video`, {
      method: 'POST', credentials: 'include',
      headers: { 'X-Requested-With': 'talkie-web' }, body: form,
    })
  } catch {
    throw new AuthApiError({ code: 'NETWORK_ERROR', message: 'Serveur injoignable. Vérifiez votre connexion.' })
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new AuthApiError({ code: body?.code ?? 'UNKNOWN', message: body?.message ?? 'La vidéo n’a pas pu être envoyée.' })
  return body.message as ChatMessage
}

export function chatVideoUrl(messageId: string): string {
  return `${API_URL}/messages/${messageId}/video`
}

export interface ConversationSummary {
  userId: string; messageId: string; type: ChatMessage['type']; content: string | null; createdAt: string;
  status: ChatMessageStatus; senderId: string; unreadCount: number; user: ChatMessageUser
}

export async function apiConversationSummaries(): Promise<ConversationSummary[]> {
  const { conversations } = await request<{ conversations: ConversationSummary[] }>('/messages/summary')
  return conversations
}

export async function apiMarkConversationRead(userId: string): Promise<void> {
  await request(`/messages/read-conversation?with=${encodeURIComponent(userId)}`, { method: 'POST' })
}

export async function apiMarkMessageRead(messageId: string): Promise<void> {
  await request(`/messages/${messageId}/read`, { method: 'POST' })
}

export async function apiEditTextMessage(messageId: string, content: string): Promise<ChatMessage> {
  const { message } = await request<{ message: ChatMessage }>(`/messages/${messageId}`, { method: 'PATCH', body: JSON.stringify({ content }) })
  return message
}
export async function apiGetEditHistory(messageId: string): Promise<MessageEditHistoryEntry[]> {
  const { history } = await request<{ history: MessageEditHistoryEntry[] }>(`/messages/${messageId}/history`)
  return history
}
export async function apiDeleteMessage(messageId: string): Promise<void> {
  await request(`/messages/${messageId}`, { method: 'DELETE' })
}
export async function apiEditVoiceMessage(messageId: string, audio: Blob, durationSec: number): Promise<ChatMessage> {
  const form = new FormData()
  form.append('durationSec', String(Math.max(1, Math.round(durationSec))))
  form.append('audio', audio, `vocal.${audio.type.includes('ogg') ? 'ogg' : 'webm'}`)

  let response: Response
  try {
    response = await fetch(`${API_URL}/messages/${messageId}/voice`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'X-Requested-With': 'talkie-web' },
      body: form,
    })
  } catch {
    throw new AuthApiError({ code: 'NETWORK_ERROR', message: 'Serveur injoignable. Vérifiez votre connexion.' })
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new AuthApiError({ code: body?.code ?? 'UNKNOWN', message: body?.message ?? 'Le vocal n\'a pas pu être modifié.' })
  return body.message as ChatMessage
      }
