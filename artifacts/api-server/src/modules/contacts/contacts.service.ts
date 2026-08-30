// Contacts — Phase 4 du cahier des charges (section 6-7).
//
// Decision MVP : l'ajout d'un contact cree directement une relation
// 'accepted' (pas de flux "demande a valider par le destinataire" — la
// section 7 decrit une recherche puis un ajout direct, sans etape
// d'acceptation). Le statut 'pending' reste supporte par le schema pour une
// evolution future sans nouvelle migration ; la liste renvoyee par
// listContacts() distingue deja les deux groupes pour que le frontend
// (Contacts.tsx) n'ait rien a changer le jour ou 'pending' sera utilise.
import { pool } from '../../db/pool'
import { AppError } from '../../utils/AppError'
import { toPublicUser } from '../users/user.mapper'
import { findUserRowById, findUserRowByUsername, normalizeUsername } from '../users/users.repository'
import type { PublicUser, UserRow } from '../users/user.types'

export type ContactRelation = 'accepted' | 'pending' | 'blocked'

export interface ContactWithUser {
  user: PublicUser
  relation: ContactRelation
  hideReadReceipts: boolean
}

interface ContactRow extends UserRow {
  contact_status: ContactRelation
  hide_read_receipts: boolean
}

function toContactWithUser(row: ContactRow): ContactWithUser {
  return { user: toPublicUser(row), relation: row.contact_status, hideReadReceipts: row.hide_read_receipts }
}

async function getRelationStatus(userId: string, contactUserId: string): Promise<ContactRelation | null> {
  const result = await pool.query<{ status: ContactRelation }>(
    'SELECT status FROM contacts WHERE user_id = $1 AND contact_user_id = $2',
    [userId, contactUserId],
  )
  return result.rows[0]?.status ?? null
}

export async function listContacts(
  userId: string,
): Promise<{ accepted: ContactWithUser[]; pending: ContactWithUser[] }> {
  const result = await pool.query<ContactRow>(
    `SELECT u.*, c.status AS contact_status, c.hide_read_receipts
     FROM contacts c
     JOIN users u ON u.id = c.contact_user_id
     WHERE c.user_id = $1 AND c.status IN ('accepted', 'pending')
     ORDER BY u.display_name ASC`,
    [userId],
  )

  const accepted: ContactWithUser[] = []
  const pending: ContactWithUser[] = []
  for (const row of result.rows) {
    ;(row.contact_status === 'pending' ? pending : accepted).push(toContactWithUser(row))
  }
  return { accepted, pending }
}

export async function listBlocked(userId: string): Promise<ContactWithUser[]> {
  const result = await pool.query<ContactRow>(
    `SELECT u.*, c.status AS contact_status, c.hide_read_receipts
     FROM contacts c
     JOIN users u ON u.id = c.contact_user_id
     WHERE c.user_id = $1 AND c.status = 'blocked'
     ORDER BY u.display_name ASC`,
    [userId],
  )
  return result.rows.map(toContactWithUser)
}

export async function searchUser(userId: string, rawUsername: string): Promise<PublicUser> {
  const username = normalizeUsername(rawUsername)
  const row = await findUserRowByUsername(username)

  if (!row) {
    throw new AppError('USER_NOT_FOUND', 'Aucun utilisateur ne correspond a cet identifiant.', 404)
  }
  if (row.id === userId) {
    throw new AppError('CANNOT_ADD_SELF', 'Vous ne pouvez pas vous ajouter vous-meme.', 400)
  }

  return toPublicUser(row)
}

