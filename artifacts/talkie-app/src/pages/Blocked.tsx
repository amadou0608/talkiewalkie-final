import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import BackHeader from '@/components/BackHeader'
import Avatar from '@/components/Avatar'
import { useContacts } from '@/context/ContactsContext'

export default function Blocked() {
  const { blocked, refreshBlocked, unblockContact } = useContacts()
  const [loading, setLoading] = useState(true)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    refreshBlocked().finally(() => setLoading(false))
    // refreshBlocked est stable (useCallback dans ContactsContext) : pas besoin
    // de le relancer a chaque rendu, seulement au montage de la page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUnblock = async (contactUserId: string) => {
    setPendingId(contactUserId)
    try {
      await unblockContact(contactUserId)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="min-h-screen pb-10">
      <BackHeader title="Utilisateurs bloques" />
      <main className="mx-auto max-w-md px-5 pt-6">
        {loading ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-paperDim">
            <Loader2 size={16} className="animate-spin" />
            Chargement...
          </div>
        ) : blocked.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
            <p className="text-sm text-paperDim">Vous n'avez bloque personne pour le moment.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-panel">
            {blocked.map((c) => (
              <li key={c.user.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={c.user.displayName} color={c.user.avatarColor} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-medium text-paper">{c.user.displayName}</p>
                  <p className="callsign truncate text-xs text-paperDim">@{c.user.username}</p>
                </div>
                <button
                  onClick={() => handleUnblock(c.user.id)}
                  disabled={pendingId === c.user.id}
                  className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-paper transition-colors hover:bg-panel2 disabled:opacity-50"
                >
                  Debloquer
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
