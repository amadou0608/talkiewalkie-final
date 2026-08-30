// Service stories — Phase 21, etendu Phase 23 (texte, video, legende),
// Phase 24 (edition dans la fenetre des 20 min, historique).
import { AuthApiError } from './authApi'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export type StoryVisibilityMode = 'all' | 'except' | 'only'
export type StoryType = 'image' | 'video' | 'text'

export interface Story {
  id: string
  userId: string
  imageUrl: string | null
  type: StoryType
  textContent: string | null
  createdAt: string
  expiresAt: string
  editedAt: string | null
  viewed: boolean
  visibilityMode: StoryVisibilityMode
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

export interface StoryViewer {
  userId: string
  username: string
  displayName: string
  avatarColor: string
  avatarUrl?: string
}

export interface StoryEditHistoryEntry {
  previousImageUrl: string | null
  previousTextContent: string | null
  previousType: StoryType
  editedAt: string
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

export async function apiUploadStory(
  type: StoryType,
  file: File | null,
  textContent: string,
  visibilityMode: StoryVisibilityMode = 'all',
  targetUserIds: string[] = [],
): Promise<Story> {
  const formData = new FormData()
  formData.append('type', type)
  if (file) formData.append('media', file)
  if (textContent) formData.append('textContent', textContent)
  formData.append('visibilityMode', visibilityMode)
  if (visibilityMode !== 'all') {
    formData.append('targetUserIds', JSON.stringify(targetUserIds))
  }
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

export async function apiStoryViewers(storyId: string): Promise<StoryViewer[]> {
  const { viewers } = await request<{ viewers: StoryViewer[] }>(`/stories/${storyId}/viewers`, { method: 'GET' })
  return viewers
}

export async function apiEditStory(storyId: string, textContent: string | null, file: File | null): Promise<Story> {
  const formData = new FormData()
  if (textContent !== null) formData.append('textContent', textContent)
  if (file) formData.append('media', file)
  const { story } = await request<{ story: Story }>(`/stories/${storyId}`, {
    method: 'PATCH',
    headers: { 'X-Requested-With': 'talkie-web' },
    body: formData,
  })
  return story
}

export async function apiStoryEditHistory(storyId: string): Promise<StoryEditHistoryEntry[]> {
  const { history } = await request<{ history: StoryEditHistoryEntry[] }>(`/stories/${storyId}/history`, { method: 'GET' })
  return history
}

export async function apiDeleteStory(storyId: string): Promise<void> {
  await request<void>(`/stories/${storyId}`, { method: 'DELETE' })
  }
