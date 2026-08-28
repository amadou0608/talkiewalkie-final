import { useEffect, useRef, useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import Avatar from '@/components/Avatar'
import { resolveAvatarUrl } from '@/lib/authApi'
import { useAuth } from '@/context/AuthContext'
import { apiViewStory, apiDeleteStory, type StoryGroup } from '@/lib/storiesApi'

interface StoryViewerProps {
  groups: StoryGroup[]
  startGroupIndex: number
  onClose: () => void
}

const STORY_DURATION_MS = 5000

// Viewer plein ecran facon WhatsApp/Instagram : barres de progression en
// haut, tap gauche/droite pour naviguer, defile automatiquement (Phase 21).
export default function StoryViewer({ groups, startGroupIndex, onClose }: StoryViewerProps) {
  const { user } = useAuth()
  const [groupIndex, setGroupIndex] = useState(startGroupIndex)
  const [storyIndex, setStoryIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const frameRef = useRef<number>()
  const startRef = useRef<number>(0)

  const group = groups[groupIndex]
  const story = group?.stories[storyIndex]
  const isMine = story?.userId === user?.id

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
    setProgress(0)
    startRef.current = performance.now()

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
  }, [groupIndex, storyIndex])

  const handleDelete = async () => {
    if (!story) return
    try {
      await apiDeleteStory(story.id)
      goNext()
    } catch {
      // Ignore silencieusement, l'utilisateur reste sur la story.
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

      <div className="relative flex-1">
        <img src={story.imageUrl.startsWith('http') ? story.imageUrl : `${(import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '')}${story.imageUrl}`} alt="" className="h-full w-full object-contain" />
        <button aria-label="Precedent" onClick={goPrev} className="absolute inset-y-0 left-0 w-1/3" />
        <button aria-label="Suivant" onClick={goNext} className="absolute inset-y-0 right-0 w-1/3" />
      </div>
    </div>
  )
}
