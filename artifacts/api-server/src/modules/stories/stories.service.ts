import { pool } from '../../db/pool'
import { AppError } from '../../utils/AppError'
import type { StoryRow, StoryGroup } from './stories.types'

export async function createStory(userId: string, imageUrl: string): Promise<StoryRow> {
  const result = await pool.query<StoryRow>(
    `INSERT INTO stories (user_id, image_url, expires_at)
     VALUES ($1, $2, now() + INTERVAL '24 hours')
     RETURNING *`,
    [userId, imageUrl],
  )
  return result.rows[0]
}

export async function listMyStories(userId: string): Promise<StoryRow[]> {
  const result = await pool.query<StoryRow>(
    `SELECT * FROM stories WHERE user_id = $1 AND expires_at > now() ORDER BY created_at ASC`,
    [userId],
  )
  return result.rows
}

// Stories de mes contacts acceptes (relation dirigee : je dois avoir ajoute
// la personne et le statut doit etre 'accepted', comme dans contacts.service.ts).
export async function listContactsStories(userId: string): Promise<StoryGroup[]> {
  const result = await pool.query<StoryRow & {
    username: string
    display_name: string
    avatar_color: string
    avatar_url: string | null
  }>(
    `SELECT s.*, u.username, u.display_name, u.avatar_color, u.avatar_url
     FROM stories s
     JOIN contacts c ON c.contact_user_id = s.user_id
     JOIN users u ON u.id = s.user_id
     WHERE c.user_id = $1 AND c.status = 'accepted' AND s.expires_at > now()
     ORDER BY s.created_at ASC`,
    [userId],
  )

  const viewedResult = await pool.query<{ story_id: string }>(
    `SELECT story_id FROM story_views WHERE viewer_id = $1`,
    [userId],
  )
  const viewedIds = new Set(viewedResult.rows.map((r) => r.story_id))

  const groups = new Map<string, StoryGroup>()
  for (const row of result.rows) {
    if (!groups.has(row.user_id)) {
      groups.set(row.user_id, {
        user: {
          id: row.user_id,
          username: row.username,
          displayName: row.display_name,
          avatarColor: row.avatar_color,
          avatarUrl: row.avatar_url ?? undefined,
        },
        stories: [],
        hasUnviewed: false,
      })
    }
    const group = groups.get(row.user_id)!
    const viewed = viewedIds.has(row.id)
    if (!viewed) group.hasUnviewed = true
    group.stories.push({
      id: row.id,
      userId: row.user_id,
      imageUrl: row.image_url,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      viewed,
    })
  }
  return Array.from(groups.values())
}

export async function markStoryViewed(storyId: string, viewerId: string): Promise<void> {
  const story = await pool.query<StoryRow>(`SELECT * FROM stories WHERE id = $1`, [storyId])
  if (story.rows.length === 0) {
    throw new AppError('STORY_NOT_FOUND', 'Story introuvable.', 404)
  }
  await pool.query(
    `INSERT INTO story_views (story_id, viewer_id) VALUES ($1, $2)
     ON CONFLICT (story_id, viewer_id) DO NOTHING`,
    [storyId, viewerId],
  )
}

export async function deleteStory(userId: string, storyId: string): Promise<void> {
  const result = await pool.query(`DELETE FROM stories WHERE id = $1 AND user_id = $2`, [storyId, userId])
  if (result.rowCount === 0) {
    throw new AppError('STORY_NOT_FOUND', 'Story introuvable.', 404)
  }
    }
