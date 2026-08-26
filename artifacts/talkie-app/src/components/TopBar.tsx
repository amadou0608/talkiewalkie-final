import { Link } from 'react-router-dom'
import { Settings } from 'lucide-react'
import Avatar from './Avatar'
import { useAuth } from '@/context/AuthContext'

interface TopBarProps {
  title: string
  eyebrow?: string
}

// Bandeau superieur en style "lecture de cadran" : callsign + etat reseau.
export default function TopBar({ title, eyebrow }: TopBarProps) {
  const { user } = useAuth()

  return (
    <header className="safe-top sticky top-0 z-20 border-b border-line bg-ink/90 backdrop-blur px-5 pt-4 pb-3">
      <div className="flex items-center justify-between">
        <div>
          {eyebrow && (
            <p className="callsign text-[11px] uppercase tracking-widest text-paperDim">{eyebrow}</p>
          )}
          <h1 className="font-display text-xl font-semibold text-paper">{title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/settings"
            aria-label="Parametres"
            className="rounded-full p-2 text-paperDim hover:text-paper hover:bg-panel2 transition-colors"
          >
            <Settings size={20} />
          </Link>
          {user && (
            <Link to="/profile" aria-label="Mon profil">
              <Avatar name={user.displayName} color={user.avatarColor} size={36} />
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
