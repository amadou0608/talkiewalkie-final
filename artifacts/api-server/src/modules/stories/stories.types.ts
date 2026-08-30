export type StoryVisibilityMode = 'all' | 'except' | 'only'
export type StoryType = 'image' | 'video' | 'text'

export interface StoryRow {
  id: string
  user_id: string
  image_url: string | null
  type: StoryType
  text_content: string | null
  created_at: Date
  expires_at: Date
  edited_at: Date | null
  visibility_mode: StoryVisibilityMode
}

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
