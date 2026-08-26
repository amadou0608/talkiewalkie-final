// Messages vocaux hors ligne — Phase 8 (section 10 du cahier des charges).
//
// Decision MVP sur `delivered_at` : mis a `now()` des l'insertion en base,
// pas au moment ou le destinataire ouvre l'app. Raison : une fois le
// fichier ecrit sur le disque du serveur et la ligne en base, le message
// est "livre" au sens ou il est garanti recuperable des que le destinataire
// se reconnecte (section 10 : "permettre sa recuperation lorsqu'il revient
// en ligne") — il n'y a pas de notion de livraison push confirmee avant la
// Phase 9 (Web Push, section 11). Le champ `listened_at` reste la seule
// distinction utile cote UI pour l'instant (badge "non lu" dans Messages.tsx).
import { pool } from '../../db/pool'
import { AppError } from '../../utils/AppError'
import { toPublicUser } from '../users/user.mapper'
import { findUserRowById, findUserRowsByIds } from '../users/users.repository'
import { isAcceptedContact } from '../contacts/contacts.service'
import type { PublicUser } from '../users/user.types'
import { deleteVoiceMessageFile, saveVoiceMessageFile } from './storage'

export interface VoiceMessageRow {
  id: string
  sender_id: string
  receiver_id: string
  storage_path: string
  mime_type: string
  size_bytes: number
  duration_sec: number
  created_at: Date
  delivered_at: Date | null
  listened_at: Date | null
}

export interface InboxVoiceMessage {
  id: string
  sender: PublicUser
  durationSec: number
  createdAt: string
  deliveredAt: string | null
  listenedAt: string | null
}

function toInboxMessage(row: VoiceMessageRow, sender: PublicUser): InboxVoiceMessage {
  return {
    id: row.id,
    sender,
    durationSec: row.duration_sec,
    createdAt: row.created_at.toISOString(),
    deliveredAt: row.delivered_at?.toISOString() ?? null,
    listenedAt: row.listened_at?.toISOString() ?? null,
  }
}

interface IncomingFile {
  buffer: Buffer
  mimetype: string
  size: number
}

export async function createVoiceMessage(
  senderId: string,
  receiverUserId: string,
  durationSec: number,
  file: IncomingFile,
): Promise<InboxVoiceMessage> {
  if (receiverUserId === senderId) {
    throw new AppError('CANNOT_ADD_SELF', 'Vous ne pouvez pas vous envoyer un message vocal a vous-meme.', 400)
  }

  const receiver = await findUserRowById(receiverUserId)
  if (!receiver) {
    throw new AppError('USER_NOT_FOUND', 'Destinataire introuvable.', 404)
  }

  // Meme regle que la signalisation WebRTC (Phase 6, section 6) : "Une fois
  // la personne ajoutee aux contacts, l'utilisateur peut... communiquer" —
  // un vocal n'est pas different d'un appel de ce point de vue.
  const allowed = await isAcceptedContact(senderId, receiverUserId)
  if (!allowed) {
    throw new AppError('CONTACT_NOT_FOUND', 'Ajoutez ce contact avant de lui envoyer un vocal.', 403)
  }

  if (!file.mimetype.startsWith('audio/')) {
    throw new AppError('INVALID_AUDIO_FILE', 'Format audio non supporte.', 400)
  }

  const { relativePath } = saveVoiceMessageFile(file.buffer, file.mimetype)

  try {
    const result = await pool.query<VoiceMessageRow>(
      `INSERT INTO voice_messages
         (sender_id, receiver_id, storage_path, mime_type, size_bytes, duration_sec, delivered_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       RETURNING *`,
      [senderId, receiverUserId, relativePath, file.mimetype, file.size, durationSec],
    )
    const row = result.rows[0]
    const senderRow = await findUserRowById(senderId)
    return toInboxMessage(row, toPublicUser(senderRow!))
  } catch (err) {
    // La ligne DB a echoue : ne laisse pas un fichier orphelin sur le disque.
    deleteVoiceMessageFile(relativePath)
    throw err
  }
}

// Boite de reception (section 10 : "permettre sa recuperation lorsqu'il
// revient en ligne"). Limitee a 100 messages les plus recents pour l'instant
// — pas de pagination demandee par le cahier des charges pour cette phase.
export async function listInbox(receiverId: string): Promise<InboxVoiceMessage[]> {
  const result = await pool.query<VoiceMessageRow>(
    `SELECT * FROM voice_messages WHERE receiver_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [receiverId],
  )
  if (result.rows.length === 0) return []

  const senderIds = [...new Set(result.rows.map((r) => r.sender_id))]
  const senderRows = await findUserRowsByIds(senderIds)
  const sendersById = new Map(senderRows.map((u) => [u.id, toPublicUser(u)]))

  const messages: InboxVoiceMessage[] = []
  for (const row of result.rows) {
    const sender = sendersById.get(row.sender_id)
    // Expediteur supprime entre-temps (hors perimetre de cette phase, pas
    // de suppression de compte encore implementee) : on ignore plutot que
    // d'afficher un message sans expediteur.
    if (sender) messages.push(toInboxMessage(row, sender))
  }
  return messages
}

// Verifie que `requesterId` a le droit d'acceder au fichier audio de ce
// message (expediteur OU destinataire — section 13/14 : jamais d'acces a un
// contenu prive d'un tiers).
export async function getVoiceMessageForAccess(id: string, requesterId: string): Promise<VoiceMessageRow> {
  const result = await pool.query<VoiceMessageRow>('SELECT * FROM voice_messages WHERE id = $1', [id])
  const row = result.rows[0]
  if (!row) {
    throw new AppError('VOICE_MESSAGE_NOT_FOUND', 'Message vocal introuvable.', 404)
  }
  if (row.sender_id !== requesterId && row.receiver_id !== requesterId) {
    throw new AppError('FORBIDDEN', 'Acces refuse a ce message vocal.', 403)
  }
  return row
}

// Idempotent (COALESCE) : rejouer l'appel (ex. l'utilisateur rouvre le
// lecteur) ne remet pas la pendule a zero sur `listened_at`.
export async function markListened(id: string, receiverId: string): Promise<{ listenedAt: string }> {
  const result = await pool.query<{ listened_at: Date }>(
    `UPDATE voice_messages SET listened_at = COALESCE(listened_at, now())
     WHERE id = $1 AND receiver_id = $2
     RETURNING listened_at`,
    [id, receiverId],
  )
  const row = result.rows[0]
  if (!row) {
    throw new AppError('VOICE_MESSAGE_NOT_FOUND', 'Message vocal introuvable.', 404)
  }
  return { listenedAt: row.listened_at.toISOString() }
}
