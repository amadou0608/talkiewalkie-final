import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Moon, Sun, Smartphone, Download, CheckCircle2 } from 'lucide-react'
import BackHeader from '@/components/BackHeader'
import ToggleRow from '@/components/ToggleRow'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

export default function Settings() {
  const [noiseReduction, setNoiseReduction] = useState(true)
  const [darkMode] = useState(true) // theme sombre par defaut

  // Notifications push : reglage reel, backe par le PushManager du
  // navigateur + le backend (voir usePushNotifications.ts).
  const push = usePushNotifications()
  const handlePushToggle = (v: boolean) => {
    if (v) push.subscribe()
    else push.unsubscribe()
  }

  // Phase 10 (section 15) : installation PWA depuis Chrome/Android.
  const { canInstall, installed, promptInstall } = useInstallPrompt()

  return (
    <div className="min-h-screen pb-10">
      <BackHeader title="Parametres" />

      <main className="mx-auto max-w-md px-5 pt-6 space-y-6">
        <section>
          <p className="callsign mb-2 text-[11px] uppercase tracking-widest text-paperDim">Communication</p>
          <div className="overflow-hidden rounded-xl border border-line bg-panel">
            <ToggleRow
              label="Reduction de bruit"
              description="Préférence audio conservée pour le module vocal du chat"
              checked={noiseReduction}
              onChange={setNoiseReduction}
            />
          </div>
        </section>

        <section>
          <p className="callsign mb-2 text-[11px] uppercase tracking-widest text-paperDim">Notifications</p>
          <div className="overflow-hidden rounded-xl border border-line bg-panel">
            <ToggleRow
              label="Notifications push"
              description={
                push.supported
                  ? 'Messages vocaux et appels recus quand l\u2019app est fermee'
                  : 'Non supportees par ce navigateur'
              }
              checked={push.subscribed}
              onChange={handlePushToggle}
            />
          </div>
          {push.loading && <p className="mt-2 text-xs text-paperDim">Mise a jour en cours...</p>}
          {push.error && <p className="mt-2 text-xs text-alert">{push.error}</p>}
        </section>

        {(canInstall || installed) && (
          <section>
            <p className="callsign mb-2 text-[11px] uppercase tracking-widest text-paperDim">Application</p>
            <div className="rounded-xl border border-line bg-panel p-4">
              {installed ? (
                <p className="flex items-center gap-2 text-sm text-paper">
                  <CheckCircle2 size={16} className="text-signal" />
                  Talkie est installe sur cet appareil
                </p>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-paper">Installer Talkie</p>
                    <p className="text-xs text-paperDim">Ouvre l'app depuis l'ecran d'accueil, comme une app native</p>
                  </div>
                  <button
                    onClick={promptInstall}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg bg-signal px-3 py-2 text-xs font-medium text-ink"
                  >
                    <Download size={14} />
                    Installer
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        <section>
          <p className="callsign mb-2 text-[11px] uppercase tracking-widest text-paperDim">Apparence</p>
          <div className="flex items-center gap-3 rounded-xl border border-line bg-panel p-3">
            <button className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg py-2.5 ${darkMode ? 'bg-panel2 text-paper' : 'text-paperDim'}`}>
              <Moon size={18} />
              <span className="text-xs">Sombre</span>
            </button>
            <button className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg py-2.5 ${!darkMode ? 'bg-panel2 text-paper' : 'text-paperDim'}`}>
              <Sun size={18} />
              <span className="text-xs">Clair</span>
            </button>
            <button className="flex flex-1 flex-col items-center gap-1.5 rounded-lg py-2.5 text-paperDim">
              <Smartphone size={18} />
              <span className="text-xs">Systeme</span>
            </button>
          </div>
        </section>

        <section>
          <p className="callsign mb-2 text-[11px] uppercase tracking-widest text-paperDim">Compte</p>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
            <li>
              <Link to="/privacy" className="flex items-center justify-between px-4 py-3.5 hover:bg-panel2">
                <span className="text-sm text-paper">Confidentialite</span>
                <ChevronRight size={16} className="text-paperDim" />
              </Link>
            </li>
            <li>
              <Link to="/blocked" className="flex items-center justify-between px-4 py-3.5 hover:bg-panel2">
                <span className="text-sm text-paper">Utilisateurs bloques</span>
                <ChevronRight size={16} className="text-paperDim" />
              </Link>
            </li>
          </ul>
        </section>

        <p className="text-center text-xs text-paperDim">Talkie Chat — Phase 13 · messagerie en préparation</p>
      </main>
    </div>
  )
}
