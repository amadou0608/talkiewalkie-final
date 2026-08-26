/// <reference lib="webworker" />
// Service worker unique — Phase 10 (section 15 du cahier des charges).
//
// Fusionne deux perimetres volontairement tenus separes jusqu'ici (voir
// Phase 9) :
//  - le cache de l'app shell (JS/CSS/HTML/icones) pour le mode installable
//    et une ouverture correcte hors ligne ;
//  - les notifications Web Push (anciennement public/push-sw.js).
// Une seule scope ('/') ne peut avoir qu'un service worker actif a la fois :
// enregistrer les deux fichiers separement aurait fait que le second
// ecrase le premier au lieu de coexister. D'ou la strategie
// `injectManifest` (voir vite.config.ts) plutot que `generateSW` : elle
// laisse ecrire ce fichier a la main tout en injectant automatiquement,
// au build, la liste des fichiers a precacher.
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'

declare const self: ServiceWorkerGlobalScope

// --- App shell (cache essentiel — section 15) ------------------------------

// Liste injectee au build par vite-plugin-pwa. Les appels API/WebSocket
// vers le backend (VITE_API_URL / VITE_WS_URL, autre origine) ne passent
// jamais par ce cache : seules les ressources statiques de l'app shell
// servie depuis cette origine sont concernees.
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Navigation (ouverture de l'app / changement de page) : reseau prioritaire
// pour avoir la derniere version quand la connexion est bonne, repli sur
// l'app shell precache sinon. Ecran blanc impossible, meme hors ligne —
// mais sans connexion les donnees (contacts, messages, appel) restent
// indisponibles : seule la coquille de l'app s'affiche, comme prevu section
// 15 ("cache des ressources essentielles", pas un mode hors-ligne complet).
registerRoute(new NavigationRoute(new NetworkFirst({ cacheName: 'talkie-pages' })))

// Polices Google Fonts : mise en cache best-effort, jamais bloquante pour
// le premier affichage.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({ cacheName: 'talkie-fonts' }),
)

self.skipWaiting()
self.clients.claim()

// --- Notifications Web Push (Phase 9, section 11) --------------------------
// Logique inchangee depuis public/push-sw.js (desormais supprime), deplacee
// ici pour ne garder qu'un seul service worker actif sur la scope '/'.

interface PushPayload {
  title: string
  body: string
  url: string
  tag?: string
}

self.addEventListener('push', (event: PushEvent) => {
  let data: PushPayload = { title: 'Talkie', body: 'Nouvelle notification.', url: '/' }

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() }
    } catch {
      // Payload non-JSON : on garde le titre par defaut, le texte brut sert
      // de corps.
      data.body = event.data.text()
    }
  }

  const options: NotificationOptions = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'talkie-notification',
    data: { url: data.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(data.title, options))
})

// Ramene l'utilisateur sur l'onglet Talkie existant plutot que d'en ouvrir
// un nouveau a chaque notification, quand c'est possible.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ('focus' in client) {
          if ('navigate' in client) (client as WindowClient).navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
      return undefined
    }),
  )
})
