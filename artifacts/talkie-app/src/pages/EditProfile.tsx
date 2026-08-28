import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, ChevronLeft } from 'lucide-react'
import TopBar from '@/components/TopBar'
import Avatar from '@/components/Avatar'
import { useAuth } from '@/context/AuthContext'

export default function EditProfile() {
  const { user, updateProfile, uploadAvatar } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null

  const handleAvatarPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    setError(null)
    try {
      await uploadAvatar(file)
    } catch {
      setError('Impossible de mettre a jour la photo. Reessayez.')
    } finally {
      setUploadingAvatar(false)
      e.target.value = ''
    }
  }

  const handleSave = async () => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await updateProfile({ displayName: displayName.trim(), bio: bio.trim() })
      navigate('/profile')
    } catch {
      setError('Impossible d\'enregistrer les modifications. Reessayez.')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen pb-24">
      <TopBar title="Modifier le profil" />
      <main className="mx-auto max-w-md px-5 pt-6">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Avatar name={displayName || user.displayName} color={user.avatarColor} avatarUrl={user.avatarUrl} size={88} ring />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand text-white border-2 border-panel"
            >
              <Camera size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarPick}
            />
          </div>
          {uploadingAvatar && <p className="text-xs text-paperDim">Envoi de la photo...</p>}
        </div>

        <div className="mt-8 flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-paperDim">Nom affiche</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              className="rounded-xl border border-line bg-panel px-4 py-2.5 text-sm text-paper"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-paperDim">Statut</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={150}
              rows={3}
              placeholder="Dites-en un peu plus sur vous..."
              className="rounded-xl border border-line bg-panel px-4 py-2.5 text-sm text-paper resize-none"
            />
            <span className="self-end text-xs text-paperDim">{bio.length}/150</span>
          </label>
        </div>

        {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="mt-8 w-full rounded-full bg-brand py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </main>
    </div>
  )
                                                         }
