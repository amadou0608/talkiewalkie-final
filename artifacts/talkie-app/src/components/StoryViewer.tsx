import { useEffect, useRef, useState } from 'react'
import { X, Trash2, Eye, Send, Pencil, History, Image as ImageIcon, Video } from 'lucide-react'
import Avatar from '@/components/Avatar'
import { resolveAvatarUrl } from '@/lib/authApi'
import { useAuth } from '@/context/AuthContext'
import {
  apiViewStory,
  apiDeleteStory,
  apiStoryViewers,
  apiEditStory,
  apiStoryEditHistory,
  type StoryGroup,
  type Story,
  type StoryViewer as Viewer,
  type StoryEditHistoryEntry,
} from '@/lib/storiesApi'
import { apiSendTextMessage } from '@/lib/messagesApi'

interface StoryViewerProps {
  groups: StoryGroup[]
  startGroupIndex: number
  onClose: () => void
}

const STORY_DURATION_MS = 5000
const EDIT_WINDOW_MS = 20 * 60 * 1000

function mediaUrl(url: string) {
  return url.startsWith('http') ? url : `${(import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '')}${url}`
}

function editRemainingMinutes(createdAt: string) {
  const remaining = EDIT_WINDOW_MS - (Date.now() - new Date(createdAt).getTime())
  return remaining > 0 ? Math.ceil(remaining / 60000) : 0
}

