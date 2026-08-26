import { pool } from '../../db/pool'
import { AppError } from '../../utils/AppError'
import { hashPassword, verifyPassword } from '../../utils/password'
import { toPublicUser } from '../users/user.mapper'
import { findUserRowById, findUserRowByUsername, normalizeUsername } from '../users/users.repository'
import type { PublicUser, UserRow } from '../users/user.types'
import { deleteVoiceMessageFile } from '../voice-messages/storage'
import type { LoginInput, RegisterInput } from './auth.schemas'

export type { PublicUser }

export async function findById(id: string): Promise<PublicUser | null> {
  const row = await findUserRowById(id)
  return row ? toPublicUser(row) : null
}

export async function registerUser(input: RegisterInput): Promise<PublicUser> {
  const existing = await findUserRowByUsername(input.username)
  if (existing) {
    throw new AppError('USERNAME_TAKEN', 'Cet identifiant est deja pris.', 409)
  }

  const passwordHash = await hashPassword(input.password)

  const result = await pool.query<UserRow>(
    `INSERT INTO users (username, display_name, password_hash, is_online, last_seen)
     VALUES ($1, $2, $3, true, now())
     RETURNING *`,
    [input.username, input.displayName, passwordHash],
  )

  return toPublicUser(result.rows[0])
}

export async function loginUser(input: LoginInput): Promise<PublicUser> {
  const username = normalizeUsername(input.username)
  const row = await findUserRowByUsername(username)

  if (!row) {
    // Meme message que "mot de passe incorrect" : ne jamais reveler si
    // l'identifiant existe (evite l'enumeration de comptes).
    throw new AppError('INVALID_CREDENTIALS', 'Identifiant ou mot de passe incorrect.', 401)
  }

  const valid = await verifyPassword(input.password, row.password_hash)
  if (!valid) {
    throw new AppError('INVALID_CREDENTIALS', 'Identifiant ou mot de passe incorrect.', 401)
  }

  const updated = await pool.query<UserRow>(
    `UPDATE users SET is_online = true, last_seen = now() WHERE id = $1 RETURNING *`,
    [row.id],
  )

  return toPublicUser(updated.rows[0])
}

export async function markOffline(userId: string): Promise<void> {
  await pool.query(`UPDATE users SET is_online = false, last_seen = now() WHERE id = $1`, [userId])
}

// Suppression de compte — Phase 11 (section 13 : "Permettre a l'utilisateur
// de supprimer son compte et ses donnees.").
//
// Toutes les tables liees (contacts, voice_messages, devices) declarent
// `REFERENCES users(id) ON DELETE CASCADE` (voir les migrations) : une seule
// suppression sur `users` suffit a effacer les lignes correspondantes en
// base. Les fichiers audio sur disque n'ont eux aucune contrainte DB pour
// les nettoyer automatiquement — on les supprime explicitement AVANT la
// suppression en base, tant qu'on peut encore retrouver leur chemin.
export async function deleteAccount(userId: string): Promise<void> {
  const files = await pool.query<{ storage_path: string }>(
    `SELECT storage_path FROM voice_messages WHERE sender_id = $1 OR receiver_id = $1`,
    [userId],
  )
  for (const row of files.rows) {
    deleteVoiceMessageFile(row.storage_path)
  }

  const result = await pool.query('DELETE FROM users WHERE id = $1', [userId])
  if (result.rowCount === 0) {
    throw new AppError('USER_NOT_FOUND', 'Utilisateur introuvable.', 404)
  }
}
