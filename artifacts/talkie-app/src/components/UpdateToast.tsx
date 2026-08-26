// Bandeau "nouvelle version" / "pret hors ligne" — Phase 10 (section 15).
// Volontairement discret et sans blocage : la mise a jour n'est jamais
// appliquee sans action explicite (voir usePWAUpdate.ts).
import { usePWAUpdate } from '@/hooks/usePWAUpdate'

export default function UpdateToast() {
  const { needRefresh, offlineReady, dismissNeedRefresh, dismissOfflineReady, applyUpdate } = usePWAUpdate()

  if (!needRefresh && !offlineReady) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 px-4">
      <div className="pointer-events-auto mx-auto flex max-w-md items-center justify-between gap-3 rounded-xl border border-line bg-panel2 px-4 py-3 shadow-lg">
        <p className="text-sm text-paper">
          {needRefresh ? 'Nouvelle version de Talkie disponible.' : 'Talkie est pret pour une utilisation hors ligne.'}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {needRefresh && (
            <button
              onClick={applyUpdate}
              className="rounded-lg bg-signal px-3 py-1.5 text-xs font-medium text-ink"
            >
              Mettre a jour
            </button>
          )}
          <button
            onClick={needRefresh ? dismissNeedRefresh : dismissOfflineReady}
            className="rounded-lg px-2 py-1.5 text-xs text-paperDim"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
