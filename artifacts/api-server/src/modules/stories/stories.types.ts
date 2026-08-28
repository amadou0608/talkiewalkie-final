export type StoryVisibilityMode = 'all' | 'except' | 'only'

export interface StoryRow {
  id: string
  user_id: string
  image_url: string
  created_at: Date
  expires_at: Date
  visibility_mode: StoryVisibilityMode
}

export interface Story {
  id: string
  userId: string
  imageUrl: string
  createdAt: string
  expiresAt: string
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
