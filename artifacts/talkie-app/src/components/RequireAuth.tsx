import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

// Protege les routes de la section 17 qui necessitent une session (tout sauf
// /login et /register). Redirige vers /login en conservant la page visee,
// pour y revenir automatiquement apres connexion.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <SessionSplash />
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}

export function SessionSplash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink">
      <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-panel text-transmit">
        <Radio size={26} />
      </div>
      <p className="callsign text-xs uppercase tracking-widest text-paperDim">Connexion...</p>
    </div>
  )
}
