// Service stories — Phase 21.
//
// Meme pattern que authApi.ts : request<T> generique, credentials 'include'
// pour le cookie de session, header X-Requested-With requis par le
// middleware CSRF sur toute requete qui modifie un etat.
import { AuthApiError } from './authApi'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export interface Story {
  id: string
  userId: string
  imageUrl: string
  createdAt: string
  expiresAt: string
  viewed: boolean
}

export interface StoryGroup {
  user: {
    id: string
    username: string
    displayName: string
    avatarColor: string
    avatarUrl?: string
  }
  stories: Story[]
  hasUnviewed: boolean
}

async function request<T>(path: string, options: RequestInit): Promise<T> {
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

  if (response.status === 204) {
    return undefined as T
  }

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new AuthApiError({
      code: body?.code ?? 'UNKNOWN',
      message: body?.message ?? `Erreur ${response.status}: ${JSON.stringify(body)}`,
    })
  }

  return body as T
}

export async function apiUploadStory(file: File): Promise<Story> {
  const formData = new FormData()
  formData.append('image', file)
  const { story } = await request<{ story: Story }>('/stories', {
    method: 'POST',
    headers: { 'X-Requested-With': 'talkie-web' },
    body: formData,
  })
  return story
}

export async function apiMyStories(): Promise<Story[]> {
  const { stories } = await request<{ stories: Story[] }>('/stories/mine', { method: 'GET' })
  return stories
}

export async function apiContactsStories(): Promise<StoryGroup[]> {
  const { groups } = await request<{ groups: StoryGroup[] }>('/stories', { method: 'GET' })
  return groups
}

export async function apiViewStory(storyId: string): Promise<void> {
  await request<void>(`/stories/${storyId}/view`, { method: 'POST' })
}

export async function apiDeleteStory(storyId: string): Promise<void> {
  await request<void>(`/stories/${storyId}`, { method: 'DELETE' })
      }
