import { pool } from '../../db/pool'
import type { SubscribeInput } from './push.schemas'

export interface DeviceRow {
  id: string
  user_id: string
  endpoint: string
  push_token: SubscribeInput
  platform: string | null
  created_at: Date
  last_seen: Date
}

// Idempotent (ON CONFLICT) : un meme navigateur peut se re-abonner (ex.
// permission redemandee, cle de service worker renouvelee) sans creer de
// doublon — on rafraichit simplement `push_token` et `last_seen`.
export async function upsertDevice(userId: string, input: SubscribeInput): Promise<void> {
  await pool.query(
    `INSERT INTO devices (user_id, endpoint, push_token, platform, last_seen)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id, endpoint)
     DO UPDATE SET push_token = EXCLUDED.push_token, platform = EXCLUDED.platform, last_seen = now()`,
    [userId, input.endpoint, JSON.stringify(input), input.platform ?? null],
  )
}

// Desinscription explicite depuis Settings.tsx (toggle desactive).
export async function deleteDevice(userId: string, endpoint: string): Promise<void> {
  await pool.query('DELETE FROM devices WHERE user_id = $1 AND endpoint = $2', [userId, endpoint])
}

// Nettoyage automatique quand le service push signale un abonnement expire
// ou revoque (voir push.service.ts, statusCode 404/410) — l'utilisateur n'a
// pas besoin d'agir, le navigateur a deja invalide l'endpoint de son cote.
export async function deleteDeviceByEndpoint(endpoint: string): Promise<void> {
  await pool.query('DELETE FROM devices WHERE endpoint = $1', [endpoint])
}

export async function listDevicesForUser(userId: string): Promise<DeviceRow[]> {
  const result = await pool.query<DeviceRow>('SELECT * FROM devices WHERE user_id = $1', [userId])
  return result.rows
}
