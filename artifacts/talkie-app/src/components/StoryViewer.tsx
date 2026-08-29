import { useEffect, useRef, useState } from 'react'
import { X, Trash2, Eye, Send } from 'lucide-react'
import Avatar from '@/components/Avatar'
import { resolveAvatarUrl } from '@/lib/authApi'
import { useAuth } from '@/context/AuthContext'
import { apiViewStory, apiDeleteStory, apiStoryViewers, type StoryGroup, type StoryViewer as Viewer } from '@/lib/storiesApi'
import { apiSendTextMessage } from '@/lib/messagesApi'

interface StoryViewerProps {
  groups: StoryGroup[]
  startGroupIndex: number
  onClose: () => void
}

const STORY_DURATION_MS = 5000

function mediaUrl(url: string) {
  return url.startsWith('http') ? url : `${(import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '')}${url}`
}

// Viewer plein ecran facon WhatsApp/Instagram : barres de progression en
// haut, tap gauche/droite pour naviguer, defile automatiquement (Phase 21).
// Phase 22 : compteur "vu par", pause pendant la liste des vus.
// Phase 23 : appui long pour pause, statuts texte, video (duree reelle),
// legende, reponse directe qui envoie un message a l'auteur du statut.
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
  const frameRef = useRef<number | undefined>(undefined)
  const startRef = useRef<number>(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const group = groups[groupIndex]
  const story = group?.stories[storyIndex]
  const isMine = story?.userId === user?.id
  const isVideo = story?.type === 'video'
  const replying = replyText.trim().length > 0

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
    startRef.current = performance.now()

    if (isMine) {
      apiStoryViewers(story.id)
        .then((viewers) => setViewerCount(viewers.length))
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, storyIndex])

  // Progression basee sur un minuteur fixe (image/texte). Les videos gerent
  // leur propre progression via onTimeUpdate/onEnded ci-dessous. En train de
  // repondre, on met en pause comme pour un appui long.
  useEffect(() => {
    if (isVideo) return
    const paused = showViewers || isPaused || replying
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
  }, [showViewers, isPaused, replying, groupIndex, storyIndex, isVideo])

  // Pause/relance la lecture video quand isPaused, showViewers ou replying change.
  useEffect(() => {
    if (!isVideo || !videoRef.current) return
    if (isPaused || showViewers || replying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play().catch(() => {})
    }
  }, [isPaused, showViewers, replying, isVideo])

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
          <span className="font-display text-sm font-semibold text-white">{group.user.displayName}</span>
        </div>
        <div className="flex items-center gap-3">
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

      {isMine && (
        <button
          type="button"
          onClick={handleOpenViewers}
          className="flex items-center gap-1.5 self-start px-4 py-3 text-sm text-white/80 hover:text-white"
        >
          <Eye size={16} />
          <span>{viewerCount}</span>
        </button>
      )}

      {!isMine && (
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
    </div>
  )
}
