import type { ChatMessage, ChatMessageStatus, ChatMessageUser } from '@/types'
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

export async function apiSendTextMessage(receiverId: string, content: string): Promise<ChatMessage> {
  const { message } = await request<{ message: ChatMessage }>('/messages', {
    method: 'POST', body: JSON.stringify({ receiverId, content }),
  })
  return message
}

export async function apiMarkMessageDelivered(messageId: string): Promise<void> {
  await request(`/messages/${messageId}/delivered`, { method: 'POST' })
}

export async function apiSendVoiceChatMessage(receiverId: string, audio: Blob, durationSec: number): Promise<ChatMessage> {
  const form = new FormData()
  form.append('receiverUserId', receiverId)
  form.append('durationSec', String(Math.max(1, Math.round(durationSec))))
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

export async function apiSendImageMessage(receiverId: string, image: Blob, filename = 'photo.jpg'): Promise<ChatMessage> {
  const form = new FormData()
  form.append('receiverUserId', receiverId)
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


export async function apiSendVideoMessage(receiverId: string, video: Blob, durationSec: number, filename = 'video.mp4'): Promise<ChatMessage> {
  const form = new FormData()
  form.append('receiverUserId', receiverId)
  form.append('durationSec', String(Math.ceil(durationSec)))
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

export async function apiDeleteMessage(messageId: string): Promise<void> {
  await request(`/messages/${messageId}`, { method: 'DELETE' })
}
