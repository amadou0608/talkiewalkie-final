import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import Avatar from '@/components/Avatar'
import { useAuth } from '@/context/AuthContext'
import { resolveAvatarUrl } from '@/lib/authApi'
import { apiContactsStories, apiUploadStory, type StoryGroup } from '@/lib/storiesApi'

interface StoryBarProps {
  onOpenGroup: (groups: StoryGroup[], startIndex: number) => void
}

// Bandeau horizontal de stories, affiche en haut de l'accueil (Phase 21).
// Le premier cercle est toujours "Ma story" (ajouter / voir la mienne).
export default function StoryBar({ onOpenGroup }: StoryBarProps) {
  const { user } = useAuth()
  const [groups, setGroups] = useState<StoryGroup[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = () => {
    apiContactsStories().then(setGroups).catch(() => {})
  }

  useEffect(() => {
    load()
  }, [])

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await apiUploadStory(file)
      load()
    } catch {
      // Erreur silencieuse ici : l'utilisateur peut reessayer immediatement.
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  if (!user) return null

  return (
    <div className="mb-5 flex gap-4 overflow-x-auto pb-1">
      <div className="flex shrink-0 flex-col items-center gap-1.5">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="relative flex h-16 w-16 items-center justify-center"
        >
          <Avatar name={user.displayName} color={user.avatarColor} avatarUrl={resolveAvatarUrl(user.avatarUrl)} size={60} />
          <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-transmit text-ink">
            <Plus size={13} />
          </span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePick} />
        <span className="text-[11px] text-paperDim">Ma story</span>
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
    </div>
  )
    }
