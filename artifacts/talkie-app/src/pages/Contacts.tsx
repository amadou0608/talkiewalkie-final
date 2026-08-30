import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BellOff, Bell, Search, ShieldOff, Trash2, UserPlus, Loader2 } from 'lucide-react'
import TopBar from '@/components/TopBar'
import BottomNav from '@/components/BottomNav'
import Avatar from '@/components/Avatar'
import StatusDot from '@/components/StatusDot'
import { useContacts } from '@/context/ContactsContext'

export default function Contacts() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { accepted, pending, loading, error, removeContact, blockContact, toggleReadReceipts } = useContacts()
  // Evite qu'un double-tap declenche deux appels DELETE/block pour le meme contact.
  const [pendingActionId, setPendingActionId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matchesQuery = (name: string, username: string) =>
      !q || name.toLowerCase().includes(q) || username.toLowerCase().includes(q)

    return {
      accepted: accepted.filter((c) => matchesQuery(c.user.displayName, c.user.username)),
      pending: pending.filter((c) => matchesQuery(c.user.displayName, c.user.username)),
    }
  }, [query, accepted, pending])

  const handleRemove = async (contactUserId: string) => {
    setPendingActionId(contactUserId)
    try {
      await removeContact(contactUserId)
    } finally {
      setPendingActionId(null)
    }
  }

  const handleBlock = async (contactUserId: string) => {
    setPendingActionId(contactUserId)
    try {
      await blockContact(contactUserId)
    } finally {
      setPendingActionId(null)
    }
  }

  const handleToggleReadReceipts = async (contactUserId: string, currentlyHidden: boolean | undefined) => {
    setPendingActionId(contactUserId)
    try {
      await toggleReadReceipts(contactUserId, !currentlyHidden)
    } finally {
      setPendingActionId(null)
    }
  }

  return (
    <div className="min-h-screen pb-24">
      <TopBar title="Contacts" eyebrow={`${accepted.length} contact${accepted.length > 1 ? 's' : ''}`} />

      <main className="mx-auto max-w-md px-5 pt-4">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2.5">
            <Search size={16} className="text-paperDim" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un contact"
              className="w-full bg-transparent text-sm text-paper placeholder:text-paperDim outline-none"
            />
          </div>
          <Link
            to="/contacts/add"
            aria-label="Ajouter un contact"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-transmit text-ink transition-transform active:scale-95"
          >
            <UserPlus size={20} />
          </Link>
        </div>

        {loading && (
          <div className="mt-10 flex items-center justify-center gap-2 text-sm text-paperDim">
            <Loader2 size={16} className="animate-spin" />
            Chargement des contacts...
          </div>
        )}

        {!loading && error && (
          <div className="mt-6 rounded-xl border border-alert/30 bg-alert/10 px-4 py-3 text-center text-sm text-paper">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {filtered.pending.length > 0 && (
              <section className="mt-6">
                <p className="callsign mb-2 text-[11px] uppercase tracking-widest text-paperDim">En attente</p>
                <ul className="divide-y divide-line rounded-xl border border-line bg-panel">
                  {filtered.pending.map((c) => (
                    <li key={c.user.id} className="flex items-center gap-3 px-4 py-3">
                      <Avatar name={c.user.displayName} color={c.user.avatarColor} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm font-medium text-paper">{c.user.displayName}</p>
                        <p className="callsign truncate text-xs text-paperDim">@{c.user.username} · {c.user.lastSeen}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-6">
              <p className="callsign mb-2 text-[11px] uppercase tracking-widest text-paperDim">Tous les contacts</p>
              {filtered.accepted.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
                  <p className="text-sm text-paperDim">
                    {query ? <>Aucun contact ne correspond a « {query} ».</> : 'Aucun contact pour le moment. Ajoutez-en un avec le bouton +.'}
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line bg-panel">
                  {filtered.accepted.map((c) => (
                    <li key={c.user.id} className="flex items-center gap-2 px-4 py-3">
                      <button
                        onClick={() => navigate(`/talk/${c.user.id}`)}
                        className="flex flex-1 min-w-0 items-center gap-3 text-left"
                      >
                        <Avatar name={c.user.displayName} color={c.user.avatarColor} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display text-sm font-medium text-paper">{c.user.displayName}</p>
                          <p className="callsign truncate text-xs text-paperDim">@{c.user.username}</p>
                        </div>
                        <StatusDot status={c.user.status} />
                      </button>
                      <button
                        onClick={() => handleToggleReadReceipts(c.user.id, c.hideReadReceipts)}
                        disabled={pendingActionId === c.user.id}
                        aria-label={
                          c.hideReadReceipts
                            ? `Reactiver les accuses de lecture pour ${c.user.displayName}`
                            : `Masquer les accuses de lecture pour ${c.user.displayName}`
                        }
                        title={c.hideReadReceipts ? 'Accuses de lecture masques' : 'Accuses de lecture visibles'}
                        className={`rounded-full p-2 transition-colors hover:bg-panel2 disabled:opacity-50 ${
                          c.hideReadReceipts ? 'text-transmit' : 'text-paperDim'
                        }`}
                      >
                        {c.hideReadReceipts ? <BellOff size={16} /> : <Bell size={16} />}
                      </button>
                      <button
                        onClick={() => handleBlock(c.user.id)}
                        disabled={pendingActionId === c.user.id}
                        aria-label={`Bloquer ${c.user.displayName}`}
                        className="rounded-full p-2 text-paperDim transition-colors hover:bg-panel2 hover:text-alert disabled:opacity-50"
                      >
                        <ShieldOff size={16} />
                      </button>
                      <button
                        onClick={() => handleRemove(c.user.id)}
                        disabled={pendingActionId === c.user.id}
                        aria-label={`Supprimer ${c.user.displayName}`}
                        className="rounded-full p-2 text-paperDim transition-colors hover:bg-panel2 hover:text-alert disabled:opacity-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
         }
