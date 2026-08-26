// Suivi de mise a jour du service worker — Phase 10 (section 15).
//
// Utilise le hook fourni par vite-plugin-pwa (virtual:pwa-register/react)
// plutot que registerType: 'autoUpdate' : un rechargement silencieux en
// pleine communication vocale (WebRTC) casserait l'appel en cours. On
// prevu ici seulement l'etat ; c'est UpdateToast.tsx qui laisse
// l'utilisateur choisir le moment.
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1h — l'app peut rester ouverte longtemps en arriere-plan sur mobile

export function usePWAUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => {
        registration.update().catch(() => {
          // Verification de mise a jour non critique : on retentera au
          // prochain intervalle.
        })
      }, UPDATE_CHECK_INTERVAL_MS)
    },
  })

  return {
    needRefresh,
    offlineReady,
    dismissNeedRefresh: () => setNeedRefresh(false),
    dismissOfflineReady: () => setOfflineReady(false),
    applyUpdate: () => updateServiceWorker(true),
  }
}
