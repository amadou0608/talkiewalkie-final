import { pool } from '../../db/pool'
import { AppError } from '../../utils/AppError'
import { avatarColorFor } from '../../utils/presentation'
import type { StoryRow, StoryGroup, StoryVisibilityMode, StoryViewer, StoryType, StoryEditHistoryEntry } from './stories.types'

const EDIT_WINDOW_MS = 20 * 60 * 1000

export async function createStory(
  userId: string,
  type: StoryType,
  imageUrl: string | null,
  textContent: string | null,
  visibilityMode: StoryVisibilityMode,
  targetUserIds: string[],
): Promise<StoryRow> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const result = await client.query<StoryRow>(
      `INSERT INTO stories (user_id, image_url, type, text_content, expires_at, visibility_mode)
       VALUES ($1, $2, $3, $4, now() + INTERVAL '24 hours', $5)
       RETURNING *`,
      [userId, imageUrl, type, textContent, visibilityMode],
    )
    const story = result.rows[0]

    if (visibilityMode !== 'all' && targetUserIds.length > 0) {
      const values = targetUserIds.map((_, i) => `($1, $${i + 2})`).join(', ')
      await client.query(
        `INSERT INTO story_visibility_list (story_id, user_id) VALUES ${values}`,
        [story.id, ...targetUserIds],
      )
    }

    await client.query('COMMIT')
    return story
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
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
// Le filtre de confidentialite (visibility_mode / story_visibility_list) est
// applique directement dans la requete SQL.
export async function listContactsStories(userId: string): Promise<StoryGroup[]> {
  const result = await pool.query<StoryRow & {
    username: string
    display_name: string
    avatar_url: string | null
  }>(
    `SELECT s.*, u.username, u.display_name, u.avatar_url
     FROM stories s
     JOIN contacts c ON c.contact_user_id = s.user_id
     JOIN users u ON u.id = s.user_id
     WHERE c.user_id = $1 AND c.status = 'accepted' AND s.expires_at > now()
       AND (
         s.visibility_mode = 'all'
         OR (s.visibility_mode = 'except' AND NOT EXISTS (
               SELECT 1 FROM story_visibility_list svl WHERE svl.story_id = s.id AND svl.user_id = $1
             ))
         OR (s.visibility_mode = 'only' AND EXISTS (
               SELECT 1 FROM story_visibility_list svl WHERE svl.story_id = s.id AND svl.user_id = $1
             ))
       )
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
          avatarColor: avatarColorFor(row.username),
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
      type: row.type,
      textContent: row.text_content,
      createdAt: row.created_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      editedAt: row.edited_at ? row.edited_at.toISOString() : null,
      viewed,
      visibilityMode: row.visibility_mode,
    })
  }
  return Array.from(groups.values())
}

export async function markStoryViewed(storyId: string, viewerId: string): Promise<void> {
  const story = await pool.query<StoryRow>('SELECT * FROM stories WHERE id = $1', [storyId])
  if (story.rows.length === 0) {
    throw new AppError('STORY_NOT_FOUND', 'Story introuvable.', 404)
  }
  await pool.query(
    `INSERT INTO story_views (story_id, viewer_id) VALUES ($1, $2)
     ON CONFLICT (story_id, viewer_id) DO NOTHING`,
    [storyId, viewerId],
  )
}

// Liste des personnes ayant vu ma story. Verifie que la story appartient bien
// a ownerId avant de renvoyer quoi que ce soit.
export async function getStoryViewers(storyId: string, ownerId: string): Promise<StoryViewer[]> {
  const story = await pool.query<StoryRow>(
    'SELECT * FROM stories WHERE id = $1 AND user_id = $2',
    [storyId, ownerId],
  )
  if (story.rows.length === 0) {
    throw new AppError('STORY_NOT_FOUND', 'Story introuvable.', 404)
  }

  const result = await pool.query<{
    viewer_id: string
    username: string
    display_name: string
    avatar_url: string | null
  }>(
    `SELECT sv.viewer_id, u.username, u.display_name, u.avatar_url
     FROM story_views sv
     JOIN users u ON u.id = sv.viewer_id
     WHERE sv.story_id = $1`,
    [storyId],
  )

  return result.rows.map((row) => ({
    userId: row.viewer_id,
    username: row.username,
    displayName: row.display_name,
    avatarColor: avatarColorFor(row.username),
    avatarUrl: row.avatar_url ?? undefined,
  }))
}

// Edite le texte/legende et/ou le media d'une story, dans la fenetre des 20
// minutes suivant sa creation. Archive l'ancienne version dans
// story_edit_history avant d'ecraser, comme editTextMessage pour les messages.
export async function editStory(
  userId: string,
  storyId: string,
  newType: StoryType,
  newImageUrl: string | null,
  newTextContent: string | null,
): Promise<StoryRow> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const existingResult = await client.query<StoryRow>(
      'SELECT * FROM stories WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [storyId, userId],
    )
    if (existingResult.rows.length === 0) {
      throw new AppError('STORY_NOT_FOUND', 'Story introuvable.', 404)
    }
    const existing = existingResult.rows[0]

    const ageMs = Date.now() - existing.created_at.getTime()
    if (ageMs > EDIT_WINDOW_MS) {
      throw new AppError('EDIT_WINDOW_EXPIRED', 'Le delai de modification (20 minutes) est depasse.', 403)
    }

    await client.query(
      `INSERT INTO story_edit_history (story_id, previous_image_url, previous_text_content, previous_type)
       VALUES ($1, $2, $3, $4)`,
      [storyId, existing.image_url, existing.text_content, existing.type],
    )

    const updated = await client.query<StoryRow>(
      `UPDATE stories SET image_url = $1, text_content = $2, type = $3, edited_at = now()
       WHERE id = $4
       RETURNING *`,
      [newImageUrl, newTextContent, newType, storyId],
    )

    await client.query('COMMIT')
    return updated.rows[0]
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function getStoryEditHistory(userId: string, storyId: string): Promise<StoryEditHistoryEntry[]> {
  const story = await pool.query<StoryRow>(
    'SELECT * FROM stories WHERE id = $1 AND user_id = $2',
    [storyId, userId],
  )
  if (story.rows.length === 0) {
    throw new AppError('STORY_NOT_FOUND', 'Story introuvable.', 404)
  }

  const result = await pool.query<{
    previous_image_url: string | null
    previous_text_content: string | null
    previous_type: StoryType
    edited_at: Date
  }>(
    `SELECT previous_image_url, previous_text_content, previous_type, edited_at
     FROM story_edit_history
     WHERE story_id = $1
     ORDER BY edited_at ASC`,
    [storyId],
  )

  return result.rows.map((row) => ({
    previousImageUrl: row.previous_image_url,
    previousTextContent: row.previous_text_content,
    previousType: row.previous_type,
    editedAt: row.edited_at.toISOString(),
  }))
}

export async function deleteStory(userId: string, storyId: string): Promise<void> {
  const result = await pool.query('DELETE FROM stories WHERE id = $1 AND user_id = $2', [storyId, userId])
  if (result.rowCount === 0) {
    throw new AppError('STORY_NOT_FOUND', 'Story introuvable.', 404)
  }
  }
