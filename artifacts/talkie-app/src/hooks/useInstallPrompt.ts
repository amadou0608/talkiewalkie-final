// Detection et declenchement de l'invite d'installation PWA — Phase 10
// (section 15 : "L'utilisateur doit pouvoir faire Chrome -> Ajouter a
// l'ecran d'accueil"). Chrome/Android propose deja l'installation via une
// icone discrete de la barre d'adresse des que le manifest + service
// worker sont valides ; ce hook capture l'evenement natif pour proposer,
// en plus, un bouton explicite dans Parametres.
import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Drapeau specifique a iOS Safari. Hors perimetre principal (section 1
    // vise Chrome/Android), mais couvre gratuitement le cas ou l'app est
    // deja installee depuis cet ecran.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

interface UseInstallPrompt {
  canInstall: boolean
  installed: boolean
  promptInstall: () => Promise<boolean>
}

export function useInstallPrompt(): UseInstallPrompt {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandaloneDisplay)

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      // Empeche la mini-infobar automatique de Chrome : c'est le bouton
      // dans Parametres qui declenche prompt() a l'initiative de
      // l'utilisateur.
      event.preventDefault()
      setDeferredPrompt(event as BeforeInstallPromptEvent)
    }
    const onAppInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return false
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return outcome === 'accepted'
  }, [deferredPrompt])

  return {
    canInstall: !!deferredPrompt && !installed,
    installed,
    promptInstall,
  }
}
