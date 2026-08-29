import { useEffect, useRef, useState } from 'react'
import { Plus, Type, Image as ImageIcon, Video, X } from 'lucide-react'
import Avatar from '@/components/Avatar'
import StoryVisibilityPicker from '@/components/StoryVisibilityPicker'
import { useAuth } from '@/context/AuthContext'
import { resolveAvatarUrl } from '@/lib/authApi'
import {
  apiContactsStories,
  apiMyStories,
  apiUploadStory,
  type StoryGroup,
  type StoryType,
  type StoryVisibilityMode,
} from '@/lib/storiesApi'

interface StoryBarProps {
  onOpenGroup: (groups: StoryGroup[], startIndex: number) => void
}

// Bandeau horizontal de stories, affiche en haut de l'accueil (Phase 21).
// Phase 23 : menu Texte / Photo / Video au clic sur le "+".
export default function StoryBar({ onOpenGroup }: StoryBarProps) {
  const { user } = useAuth()
  const [groups, setGroups] = useState<StoryGroup[]>([])
  const [hasOwnStories, setHasOwnStories] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [pendingType, setPendingType] = useState<StoryType | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const load = () => {
    apiContactsStories().then(setGroups).catch(() => {})
    apiMyStories().then((stories) => setHasOwnStories(stories.length > 0)).catch(() => {})
  }

  useEffect(() => {
    load()
  }, [])

  function openMenu() {
    setShowMenu(true)
  }

  function handleChooseText() {
    setShowMenu(false)
    setPendingType('text')
    setPendingFile(null)
  }

  function handleChoosePhoto() {
    setShowMenu(false)
    imageInputRef.current?.click()
  }

  function handleChooseVideo() {
    setShowMenu(false)
    videoInputRef.current?.click()
  }

  function handleImagePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingType('image')
    setPendingFile(file)
  }

  function handleVideoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingType('video')
    setPendingFile(file)
  }

  const handleVisibilityCancel = () => {
    setPendingType(null)
    setPendingFile(null)
  }

  const handleVisibilityConfirm = async (mode: StoryVisibilityMode, targetUserIds: string[], content: string) => {
    if (!pendingType) return
    const type = pendingType
    const file = pendingFile
    setPendingType(null)
    setPendingFile(null)
    setUploading(true)
    try {
      await apiUploadStory(type, file, content, mode, targetUserIds)
      const myStories = await apiMyStories()
      setHasOwnStories(myStories.length > 0)
      if (user && myStories.length > 0) {
        const ownGroup: StoryGroup = {
          user: {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatarColor: user.avatarColor,
            avatarUrl: user.avatarUrl,
          },
          stories: myStories,
          hasUnviewed: false,
        }
        onOpenGroup([ownGroup], 0)
      }
    } catch {
      // Erreur silencieuse ici : l'utilisateur peut reessayer immediatement.
    } finally {
      setUploading(false)
    }
  }

  const handleOwnClick = async () => {
    if (!hasOwnStories) {
      openMenu()
      return
    }
    if (!user) return
    const myStories = await apiMyStories().catch(() => [])
    if (myStories.length === 0) {
      openMenu()
      return
    }
    const ownGroup: StoryGroup = {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl,
      },
      stories: myStories,
      hasUnviewed: false,
    }
    onOpenGroup([ownGroup], 0)
  }

  if (!user) return null

  return (
    <div className="mb-5 flex gap-4 overflow-x-auto pb-1">
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={handleOwnClick}
          disabled={uploading}
          className={`relative flex h-16 w-16 items-center justify-center rounded-full ${hasOwnStories ? 'ring-2 ring-transmit ring-offset-2 ring-offset-ink' : ''}`}
        >
          <Avatar name={user.displayName} color={user.avatarColor} avatarUrl={resolveAvatarUrl(user.avatarUrl)} size={60} />
          <span
            role="button"
            aria-label="Ajouter un statut"
            onClick={(e) => { e.stopPropagation(); openMenu() }}
            className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-transmit text-ink"
          >
            <Plus size={13} />
          </span>
        </button>
        <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImagePick} />
        <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={handleVideoPick} />
        <span className="text-[11px] text-paperDim">{uploading ? 'Envoi...' : 'Ma story'}</span>
      </div>

      {groups.map((group, index) => (
        <button
          key={group.user.id}
          type="button"
          onClick={() => onOpenGroup(groups, index)}
          className="flex shrink-0 flex-col items-center gap-1.5"
        >
          <div className={`flex h-16 w-16 items-center justify-center rounded-full ${group.hasUnviewed ? 'ring-2 ring-transmit ring-offset-2 ring-offset-ink' : 'ring-1 ring-line'}`}>
            <Avatar name={group.user.displayName} color={group.user.avatarColor} avatarUrl={resolveAvatarUrl(group.user.avatarUrl)} size={56} />
          </div>
          <span className="max-w-[64px] truncate text-[11px] text-paperDim">{group.user.displayName}</span>
        </button>
      ))}

      {showMenu && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" onClick={() => setShowMenu(false)}>
          <div className="w-full max-w-md rounded-t-2xl bg-neutral-900 p-4 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Nouveau statut</h2>
              <button onClick={() => setShowMenu(false)} aria-label="Fermer" className="text-neutral-400 hover:text-white"><X size={20} /></button>
            </div>
            <button type="button" onClick={handleChooseText} className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-neutral-800">
              <Type size={20} className="text-emerald-400" />
              <span className="text-white">Ecrire un statut</span>
            </button>
            <button type="button" onClick={handleChoosePhoto} className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-neutral-800">
              <ImageIcon size={20} className="text-emerald-400" />
              <span className="text-white">Photo</span>
            </button>
            <button type="button" onClick={handleChooseVideo} className="flex w-full items-center gap-3 rounded-lg p-3 text-left hover:bg-neutral-800">
              <Video size={20} className="text-emerald-400" />
              <span className="text-white">Video</span>
            </button>
          </div>
        </div>
      )}

      {pendingType && (
        <StoryVisibilityPicker storyType={pendingType} onConfirm={handleVisibilityConfirm} onCancel={handleVisibilityCancel} />
      )}
    </div>
  )
      }
