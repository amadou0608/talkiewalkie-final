import { pool } from '../../db/pool'
import { AppError } from '../../utils/AppError'
import { isAcceptedContact } from '../contacts/contacts.service'
import { avatarColorFor } from '../../utils/presentation'

const EDIT_WINDOW_MINUTES = 20

export interface MessageUser { id: string; username: string; displayName: string; avatarColor: string; avatarUrl?: string }
export interface MessageItem {
  id: string
  senderId: string
  receiverId: string
  type: 'text' | 'voice' | 'image' | 'video'
  content: string | null
  fileUrl: string | null
  durationSec: number | null
  status: 'sent' | 'delivered' | 'read'
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
  sender: MessageUser
  receiver: MessageUser
}

type MessageRow = Omit<MessageItem, 'createdAt' | 'editedAt' | 'deletedAt' | 'sender' | 'receiver'> & {
  created_at: Date; edited_at: Date | null; deleted_at: Date | null
  sender_username: string; sender_display_name: string; sender_avatar_url: string | null
  receiver_username: string; receiver_display_name: string; receiver_avatar_url: string | null
}

function mapMessage(row: MessageRow): MessageItem {
  return {
    id: row.id, senderId: row.senderId, receiverId: row.receiverId, type: row.type,
    content: row.content, fileUrl: row.fileUrl, durationSec: row.durationSec, status: row.status,
    createdAt: row.created_at.toISOString(), editedAt: row.edited_at?.toISOString() ?? null,
    deletedAt: row.deleted_at?.toISOString() ?? null,
    sender: { id: row.senderId, username: row.sender_username, displayName: row.sender_display_name, avatarUrl: row.sender_avatar_url ?? undefined, avatarColor: avatarColorFor(row.sender_username) },
    receiver: { id: row.receiverId, username: row.receiver_username, displayName: row.receiver_display_name, avatarUrl: row.receiver_avatar_url ?? undefined, avatarColor: avatarColorFor(row.receiver_username) },
  }
}

const baseSelect = `
  SELECT m.id, m.sender_id AS "senderId", m.receiver_id AS "receiverId", m.type,
         m.content, m.file_url AS "fileUrl", m.duration_sec AS "durationSec", m.status,
         m.created_at, m.edited_at, m.deleted_at,
          su.username AS sender_username, su.display_name AS sender_display_name, su.avatar_url AS sender_avatar_url,
          ru.username AS receiver_username, ru.display_name AS receiver_display_name, ru.avatar_url AS receiver_avatar_url
    FROM messages m
    JOIN users su ON su.id = m.sender_id
    JOIN users ru ON ru.id = m.receiver_id`

async function assertConversation(userId: string, otherUserId: string) {
  if (userId === otherUserId) throw new AppError('VALIDATION_ERROR', 'Conversation invalide.')
  if (!(await isAcceptedContact(userId, otherUserId))) {
    throw new AppError('FORBIDDEN', 'Vous devez avoir ce contact pour lui envoyer un message.', 403)
  }
}

export async function listConversation(userId: string, otherUserId: string, limit: number, before?: string) {
  await assertConversation(userId, otherUserId)
  const params: unknown[] = [userId, otherUserId, limit]
  const beforeClause = before ? `AND m.created_at < $4` : ''
  if (before) params.push(before)
  const result = await pool.query<MessageRow>(
    `${baseSelect}
     WHERE ((m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1))
       AND m.deleted_at IS NULL ${beforeClause}
     ORDER BY m.created_at DESC
     LIMIT $3`, params)
  return result.rows.reverse().map(mapMessage)
}

