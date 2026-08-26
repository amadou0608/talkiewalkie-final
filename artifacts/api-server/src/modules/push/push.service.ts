// Envoi des notifications Web Push — Phase 9 (section 11 du cahier des
// charges). Declenche par voice-messages.controller.ts ("Nouveau message
// vocal de Moussa") ("Saugui essaie de vous
// contacter"), uniquement quand le destinataire n'a aucun socket actif
// (voir hasActiveSocket dans realtime/socket.ts) : un utilisateur deja
// connecte recoit deja l'evenement temps reel correspondant, une
// notification systeme en plus serait redondante.
import webpush from 'web-push'
import { env } from '../../env'
import { deleteDeviceByEndpoint, listDevicesForUser } from './push.repository'

const enabled = Boolean(env.webPushPublicKey && env.webPushPrivateKey)

if (enabled) {
  webpush.setVapidDetails(env.webPushContactEmail, env.webPushPublicKey, env.webPushPrivateKey)
} else {
  // Ne bloque pas le demarrage du serveur (voir env.ts) : juste un
  // avertissement, les autres phases fonctionnent sans push configure.
  console.warn(
    '[push] WEB_PUSH_PUBLIC_KEY / WEB_PUSH_PRIVATE_KEY absents — notifications push desactivees. ' +
      'Generez des cles avec `npm run vapid:generate` (voir README).',
  )
}

export function isPushEnabled(): boolean {
  return enabled
}

export function getPublicKey(): string {
  return env.webPushPublicKey
}

export interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
}

// Envoie a tous les appareils enregistres de l'utilisateur (section 4 :
// plusieurs devices possibles). Les echecs sur un appareil n'empechent pas
// l'envoi aux autres.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!enabled) return

  const devices = await listDevicesForUser(userId)
  if (devices.length === 0) return

  await Promise.all(
    devices.map(async (device) => {
      try {
        await webpush.sendNotification(device.push_token as unknown as webpush.PushSubscription, JSON.stringify(payload))
      } catch (err) {
        const statusCode = (err as { statusCode?: number })?.statusCode
        if (statusCode === 404 || statusCode === 410) {
          // Abonnement expire ou revoque cote navigateur : on nettoie plutot
          // que de reessayer indefiniment (section 13, pas d'echec silencieux
          // qui s'accumule en base).
          await deleteDeviceByEndpoint(device.endpoint).catch(() => {})
        } else {
          console.error('[push] echec envoi notification', statusCode ?? err)
        }
      }
    }),
  )
}
