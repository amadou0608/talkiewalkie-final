import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, Lock, Ban, LogOut, QrCode, Trash2, Pencil } from 'lucide-react'
import TopBar from '@/components/TopBar'
import BottomNav from '@/components/BottomNav'
import Avatar from '@/components/Avatar'
import { useAuth } from '@/context/AuthContext'
import { resolveAvatarUrl } from '@/lib/authApi'

const LINKS = [
  { to: '/privacy', label: 'Confidentialite', icon: Lock },
  { to: '/blocked', label: 'Utilisateurs bloques', icon: Ban },
  { to: '/settings', label: 'Parametres', icon: ChevronRight },
]

export default function Profile() {
  const { user, logout, deleteAccount } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  // Phase 11, section 13 : suppression irreversible — un double appui
  // explicite est demande plutot qu'une simple confirmation navigateur
  // (window.confirm), pour rester coherent avec le reste de l'interface.
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    await logout()
    navigate('/login', { replace: true })
  }

  const handleDeleteAccount = async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    if (deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccount()
      navigate('/login', { replace: true })
    } catch {
      setDeleteError('Suppression impossible pour le moment. Reessayez.')
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  if (!user) return null

  return (
    <div className="min-h-screen pb-24">
      <TopBar title="Profil" />

      <main className="mx-auto max-w-md px-5 pt-6">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-panel p-6">
          <Avatar
            name={user.displayName}
            color={user.avatarColor}
            avatarUrl={resolveAvatarUrl(user.avatarUrl)}
            size={72}
            ring
          />
          <div className="text-center">
            <p className="font-display text-lg font-semibold text-paper">{user.displayName}</p>
            <p className="callsign text-sm text-paperDim">@{user.username}</p>
          </div>
          <Link
            to="/profile/edit"
            className="mt-1 flex items-center gap-2 rounded-full border border-line px-4 py-1.5 text-xs text-paperDim hover:bg-panel2"
          >
            <Pencil size={14} />
            Modifier le profil
          </Link>
          <button className="flex items-center gap-2 rounded-full border border-line px-4 py-1.5 text-xs text-paperDim hover:bg-panel2">
            <QrCode size={14} />
            Mon QR code
          </button>
        </div>

        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
          {LINKS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link to={to} className="flex items-center justify-between px-4 py-3.5 hover:bg-panel2">
                <span className="flex items-center gap-3 text-sm text-paper">
                  <Icon size={17} className="text-paperDim" />
                  {label}
                </span>
                <ChevronRight size={16} className="text-paperDim" />
              </Link>
            </li>
          ))}
        </ul>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-alert/30 py-3 text-sm font-medium text-alert hover:bg-alert/10 disabled:opacity-60"
        >
          <LogOut size={16} />
          {loggingOut ? 'Deconnexion...' : 'Se deconnecter'}
        </button>

        <button
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-medium text-paperDim hover:bg-panel2 disabled:opacity-60"
        >
          <Trash2 size={16} />
          {deleting
            ? 'Suppression...'
            : confirmingDelete
              ? 'Confirmer la suppression definitive'
              : 'Supprimer mon compte'}
        </button>
        {confirmingDelete && !deleting && (
          <p className="mt-2 text-center text-xs text-paperDim">
            Cette action est definitive : contacts, messages vocaux et donnees seront effaces.
          </p>
        )}
        {deleteError && <p className="mt-2 text-center text-xs text-alert">{deleteError}</p>}
      </main>

      <BottomNav />
    </div>
  )
    }