// Viewer plein ecran facon WhatsApp/Instagram : barres de progression en
// haut, tap gauche/droite pour naviguer, defile automatiquement (Phase 21).
// Phase 22 : compteur "vu par", pause pendant la liste des vus.
// Phase 23 : appui long pour pause, statuts texte, video (duree reelle),
// legende, reponse directe.
// Phase 24 : edition du statut (texte/legende + media) dans la fenetre des
// 20 minutes, badge "modifie", historique des versions.
export default function StoryViewer({ groups, startGroupIndex, onClose }: StoryViewerProps) {
  const { user } = useAuth()
  const [groupIndex, setGroupIndex] = useState(startGroupIndex)
  const [storyIndex, setStoryIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [viewerCount, setViewerCount] = useState(0)
  const [viewersList, setViewersList] = useState<Viewer[] | null>(null)
  const [showViewers, setShowViewers] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sendingReply, setSendingReply] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, Story>>({})
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [editFile, setEditFile] = useState<File | null>(null)
  const [editFilePreview, setEditFilePreview] = useState<string | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [historyEntries, setHistoryEntries] = useState<StoryEditHistoryEntry[] | null>(null)
  const [, forceTick] = useState(0)
  const frameRef = useRef<number | undefined>(undefined)
  const startRef = useRef<number>(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const editFileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const interval = setInterval(() => forceTick((n) => n + 1), 30000)
    return () => clearInterval(interval)
  }, [])

  const group = groups[groupIndex]
  const rawStory = group?.stories[storyIndex]
  const story = rawStory ? (overrides[rawStory.id] ?? rawStory) : undefined
  const isMine = story?.userId === user?.id
  const isVideo = story?.type === 'video'
  const replying = replyText.trim().length > 0
  const canEdit = isMine && !!story && editRemainingMinutes(story.createdAt) > 0

  const goNext = () => {
    if (!group) return
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((i) => i + 1)
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((i) => i + 1)
      setStoryIndex(0)
    } else {
      onClose()
    }
  }

  const goPrev = () => {
    if (storyIndex > 0) {
      setStoryIndex((i) => i - 1)
    } else if (groupIndex > 0) {
      setGroupIndex((i) => i - 1)
      setStoryIndex(groups[groupIndex - 1].stories.length - 1)
    }
  }

  useEffect(() => {
    if (!story) return
    if (!story.viewed && !isMine) {
      apiViewStory(story.id).catch(() => {})
    }
    setShowViewers(false)
    setViewersList(null)
    setViewerCount(0)
    setProgress(0)
    setReplyText('')
    setEditing(false)
    setShowHistory(false)
    setHistoryEntries(null)
    startRef.current = performance.now()

    if (isMine) {
      apiStoryViewers(story.id)
        .then((viewers) => setViewerCount(viewers.length))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex])

  useEffect(() => {
    if (isVideo) return
    const paused = showViewers || isPaused || replying || editing || showHistory
    if (paused) {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      return
    }
    if (!story) return
    startRef.current = performance.now() - progress * STORY_DURATION_MS
    const tick = (now: number) => {
      const elapsed = now - startRef.current
      const pct = Math.min(1, elapsed / STORY_DURATION_MS)
      setProgress(pct)
      if (pct >= 1) {
        goNext()
      } else {
        frameRef.current = requestAnimationFrame(tick)
      }
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showViewers, isPaused, replying, editing, showHistory, groupIndex, storyIndex, isVideo])

  useEffect(() => {
    if (!isVideo || !videoRef.current) return
    if (isPaused || showViewers || replying || editing || showHistory) {
      videoRef.current.pause()
    } else {
      videoRef.current.play().catch(() => {})
    }
  }, [isPaused, showViewers, replying, editing, showHistory, isVideo])

  useEffect(() => () => {
    if (editFilePreview) URL.revokeObjectURL(editFilePreview)
  }, [editFilePreview])

  const handleDelete = async () => {
    if (!story) return
    try {
      await apiDeleteStory(story.id)
      goNext()
    } catch {
      // Ignore silencieusement, l'utilisateur reste sur la story.
    }
  }

  const handleOpenViewers = async () => {
    if (!story) return
    setShowViewers(true)
    if (!viewersList) {
      try {
        const viewers = await apiStoryViewers(story.id)
        setViewersList(viewers)
        setViewerCount(viewers.length)
      } catch {
        setViewersList([])
      }
    }
  }

  const handleSendReply = async () => {
    if (!story || !replyText.trim() || sendingReply) return
    setSendingReply(true)
    try {
      await apiSendTextMessage(story.userId, replyText.trim())
      onClose()
    } catch {
      // Erreur silencieuse : l'utilisateur peut reessayer.
    } finally {
      setSendingReply(false)
    }
  }

  const startEditing = () => {
    if (!story) return
    setEditText(story.textContent ?? '')
    setEditFile(null)
    setEditFilePreview(null)
    setEditing(true)
  }

  const cancelEditing = () => {
    if (editFilePreview) URL.revokeObjectURL(editFilePreview)
    setEditFile(null)
    setEditFilePreview(null)
    setEditing(false)
  }

  const handleEditFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (editFilePreview) URL.revokeObjectURL(editFilePreview)
    setEditFile(file)
    setEditFilePreview(URL.createObjectURL(file))
  }

  const handleSaveEdit = async () => {
    if (!story || savingEdit) return
    if (story.type === 'text' && !editText.trim()) return
    setSavingEdit(true)
    try {
      const updated = await apiEditStory(story.id, editText.trim() ? editText.trim() : (story.type === 'text' ? editText.trim() : null), editFile)
      setOverrides((prev) => ({ ...prev, [story.id]: updated }))
      cancelEditing()
    } catch {
      // Erreur silencieuse : l'utilisateur peut reessayer.
    } finally {
      setSavingEdit(false)
    }
  }

  const handleOpenHistory = async () => {
    if (!story) return
    setShowHistory(true)
    if (!historyEntries) {
      try {
        const entries = await apiStoryEditHistory(story.id)
        setHistoryEntries(entries)
      } catch {
        setHistoryEntries([])
      }
    }
  }

  if (!group || !story) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="flex gap-1 px-3 pt-3">
        {group.stories.map((s, i) => (
          <div key={s.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/30">
            <div
              className="h-full bg-white"
              style={{ width: i < storyIndex ? '100%' : i === storyIndex ? `${progress * 100}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2.5">
          <Avatar name={group.user.displayName} color={group.user.avatarColor} avatarUrl={resolveAvatarUrl(group.user.avatarUrl)} size={34} />
          <div className="flex flex-col">
            <span className="font-display text-sm font-semibold text-white">{group.user.displayName}</span>
            {story.editedAt && (
              <button type="button" onClick={() => void handleOpenHistory()} className="text-left text-[10px] text-white/60 underline">
                modifié
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {canEdit && (
            <button onClick={startEditing} aria-label="Modifier" title={`Modifiable encore ${editRemainingMinutes(story.createdAt)} min`} className="text-white/80 hover:text-white">
              <Pencil size={19} />
            </button>
          )}
          {isMine && (
            <button onClick={handleDelete} aria-label="Supprimer" className="text-white/80 hover:text-white">
              <Trash2 size={20} />
            </button>
          )}
          <button onClick={onClose} aria-label="Fermer" className="text-white/80 hover:text-white">
            <X size={22} />
          </button>
        </div>
      </div>

      <div
        className="relative flex-1"
        onPointerDown={() => setIsPaused(true)}
        onPointerUp={() => setIsPaused(false)}
        onPointerLeave={() => setIsPaused(false)}
        onPointerCancel={() => setIsPaused(false)}
      >
        {story.type === 'text' ? (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-emerald-700 to-neutral-900 p-8">
            <p className="whitespace-pre-wrap break-words text-center text-2xl font-semibold text-white">{story.textContent}</p>
          </div>
        ) : story.type === 'video' ? (
          <video
            ref={videoRef}
            src={story.imageUrl ? mediaUrl(story.imageUrl) : undefined}
            autoPlay
            playsInline
            className="h-full w-full object-contain"
            onTimeUpdate={(e) => {
              const v = e.currentTarget
              if (v.duration > 0) setProgress(v.currentTime / v.duration)
            }}
            onEnded={goNext}
          />
        ) : (
          <img src={story.imageUrl ? mediaUrl(story.imageUrl) : undefined} alt="" className="h-full w-full object-contain" />
        )}

        {story.type !== 'text' && story.textContent && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pb-6 pt-10">
            <p className="whitespace-pre-wrap break-words text-center text-sm text-white">{story.textContent}</p>
          </div>
        )}

        {!isMine && (
          <>
            <button aria-label="Precedent" onClick={goPrev} className="absolute inset-y-0 left-0 w-1/3" />
            <button aria-label="Suivant" onClick={goNext} className="absolute inset-y-0 right-0 w-1/3" />
          </>
        )}
      </div>

      {isMine && !editing && (
        <button
          type="button"
          onClick={handleOpenViewers}
          className="flex items-center gap-1.5 self-start px-4 py-3 text-sm text-white/80 hover:text-white"
        >
          <Eye size={16} />
          <span>{viewerCount}</span>
        </button>
      )}

      {!isMine && !editing && (
        <div className="flex items-center gap-2 px-3 pb-4 pt-2 safe-bottom">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onFocus={() => setIsPaused(true)}
            placeholder={`Repondre a ${group.user.displayName}...`}
            className="h-11 flex-1 rounded-full border border-white/30 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-white/50 focus:border-white/60"
          />
          <button
            type="button"
            onClick={() => void handleSendReply()}
            disabled={!replying || sendingReply}
            aria-label="Envoyer"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      )}

      {editing && (
        <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-2xl bg-neutral-900 p-4 safe-bottom">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Modifier le statut</h3>
            <button onClick={cancelEditing} aria-label="Annuler" className="text-white/70 hover:text-white"><X size={18} /></button>
          </div>

          {story.type === 'text' ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              maxLength={280}
              rows={4}
              className="mb-3 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
            />
          ) : (
            <>
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                maxLength={280}
                placeholder="Legende (optionnel)"
                className="mb-3 w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-white outline-none focus:border-emerald-500"
              />
              <input
                ref={editFileInputRef}
                type="file"
                accept={story.type === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/jpeg,image/png,image/webp'}
                className="hidden"
                onChange={handleEditFilePick}
              />
              <button
                type="button"
                onClick={() => editFileInputRef.current?.click()}
                className="mb-3 flex w-full items-center gap-2 rounded-lg border border-dashed border-neutral-600 p-3 text-left text-sm text-neutral-300 hover:bg-neutral-800"
              >
                {story.type === 'video' ? <Video size={18} /> : <ImageIcon size={18} />}
                {editFile ? editFile.name : `Remplacer la ${story.type === 'video' ? 'video' : 'photo'}`}
              </button>
              {editFilePreview && story.type === 'image' && (
                <img src={editFilePreview} alt="Aperçu" className="mb-3 max-h-40 w-full rounded-lg object-contain" />
              )}
              {editFilePreview && story.type === 'video' && (
                <video src={editFilePreview} controls className="mb-3 max-h-40 w-full rounded-lg" />
              )}
            </>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={cancelEditing} className="rounded-lg px-4 py-2 text-neutral-300 hover:bg-neutral-800">Annuler</button>
            <button
              type="button"
              onClick={() => void handleSaveEdit()}
              disabled={savingEdit || (story.type === 'text' && !editText.trim())}
              className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-emerald-500"
            >
              {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {showViewers && (
        <div className="absolute inset-x-0 bottom-0 z-10 max-h-[60%] overflow-y-auto rounded-t-2xl bg-neutral-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Vu par</h3>
            <button onClick={() => setShowViewers(false)} aria-label="Fermer la liste" className="text-white/70 hover:text-white">
              <X size={18} />
            </button>
          </div>
          {viewersList === null && <p className="text-sm text-neutral-400">Chargement…</p>}
          {viewersList?.length === 0 && <p className="text-sm text-neutral-400">Personne n'a encore vu cette story.</p>}
          {viewersList?.map((viewer) => (
            <div key={viewer.userId} className="flex items-center gap-3 border-b border-neutral-800 py-2 last:border-b-0">
              <Avatar name={viewer.displayName} color={viewer.avatarColor} avatarUrl={resolveAvatarUrl(viewer.avatarUrl)} size={32} />
              <span className="text-sm text-white">{viewer.displayName}</span>
            </div>
          ))}
        </div>
      )}

      {showHistory && (
        <div className="absolute inset-x-0 bottom-0 z-20 max-h-[60%] overflow-y-auto rounded-t-2xl bg-neutral-900 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-white"><History size={16} /> Historique des modifications</h3>
            <button onClick={() => setShowHistory(false)} aria-label="Fermer l'historique" className="text-white/70 hover:text-white">
              <X size={18} />
            </button>
          </div>
          {historyEntries === null && <p className="text-sm text-neutral-400">Chargement…</p>}
          {historyEntries?.length === 0 && <p className="text-sm text-neutral-400">Aucune version antérieure.</p>}
          {historyEntries?.map((entry, i) => (
            <div key={i} className="mb-2 rounded-xl border border-neutral-800 bg-neutral-800/50 px-3 py-2">
              {entry.previousType === 'text' ? (
                <p className="whitespace-pre-wrap break-words text-sm text-white">{entry.previousTextContent}</p>
              ) : (
                <>
                  {entry.previousImageUrl && (
                    entry.previousType === 'video' ? (
                      <video src={mediaUrl(entry.previousImageUrl)} controls className="mb-1 max-h-40 w-full rounded-lg" />
                    ) : (
                      <img src={mediaUrl(entry.previousImageUrl)} alt="" className="mb-1 max-h-40 w-full rounded-lg object-contain" />
                    )
                  )}
                  {entry.previousTextContent && <p className="text-sm text-white">{entry.previousTextContent}</p>}
                </>
              )}
              <p className="mt-1 text-[10px] text-neutral-400">{new Date(entry.editedAt).toLocaleString('fr-FR')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
  }
