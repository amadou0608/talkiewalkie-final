// Stockage disque des messages vocaux — Phase 8 (sections 3, 4, 10 et 13 du
// cahier des charges).
//
// MVP : fichiers stockes localement sur le disque du serveur applicatif,
// jamais servis en statique direct (section 13 : "limitation des fichiers
// audio" + section 14, confidentialite) — aucune URL publique/devinable
// n'existe pour un vocal. L'acces passe systematiquement par
// GET /voice-messages/:id/audio (voice-messages.controller.ts), qui verifie
// que le demandeur est bien l'expediteur ou le destinataire avant de
// streamer le contenu.
//
// Limite connue (a documenter au README) : un stockage local ne survit pas a
// un redeploiement sans disque persistant, et ne scale pas au-dela d'une
// seule instance serveur. Un stockage objet (S3-compatible) serait le choix
// naturel pour la production — le remplacement se limite a ce fichier, le
// reste du module (service/controller) ne connait que `relativePath`.
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

// backend/src/modules/voice-messages -> backend/ (3 niveaux), coherent que
// le code tourne via tsx (src/) ou compile (dist/) : meme profondeur dans
// les deux cas (voir tsconfig.json, rootDir "src" / outDir "dist").
const UPLOADS_ROOT = path.join(__dirname, '..', '..', '..', 'uploads', 'voice-messages')

fs.mkdirSync(UPLOADS_ROOT, { recursive: true })

const EXTENSION_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
}

function extensionFor(mimeType: string): string {
  // Le navigateur peut suffixer des parametres (ex. "audio/webm;codecs=opus").
  const base = mimeType.split(';')[0].trim().toLowerCase()
  return EXTENSION_BY_MIME[base] ?? 'bin'
}

// Ecrit le buffer recu sur le disque et renvoie le chemin RELATIF a stocker
// en base (jamais le chemin absolu, pour rester portable entre
// environnements/deploiements). Le nom de fichier est toujours genere cote
// serveur (UUID) : ne jamais faire confiance a un nom fourni par le client
// (section 13 : validation stricte des entrees, protection traversal).
export function saveVoiceMessageFile(buffer: Buffer, mimeType: string): { relativePath: string } {
  const filename = `${randomUUID()}.${extensionFor(mimeType)}`
  fs.writeFileSync(path.join(UPLOADS_ROOT, filename), buffer)
  return { relativePath: filename }
}

export function absolutePathFor(relativePath: string): string {
  // path.basename empeche toute tentative de traversal (ex. "../../etc")
  // meme si relativePath venait un jour d'une source moins fiable qu'une
  // valeur que nous avons nous-memes generee via randomUUID() ci-dessus.
  return path.join(UPLOADS_ROOT, path.basename(relativePath))
}

export function deleteVoiceMessageFile(relativePath: string): void {
  try {
    fs.unlinkSync(absolutePathFor(relativePath))
  } catch {
    // Deja absent : sans consequence (ex. nettoyage rejoue apres echec DB).
  }
}
