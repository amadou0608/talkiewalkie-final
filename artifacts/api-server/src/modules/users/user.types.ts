// Types utilisateur partages — extraits de auth.service.ts en Phase 4 pour
// etre reutilises par le module contacts (recherche, liste) sans dependre
// du module auth.

// Ligne brute telle que stockee (table `users`, section 4 du cahier des charges).
export interface UserRow {
  id: string
  username: string
  display_name: string
  phone_number: string | null
  avatar_url: string | null
  password_hash: string
  created_at: Date
  updated_at: Date
  last_seen: Date
  is_online: boolean
}

// Forme publique renvoyee au frontend — doit rester compatible avec le type
// `User` de src/types.ts cote client. Ne contient jamais password_hash.
export interface PublicUser {
  id: string
  username: string
  displayName: string
  avatarColor: string
  phoneNumber?: string
  status: 'online' | 'away' | 'offline'
  lastSeen: string
}