export async function createTextMessage(senderId: string, receiverId: string, content: string, delivered: boolean) {
  await assertConversation(senderId, receiverId)
  const status = delivered ? 'delivered' : 'sent'
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO messages (sender_id, receiver_id, type, content, status)
     VALUES ($1, $2, 'text', $3, $4) RETURNING id`, [senderId, receiverId, content, status])
  const result = await pool.query<MessageRow>(`${baseSelect} WHERE m.id = $1`, [inserted.rows[0].id])
  return mapMessage(result.rows[0])
}

export async function markRead(userId: string, messageId: string) {
  const result = await pool.query<MessageRow>(`${baseSelect}
     WHERE m.id = $1 AND m.receiver_id = $2 AND m.status <> 'read'
     LIMIT 1`, [messageId, userId])
  if (!result.rows[0]) return null
  await pool.query(`UPDATE messages SET status = 'read' WHERE id = $1 AND receiver_id = $2 AND status <> 'read'`, [messageId, userId])
  const updated = await pool.query<MessageRow>(`${baseSelect} WHERE m.id = $1 AND m.receiver_id = $2 LIMIT 1`, [messageId, userId])
  return mapMessage(updated.rows[0])
}

export async function markConversationRead(userId: string, otherUserId: string) {
  await assertConversation(userId, otherUserId)
  const result = await pool.query<{ id: string; sender_id: string }>(
    `UPDATE messages SET status = 'read'
       WHERE receiver_id = $1 AND sender_id = $2 AND status <> 'read' AND deleted_at IS NULL
       RETURNING id, sender_id`, [userId, otherUserId])
  return result.rows
}

export async function editTextMessage(userId: string, messageId: string, content: string) {
  const existing = await pool.query<{ receiver_id: string; type: string; content: string | null; created_at: Date; deleted_at: Date | null }>(
    `SELECT receiver_id, type, content, created_at, deleted_at FROM messages WHERE id = $1 AND sender_id = $2 LIMIT 1`, [messageId, userId])
  const row = existing.rows[0]
  if (!row) throw new AppError('NOT_FOUND', 'Message introuvable.', 404)
  if (row.type !== 'text') throw new AppError('VALIDATION_ERROR', 'Seuls les messages texte peuvent être modifiés.')
  if (row.deleted_at) throw new AppError('VALIDATION_ERROR', 'Ce message a été supprimé.')

  const ageMinutes = (Date.now() - row.created_at.getTime()) / 60000
  if (ageMinutes > EDIT_WINDOW_MINUTES) {
    throw new AppError('VALIDATION_ERROR', 'Le délai de modification (20 minutes) est dépassé.', 403)
  }

  await pool.query(
    `INSERT INTO message_edit_history (message_id, previous_content) VALUES ($1, $2)`,
    [messageId, row.content])

  await pool.query(`UPDATE messages SET content = $1, edited_at = now() WHERE id = $2 AND sender_id = $3`, [content, messageId, userId])
  const result = await pool.query<MessageRow>(`${baseSelect} WHERE m.id = $1`, [messageId])
  return mapMessage(result.rows[0])
}

export async function getEditHistory(userId: string, messageId: string) {
  const owner = await pool.query<{ sender_id: string; receiver_id: string }>(
    `SELECT sender_id, receiver_id FROM messages WHERE id = $1 LIMIT 1`, [messageId])
  const row = owner.rows[0]
  if (!row || (row.sender_id !== userId && row.receiver_id !== userId)) {
    throw new AppError('NOT_FOUND', 'Message introuvable.', 404)
  }
  const result = await pool.query<{ previous_content: string | null; edited_at: Date }>(
    `SELECT previous_content, edited_at FROM message_edit_history WHERE message_id = $1 ORDER BY edited_at ASC`,
    [messageId])
  return result.rows.map((r) => ({ previousContent: r.previous_content, editedAt: r.edited_at.toISOString() }))
}

export async function deleteMessage(userId: string, messageId: string) {
  const existing = await pool.query<{ receiver_id: string; deleted_at: Date | null }>(
    `SELECT receiver_id, deleted_at FROM messages WHERE id = $1 AND sender_id = $2 LIMIT 1`, [messageId, userId])
  const row = existing.rows[0]
  if (!row) throw new AppError('NOT_FOUND', 'Message introuvable.', 404)
  if (!row.deleted_at) await pool.query(`UPDATE messages SET deleted_at = now(), content = NULL, file_url = NULL WHERE id = $1 AND sender_id = $2`, [messageId, userId])
  return { id: messageId, receiverId: row.receiver_id }
}

export async function getConversationSummaries(userId: string) {
  const result = await pool.query<any>(`
    WITH conversations AS (
      SELECT DISTINCT ON (other_id)
        other_id, m.id, m.type, m.content, m.created_at, m.status, m.sender_id, m.deleted_at
      FROM (
        SELECT m.*, CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS other_id
        FROM messages m
        WHERE (m.sender_id = $1 OR m.receiver_id = $1) AND m.deleted_at IS NULL
      ) m
      ORDER BY other_id, created_at DESC
    )
    SELECT c.*, u.username, u.display_name, u.avatar_url,
      (SELECT COUNT(*)::int FROM messages unread WHERE unread.sender_id = c.other_id AND unread.receiver_id = $1 AND unread.status <> 'read' AND unread.deleted_at IS NULL) AS unread_count
    FROM conversations c JOIN users u ON u.id = c.other_id
    ORDER BY c.created_at DESC`, [userId])
  return result.rows.map((r) => ({
    userId: r.other_id, messageId: r.id, type: r.type, content: r.content, createdAt: r.created_at.toISOString(),
    status: r.status, senderId: r.sender_id, unreadCount: r.unread_count,
     user: { id: r.other_id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url ?? undefined, avatarColor: avatarColorFor(r.username) },
  }))
}

export async function markDelivered(userId: string, messageId: string) {
  const result = await pool.query<MessageRow>(
    `${baseSelect}
     WHERE m.id = $1 AND m.receiver_id = $2 AND m.status = 'sent'
     LIMIT 1`, [messageId, userId])
  if (!result.rows[0]) return null
  await pool.query(`UPDATE messages SET status = 'delivered' WHERE id = $1 AND receiver_id = $2 AND status = 'sent'`, [messageId, userId])
  const updated = await pool.query<MessageRow>(`${baseSelect} WHERE m.id = $1 AND m.receiver_id = $2 LIMIT 1`, [messageId, userId])
  return mapMessage(updated.rows[0])
}

export async function createChatVoiceMessage(
  senderId: string,
  receiverId: string,
  durationSec: number,
  fileUrl: string,
  mimeType: string,
  delivered: boolean,
) {
  await assertConversation(senderId, receiverId)
  const status = delivered ? 'delivered' : 'sent'
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO messages (sender_id, receiver_id, type, file_url, duration_sec, status, mime_type)
     VALUES ($1, $2, 'voice', $3, $4, $5, $6) RETURNING id`,
    [senderId, receiverId, fileUrl, durationSec, status, mimeType],
  )
  const result = await pool.query<MessageRow>(`${baseSelect} WHERE m.id = $1`, [inserted.rows[0].id])
  return mapMessage(result.rows[0])
}

