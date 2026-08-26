import { useState } from 'react'
import BackHeader from '@/components/BackHeader'
import ToggleRow from '@/components/ToggleRow'
import type { PrivacySettings } from '@/types'

export default function Privacy() {
  const [settings, setSettings] = useState<PrivacySettings>({
    whoCanAddMe: 'everyone',
    whoCanCall: 'contacts',
    showStatus: true,
    searchableByPhone: false,
  })

  return (
    <div className="min-h-screen pb-10">
      <BackHeader title="Confidentialite" />
      <main className="mx-auto max-w-md px-5 pt-6 space-y-6">
        <section>
          <p className="callsign mb-2 text-[11px] uppercase tracking-widest text-paperDim">Qui peut m'ajouter</p>
          <div className="overflow-hidden rounded-xl border border-line bg-panel">
            {(['everyone', 'phone-contacts', 'nobody'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setSettings((s) => ({ ...s, whoCanAddMe: opt }))}
                className="flex w-full items-center justify-between border-b border-line px-4 py-3 last:border-0 hover:bg-panel2"
              >
                <span className="text-sm text-paper">
                  {opt === 'everyone' ? 'Tout le monde' : opt === 'phone-contacts' ? 'Mes contacts telephoniques' : 'Personne'}
                </span>
                <span className={`h-4 w-4 rounded-full border ${settings.whoCanAddMe === opt ? 'border-transmit bg-transmit' : 'border-line'}`} />
              </button>
            ))}
          </div>
        </section>

        <section className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
          <ToggleRow
            label="Afficher mon statut"
            description="En ligne / absent / hors ligne, visible par vos contacts"
            checked={settings.showStatus}
            onChange={(v) => setSettings((s) => ({ ...s, showStatus: v }))}
          />
          <ToggleRow
            label="Recherche par numero"
            description="Permettre de me trouver via mon numero de telephone"
            checked={settings.searchableByPhone}
            onChange={(v) => setSettings((s) => ({ ...s, searchableByPhone: v }))}
          />
        </section>

        <p className="text-xs text-paperDim">
          Talkie ne partage jamais votre position GPS. La communication repose sur Internet, pas sur la proximite geographique.
        </p>
      </main>
    </div>
  )
}
