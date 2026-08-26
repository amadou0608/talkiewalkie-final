import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, QrCode, Search, UserCheck } from 'lucide-react'
import Avatar from '@/components/Avatar'
import StatusDot from '@/components/StatusDot'
import { apiSearchUser } from '@/lib/contactsApi'
import { AuthApiError } from '@/lib/authApi'
import { useContacts } from '@/context/ContactsContext'
import type { User } from '@/types'

type SearchState = 'idle' | 'loading' | 'found' | 'not-found' | 'error'

export default function AddContact() {
  const navigate = useNavigate()
  const { addContact } = useContacts()
  const [query, setQuery] = useState('')
  const [state, setState] = useState<SearchState>('idle')
  const [result, setResult] = useState<User | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState(false)

  const search = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setAdded(false)
    setErrorMessage(null)
    setState('loading')
    try {
      const user = await apiSearchUser(query)
      setResult(user)
      setState(user ? 'found' : 'not-found')
    } catch (err) {
      // Ex. tentative de se rechercher soi-meme -> CANNOT_ADD_SELF.
      setErrorMessage(err instanceof AuthApiError ? err.message : 'Recherche impossible pour le moment.')
      setState('error')
    }
  }

  const handleAdd = async () => {
    if (!result) return
    setAdding(true)
    setErrorMessage(null)
    try {
      await addContact(result.username)
      setAdded(true)
    } catch (err) {
      setErrorMessage(err instanceof AuthApiError ? err.message : "Impossible d'ajouter ce contact.")
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="min-h-screen pb-10">
      <header className="safe-top flex items-center gap-3 border-b border-line px-5 pt-4 pb-3">
        <button
          onClick={() => navigate(-1)}
          aria-label="Retour"
          className="rounded-full p-2 text-paperDim hover:text-paper hover:bg-panel2"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-display text-xl font-semibold text-paper">Ajouter un contact</h1>
      </header>

      <main className="mx-auto max-w-md px-5 pt-6">
        <form onSubmit={search} className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2.5">
          <Search size={16} className="text-paperDim" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Entrez @identifiant, ex. @moussa_diop"
            className="callsign w-full bg-transparent text-sm text-paper placeholder:text-paperDim outline-none"
            autoFocus
          />
        </form>
        <button
          type="submit"
          onClick={search}
          disabled={state === 'loading'}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-transmit py-3 text-center font-display text-sm font-semibold text-ink transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          {state === 'loading' && <Loader2 size={16} className="animate-spin" />}
          Rechercher
        </button>

        <button
          type="button"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-sm text-paperDim transition-colors hover:bg-panel2"
        >
          <QrCode size={16} />
          Scanner un QR code
        </button>

        {state === 'not-found' && (
          <p className="mt-6 text-center text-sm text-paperDim">
            Aucun utilisateur ne correspond a « {query} ».
          </p>
        )}

        {state === 'error' && errorMessage && (
          <p className="mt-6 text-center text-sm text-alert">{errorMessage}</p>
        )}

        {state === 'found' && result && (
          <div className="mt-6 rounded-xl border border-line bg-panel p-4">
            <div className="flex items-center gap-3">
              <Avatar name={result.displayName} color={result.avatarColor} size={48} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-semibold text-paper">{result.displayName}</p>
                <p className="callsign truncate text-xs text-paperDim">@{result.username}</p>
                <StatusDot status={result.status} showLabel />
              </div>
            </div>
            {errorMessage && added === false && (
              <p className="mt-3 text-center text-sm text-alert">{errorMessage}</p>
            )}
            <button
              disabled={added || adding}
              onClick={handleAdd}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-signal py-2.5 font-display text-sm font-semibold text-ink transition-opacity disabled:opacity-60"
            >
              {adding ? <Loader2 size={16} className="animate-spin" /> : <UserCheck size={16} />}
              {added ? 'Ajoute aux contacts' : 'Ajouter aux contacts'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
