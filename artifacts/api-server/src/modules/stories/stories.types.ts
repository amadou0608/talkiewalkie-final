export interface StoryRow {
  id: string
  user_id: string
  image_url: string
  created_at: Date
  expires_at: Date
}

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
