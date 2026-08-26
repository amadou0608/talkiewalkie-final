import { avatarColorFor, relativeLastSeen } from '../../utils/presentation'
import type { PublicUser, UserRow } from './user.types'

// Ne jamais renvoyer password_hash au frontend (section 13 du cahier des
// charges). Tout code qui a besoin d'exposer un utilisateur doit passer par
// cette fonction plutot que de construire l'objet a la main.
export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarColor: avatarColorFor(row.username),
    phoneNumber: row.phone_number ?? undefined,
    status: row.is_online ? 'online' : 'offline',
    lastSeen: relativeLastSeen(row.last_seen, row.is_online),
  }
}
