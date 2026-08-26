// Notifications Web Push — Phase 9 (section 11 du cahier des charges).
// Attend que le service worker unique de l'app (src/sw.ts, enregistre par
// usePWAUpdate.ts via virtual:pwa-register — Phase 10) soit actif, puis
// gere l'abonnement PushManager du navigateur. Ne l'enregistre plus
// lui-meme (jusqu'a Phase 9 : public/push-sw.js, desormais fusionne dans
// src/sw.ts pour n'avoir qu'un seul service worker sur la scope '/').
// Section 11 : "Les notifications doivent respecter les permissions du
// navigateur. Ne jamais contourner les permissions de notification" —
// Notification.requestPermission() n'est donc jamais appele
// automatiquement, seulement depuis subscribe(), a l'initiative explicite
// de l'utilisateur (toggle dans Settings.tsx).
import { useCallback, useEffect, useState } from 'react'
import { apiGetPushPublicKey, apiSubscribePush, apiUnsubscribePush } from '@/lib/pushApi'

const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4)
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const buffer = new ArrayBuffer(raw.length)
  const bytes = new Uint8Array(buffer)
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index)
  }
  return bytes
}

function detectPlatform(): string {
  if (typeof navigator === 'undefined') return 'web'
  const ua = navigator.userAgent
  if (/android/i.test(ua)) return 'android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios'
  return 'web'
}

interface UsePushNotifications {
  supported: boolean
  permission: NotificationPermission
  subscribed: boolean
  loading: boolean
  error: string | null
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
}

export function usePushNotifications(): UsePushNotifications {
  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'denied',
  )
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Etat initial : on attend que le service worker de l'app devienne actif
  // (sans demander la permission) pour pouvoir lire un abonnement deja
  // existant (ex. l'utilisateur l'a active lors d'une session precedente).
  // `serviceWorker.ready` se resout des qu'UN service worker controle la
  // page, quel que soit le composant qui a declenche son enregistrement
  // (usePWAUpdate.ts, monte dans App.tsx) — pas de course possible entre
  // les deux hooks.
  useEffect(() => {
    if (!supported) return
    let cancelled = false

    navigator.serviceWorker.ready
      .then(async (registration) => {
        const existing = await registration.pushManager.getSubscription()
        if (!cancelled) setSubscribed(!!existing)
      })
      .catch(() => {
        // Service worker jamais devenu actif (ex. navigateur trop ancien
        // malgre la detection ci-dessus) : le toggle restera visible mais
        // desactive via `supported`/`error` au premier subscribe().
      })

    return () => {
      cancelled = true
    }
  }, [])

  const subscribe = useCallback(async () => {
    if (!supported) {
      setError('Notifications non supportees par ce navigateur.')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setError('Permission refusee. Activez les notifications dans les reglages du navigateur.')
        return
      }

      const { enabled, publicKey } = await apiGetPushPublicKey()
      if (!enabled || !publicKey) {
        setError('Notifications push non configurees cote serveur.')
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }))

      await apiSubscribePush(subscription.toJSON() as PushSubscriptionJSON, detectPlatform())
      setSubscribed(true)
    } catch {
      setError("Impossible d'activer les notifications.")
    } finally {
      setLoading(false)
    }
  }, [])

  const unsubscribe = useCallback(async () => {
    if (!supported) return

    setLoading(true)
    setError(null)
    try {
      const registration = await navigator.serviceWorker.ready
      const existing = await registration.pushManager.getSubscription()
      if (existing) {
        await apiUnsubscribePush(existing.endpoint)
        await existing.unsubscribe()
      }
      setSubscribed(false)
    } catch {
      setError('Impossible de desactiver les notifications.')
    } finally {
      setLoading(false)
    }
  }, [])

  return { supported, permission, subscribed, loading, error, subscribe, unsubscribe }
}
