// Presence — Phase 5 (section 5 : "Creer WebSocket et la presence en ligne").
//
// La verite de la presence est desormais pilotee par les connexions
// WebSocket (voir socket.ts), plus seulement par login/logout REST : un
// utilisateur peut avoir une session valide (cookie) sans etre "en ligne"
// au sens presence (ex. onglet ferme, app en arriere-plan). Les colonnes
// `is_online` / `last_seen` de la table users (section 4) restent la source
// persistee, mise a jour ici.
import { pool } from '../db/pool'

export type PresenceStatus = 'online' | 'offline'

export interface PresenceUpdate {
  userId: string
  status: PresenceStatus
  lastSeen: string
}

async function setOnlineFlag(userId: string, isOnline: boolean): Promise<Date> {
  const result = await pool.query<{ last_seen: Date }>(
    `UPDATE users SET is_online = $2, last_seen = now() WHERE id = $1 RETURNING last_seen`,
    [userId, isOnline],
  )
  return result.rows[0]?.last_seen ?? new Date()
}

// Qui doit etre notifie des changements de presence de `userId` : tous les
// utilisateurs qui l'ont dans leurs contacts (section 6 : "voir le statut").
// Volontairement unidirectionnel — avoir A dans ses contacts ne rend pas A
// notifie des changements de B tant que B n'a pas aussi ajoute A.
export async function getWatcherIds(userId: string): Promise<string[]> {
  const result = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM contacts WHERE contact_user_id = $1 AND status = 'accepted'`,
    [userId],
  )
  return result.rows.map((r) => r.user_id)
}

export async function markOnline(userId: string): Promise<PresenceUpdate> {
  await setOnlineFlag(userId, true)
  return { userId, status: 'online', lastSeen: 'en ligne' }
}

export async function markOffline(userId: string): Promise<PresenceUpdate> {
  await setOnlineFlag(userId, false)
  return { userId, status: 'offline', lastSeen: 'a l\u2019instant' }
}
