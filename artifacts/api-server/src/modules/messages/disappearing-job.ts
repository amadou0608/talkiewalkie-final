
// Theme 2 — suppression programmee façon Signal. Balayage periodique qui
// cherche les messages dont le compte a rebours (delete_at) est arrive a
// echeance, les supprime (purgeExpiredMessages, meme effet qu'une
// suppression manuelle), efface les fichiers physiques correspondants
// (photo/video/vocal) puis notifie les deux participants de chaque
// conversation touchee pour que leur ecran se mette a jour en temps reel
// sans avoir besoin de rafraichir la page.
import { notifyUser } from '../../realtime/socket'
import { purgeExpiredMessages } from './messages.service'
import { deleteImageFile } from './messages.media'
import { deleteVideoFile } from './messages.video'
import { deleteVoiceMessageFile } from '../voice-messages/storage'

// 30s : assez frequent pour que le delai le plus court propose (30 secondes)
// reste credible sans trop attendre, sans pour autant marteler la base de
// donnees inutilement pour un evenement rare.
const SWEEP_INTERVAL_MS = 30 * 1000

async function sweepOnce() {
  try {
    const purged = await purgeExpiredMessages()
    for (const item of purged) {
      if (item.fileUrl) {
        if (item.type === 'image') deleteImageFile(item.fileUrl)
        else if (item.type === 'video') deleteVideoFile(item.fileUrl)
        else if (item.type === 'voice') deleteVoiceMessageFile(item.fileUrl)
      }
      notifyUser(item.senderId, 'message:deleted', { messageId: item.id })
      notifyUser(item.receiverId, 'message:deleted', { messageId: item.id })
    }
  } catch (err) {
    console.error('[disappearing-job] echec du balayage', err)
  }
}

export function startDisappearingMessagesJob() {
  setInterval(() => { void sweepOnce() }, SWEEP_INTERVAL_MS)
  console.log('[disappearing-job] balayage des messages programmes demarre')
          }