export async function createChatMediaMessage(
  senderId: string,
  receiverId: string,
  type: 'image' | 'video',
  fileUrl: string,
  mimeType: string,
  delivered: boolean,
  durationSec?: number,
) {
  await assertConversation(senderId, receiverId)
  const status = delivered ? 'delivered' : 'sent'
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO messages (sender_id, receiver_id, type, file_url, duration_sec, status, mime_type)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [senderId, receiverId, type, fileUrl, type === 'video' ? durationSec ?? null : null, status, mimeType],
  )
  const result = await pool.query<MessageRow>(`${baseSelect} WHERE m.id = $1`, [inserted.rows[0].id])
  return mapMessage(result.rows[0])
}

export async function getChatMessageFile(messageId: string, requesterId: string, expectedType: 'voice' | 'image' | 'video') {
  const result = await pool.query<{ fileUrl: string; type: string; mimeType: string | null }>(
    `SELECT m.file_url AS "fileUrl", m.type, m.mime_type AS "mimeType"
       FROM messages m
      WHERE m.id = $1 AND (m.sender_id = $2 OR m.receiver_id = $2) AND m.deleted_at IS NULL`,
    [messageId, requesterId],
  )
  const row = result.rows[0]
  if (!row || row.type !== expectedType || !row.fileUrl || (expectedType === 'voice' && !row.mimeType)) {
    throw new AppError('FILE_NOT_FOUND', 'Fichier introuvable ou accès refusé.', 404)
  }
  return { ...row, mimeType: row.mimeType ?? 'application/octet-stream' }
  }