export async function addContact(userId: string, rawUsername: string): Promise<ContactWithUser> {
  const username = normalizeUsername(rawUsername)
  const target = await findUserRowByUsername(username)

  if (!target) {
    throw new AppError('USER_NOT_FOUND', 'Aucun utilisateur ne correspond a cet identifiant.', 404)
  }
  if (target.id === userId) {
    throw new AppError('CANNOT_ADD_SELF', 'Vous ne pouvez pas vous ajouter vous-meme.', 400)
  }

  const currentStatus = await getRelationStatus(userId, target.id)
  if (currentStatus === 'blocked') {
    throw new AppError('CONTACT_BLOCKED', 'Debloquez ce contact avant de l\u2019ajouter a nouveau.', 409)
  }
  if (currentStatus === 'accepted') {
    throw new AppError('CONTACT_EXISTS', 'Ce contact est deja dans votre liste.', 409)
  }

  await pool.query(
    `INSERT INTO contacts (user_id, contact_user_id, status)
     VALUES ($1, $2, 'accepted')
     ON CONFLICT (user_id, contact_user_id) DO UPDATE SET status = 'accepted', updated_at = now()`,
    [userId, target.id],
  )

  return { user: toPublicUser(target), relation: 'accepted', hideReadReceipts: false }
}

export async function removeContact(userId: string, contactUserId: string): Promise<void> {
  const result = await pool.query(
    `DELETE FROM contacts WHERE user_id = $1 AND contact_user_id = $2 AND status <> 'blocked'`,
    [userId, contactUserId],
  )
  if (result.rowCount === 0) {
    throw new AppError('CONTACT_NOT_FOUND', 'Contact introuvable.', 404)
  }
}

export async function blockContact(userId: string, contactUserId: string): Promise<void> {
  if (contactUserId === userId) {
    throw new AppError('CANNOT_ADD_SELF', 'Action impossible sur votre propre compte.', 400)
  }

  const target = await findUserRowById(contactUserId)
  if (!target) {
    throw new AppError('USER_NOT_FOUND', 'Utilisateur introuvable.', 404)
  }

  await pool.query(
    `INSERT INTO contacts (user_id, contact_user_id, status)
     VALUES ($1, $2, 'blocked')
     ON CONFLICT (user_id, contact_user_id) DO UPDATE SET status = 'blocked', updated_at = now()`,
    [userId, contactUserId],
  )
}

// Vérifie qu'une communication privée peut être ouverte entre deux contacts
// acceptés. Cette règle sera réutilisée par les messages des phases suivantes.
export async function isAcceptedContact(userId: string, otherUserId: string): Promise<boolean> {
  const status = await getRelationStatus(userId, otherUserId)
  return status === 'accepted'
}

export async function unblockContact(userId: string, contactUserId: string): Promise<void> {
  const result = await pool.query(
    `DELETE FROM contacts WHERE user_id = $1 AND contact_user_id = $2 AND status = 'blocked'`,
    [userId, contactUserId],
  )
  if (result.rowCount === 0) {
    throw new AppError('CONTACT_NOT_FOUND', 'Ce contact n\u2019est pas bloque.', 404)
  }
}

// Thème 2 — accusés de lecture granulaires par contact (30 août 2026).
// hide_read_receipts sur la ligne (user_id, contact_user_id) : "je ne veux
// pas que ce contact voie que j'ai lu ses messages". Consulté par
// messages.service.ts (markRead / markConversationRead).
export async function getHideReadReceipts(userId: string, contactUserId: string): Promise<boolean> {
  const result = await pool.query<{ hide_read_receipts: boolean }>(
    'SELECT hide_read_receipts FROM contacts WHERE user_id = $1 AND contact_user_id = $2',
    [userId, contactUserId],
  )
  return result.rows[0]?.hide_read_receipts ?? false
}

export async function setHideReadReceipts(userId: string, contactUserId: string, hide: boolean): Promise<void> {
  const status = await getRelationStatus(userId, contactUserId)
  if (status !== 'accepted') {
    throw new AppError('CONTACT_NOT_FOUND', 'Contact introuvable.', 404)
  }
  await pool.query(
    'UPDATE contacts SET hide_read_receipts = $3, updated_at = now() WHERE user_id = $1 AND contact_user_id = $2',
    [userId, contactUserId, hide],
  )
}
