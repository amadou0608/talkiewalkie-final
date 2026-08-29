import { useEffect, useState } from 'react'
import { apiListContacts } from '@/lib/contactsApi'
import type { Contact } from '@/types'
import type { StoryVisibilityMode, StoryType } from '@/lib/storiesApi'

interface StoryVisibilityPickerProps {
  storyType: StoryType
  onConfirm: (mode: StoryVisibilityMode, targetUserIds: string[], content: string) => void
  onCancel: () => void
}

export default function StoryVisibilityPicker({ storyType, onConfirm, onCancel }: StoryVisibilityPickerProps) {
  const [mode, setMode] = useState<StoryVisibilityMode>('all')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [content, setContent] = useState('')

  useEffect(() => {
    let cancelled = false
    apiListContacts()
      .then(({ accepted }) => {
        if (!cancelled) setContacts(accepted)
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger vos contacts.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function toggleContact(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  function handleModeChange(newMode: StoryVisibilityMode) {
    setMode(newMode)
    setSelectedIds(new Set())
  }

  function handleConfirm() {
    onConfirm(mode, Array.from(selectedIds), content.trim())
  }

  const needsContactPicker = mode === 'except' || mode === 'only'
  const textRequired = storyType === 'text' && content.trim().length === 0
  const confirmDisabled = textRequired || (needsContactPicker && selectedIds.size === 0)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-neutral-900 p-4 sm:rounded-2xl">
        <h2 className="mb-4 text-lg font-semibold text-white">
          {storyType === 'text' ? 'Ecrire un statut' : 'Qui peut voir cette story ?'}
        </h2>

        {storyType === 'text' && (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={280}
            rows={4}
            placeholder="Ecrivez votre statut..."
            className="mb-4 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
          />
        )}
        {storyType !== 'text' && (
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={280}
            placeholder="Ajouter une legende (optionnel)"
            className="mb-4 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
          />
        )}

        <div className="mb-4 space-y-2">
          <label className="flex items-center gap-3 rounded-lg p-2 hover:bg-neutral-800">
            <input
              type="radio"
              name="visibilityMode"
              checked={mode === 'all'}
              onChange={() => handleModeChange('all')}
            />
            <span className="text-white">Tout le monde</span>
          </label>
          <label className="flex items-center gap-3 rounded-lg p-2 hover:bg-neutral-800">
            <input
              type="radio"
              name="visibilityMode"
              checked={mode === 'except'}
              onChange={() => handleModeChange('except')}
            />
            <span className="text-white">Tout le monde sauf...</span>
          </label>
          <label className="flex items-center gap-3 rounded-lg p-2 hover:bg-neutral-800">
            <input
              type="radio"
              name="visibilityMode"
              checked={mode === 'only'}
              onChange={() => handleModeChange('only')}
            />
            <span className="text-white">Seulement...</span>
          </label>
        </div>

        {needsContactPicker && (
          <div className="mb-4 max-h-64 overflow-y-auto rounded-lg border border-neutral-800">
            {loading && <p className="p-3 text-sm text-neutral-400">Chargement des contacts…</p>}
            {error && <p className="p-3 text-sm text-red-400">{error}</p>}
            {!loading && !error && contacts.length === 0 && (
              <p className="p-3 text-sm text-neutral-400">Aucun contact.</p>
            )}
            {contacts.map((contact) => (
              <label
                key={contact.user.id}
                className="flex items-center gap-3 border-b border-neutral-800 p-3 last:border-b-0 hover:bg-neutral-800"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(contact.user.id)}
                  onChange={() => toggleContact(contact.user.id)}
                />
                {contact.user.avatarUrl ? (
                  <img
                    src={contact.user.avatarUrl}
                    alt={contact.user.displayName}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium text-white"
                    style={{ backgroundColor: contact.user.avatarColor }}
                  >
                    {contact.user.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-white">{contact.user.displayName}</span>
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-4 py-2 text-neutral-300 hover:bg-neutral-800"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-emerald-500"
          >
            Publier
          </button>
        </div>
      </div>
    </div>
  )
    }
