import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { SessionSplash } from '@/components/RequireAuth'

// Pour /login et /register : si une session existe deja, on saute directement
// a l'accueil plutot que de remontrer l'ecran de connexion.
export default function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'loading') return <SessionSplash />
  if (status === 'authenticated') return <Navigate to="/" replace />

  return <>{children}</>
}
