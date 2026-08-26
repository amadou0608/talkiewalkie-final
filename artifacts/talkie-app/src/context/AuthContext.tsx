// Contexte d'authentification — Phase 2.
// Enveloppe le service mock `lib/authApi.ts`. En Phase 3, seul authApi.ts
// changera (vrais appels reseau) ; ce contexte restera identique.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiDeleteAccount, apiGetSession, apiLogin, apiLogout, apiRegister, type RegisterPayload } from '@/lib/authApi'
import type { User } from '@/types'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  status: AuthStatus
  user: User | null
  login: (username: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => Promise<void>
  // Phase 11, section 13 : suppression de compte et de ses donnees.
  deleteAccount: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<User | null>(null)

  // Restauration de session au demarrage (equivalent GET /auth/me).
  useEffect(() => {
    let cancelled = false
    apiGetSession().then((restored) => {
      if (cancelled) return
      setUser(restored)
      setStatus(restored ? 'authenticated' : 'unauthenticated')
    })
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const loggedIn = await apiLogin(username, password)
    setUser(loggedIn)
    setStatus('authenticated')
  }, [])

  const register = useCallback(async (payload: RegisterPayload) => {
    const created = await apiRegister(payload)
    setUser(created)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  const deleteAccount = useCallback(async () => {
    await apiDeleteAccount()
    setUser(null)
    setStatus('unauthenticated')
  }, [])

  const value = useMemo(
    () => ({ status, user, login, register, logout, deleteAccount }),
    [status, user, login, register, logout, deleteAccount],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit etre utilise a l\'interieur de <AuthProvider>')
  return ctx
}
