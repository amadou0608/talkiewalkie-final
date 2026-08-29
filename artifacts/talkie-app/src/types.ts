// Types partages de l'application Talkie.
// Phase 1 : ces types decrivent des donnees fictives (mock).
// Phase 3+ : ils correspondront aux reponses de l'API backend (voir /backend).

export type PresenceStatus = 'online' | 'away' | 'offline'

export interface User {
  id: string
  username: string       // identifiant public, ex: "saugui_47291"
  displayName: string
  avatarColor: string    // teinte generee pour l'avatar (pas d'upload en phase 1)
  avatarUrl?: string      // Phase 20 : photo de profil uploadee, remplace avatarColor si presente
  bio: string             // Phase 20 : statut/bio texte
  phoneNumber?: string
  status: PresenceStatus
  lastSeen: string        // libelle relatif, ex: "il y a 2 min"
}

export type ContactRelation = 'accepted' | 'pending' | 'blocked'

export interface Contact {
  user: User
  relation: ContactRelation
  favorite?: boolean
}

// Phase 8 : forme telle que renvoyee par GET /voice-messages (backend). Le
// destinataire est toujours l'utilisateur courant (implicite, pas besoin de
// le repeter) — seul l'expediteur est utile a afficher cote reception.
export interface VoiceMessage {
  id: string
  sender: User
  durationSec: number
  createdAt: string
  deliveredAt: string | null
  listenedAt: string | null
}

export type ChatMessageStatus = 'sent' | 'delivered' | 'read'

export interface ChatMessageUser {
  id: string
  username: string
  displayName: string
  avatarColor: string
  avatarUrl?: string
}

export interface ChatMessage {
  id: string
  senderId: string
  receiverId: string
  type: 'text' | 'voice' | 'image' | 'video'
  content: string | null
  fileUrl: string | null
  durationSec: number | null
  status: ChatMessageStatus
  createdAt: string
  editedAt: string | null
  deletedAt: string | null
  sender: ChatMessageUser
  receiver: ChatMessageUser
}

export interface PrivacySettings {
  whoCanAddMe: 'everyone' | 'phone-contacts' | 'nobody'
  whoCanCall: 'contacts' | 'everyone'
  showStatus: boolean
  searchableByPhone: boolean
}
export interface MessageEditHistoryEntry {
  previousContent: string | null
  editedAt: string
}
