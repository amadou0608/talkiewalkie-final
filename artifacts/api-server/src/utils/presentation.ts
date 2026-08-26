// Petits helpers de presentation partages par les reponses API.
// La vraie presence temps reel (en ligne/absent/hors ligne via WebSocket)
// arrive en Phase 5 ; pour l'instant on derive un libelle simple depuis
// `last_seen` et `is_online`.

const AVATAR_PALETTE = ['#3FAFA6', '#F0A233', '#8B7CD8', '#4F9DDE', '#E1594F', '#6BBF8A']

// Couleur deterministe a partir de l'identifiant (meme utilisateur = meme
// couleur a chaque appel, sans avoir besoin de la stocker). Remplace
// `avatar_url` tant que l'upload d'avatar n'existe pas.
export function avatarColorFor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

export function relativeLastSeen(lastSeen: Date, isOnline: boolean): string {
  if (isOnline) return 'en ligne'

  const diffMs = Date.now() - lastSeen.getTime()
  const diffMin = Math.floor(diffMs / 60_000)

  if (diffMin < 1) return 'a l\'instant'
  if (diffMin < 60) return `il y a ${diffMin} min`

  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `il y a ${diffH} h`

  const diffDays = Math.floor(diffH / 24)
  if (diffDays === 1) return 'hier'
  return `il y a ${diffDays} j`
}
