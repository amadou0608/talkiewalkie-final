import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Radio } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { AuthApiError } from '@/lib/authApi'

// Phase 2 : connexion reelle via AuthContext (mock localStorage pour l'instant,
// meme forme d'appel que le futur POST /auth/login en Phase 3).
export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)

    if (!username.trim() || !password) {
      setError('Renseignez votre identifiant et votre mot de passe.')
      return
    }

    setLoading(true)
    try {
      await login(username, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Connexion impossible. Reessayez.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="mb-8 flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-transmit text-ink">
          <Radio size={26} />
        </div>
        <h1 className="font-display text-2xl font-semibold text-paper">Talkie</h1>
        <p className="text-sm text-paperDim">Communiquez, ou que vous soyez.</p>
      </div>

      <form onSubmit={submit} className="w-full max-w-xs space-y-3" noValidate>
        <div>
          <label className="mb-1 block text-xs text-paperDim" htmlFor="username">Identifiant</label>
          <input
            id="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@saugui_47291"
            className="callsign w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm text-paper placeholder:text-paperDim outline-none focus:border-transmit"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-paperDim" htmlFor="password">Mot de passe</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm text-paper placeholder:text-paperDim outline-none focus:border-transmit"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-alert/30 bg-alert/10 px-3 py-2 text-xs text-alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-transmit py-3 font-display text-sm font-semibold text-ink transition-transform active:scale-[0.99] disabled:opacity-60"
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>

      <button onClick={() => navigate('/register')} className="mt-5 text-sm text-paperDim underline underline-offset-4">
        Creer un compte
      </button>

      <p className="callsign mt-8 text-[11px] text-paperDim">
        Demo : @saugui_47291 / talkie2026
      </p>
    </div>
  )
}
