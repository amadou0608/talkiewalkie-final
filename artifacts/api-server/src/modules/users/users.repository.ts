import { pool } from '../../db/pool'
import type { UserRow } from './user.types'

export async function findUserRowByUsername(username: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>('SELECT * FROM users WHERE username = $1', [username])
  return result.rows[0] ?? null
}

export async function findUserRowById(id: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>('SELECT * FROM users WHERE id = $1', [id])
  return result.rows[0] ?? null
}

// Utilise par le module messages vocaux (Phase 8) pour resoudre les
// expediteurs d'une boite de reception en une seule requete plutot qu'un
// aller-retour base par message (N+1).
export async function findUserRowsByIds(ids: string[]): Promise<UserRow[]> {
  if (ids.length === 0) return []
  const result = await pool.query<UserRow>('SELECT * FROM users WHERE id = ANY($1)', [ids])
  return result.rows
}

// Normalisation partagee (meme regle que le frontend, voir lib/authApi.ts et
// lib/contactsApi.ts) : accepte "@moussa_diop" ou "moussa_diop" indifferemment.
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, '').toLowerCase()
}
