import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { AuthApiError, validatePassword, validateUsername } from '@/lib/authApi'

// Phase 2 : inscription reelle via AuthContext (mock localStorage pour l'instant,
// meme forme d'appel que le futur POST /auth/register en Phase 3).
export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [step, setStep] = useState<1 | 2>(1)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const goToStep2 = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!displayName.trim()) {
      setError('Le nom affiche est requis.')
      return
    }
    const usernameError = validateUsername(username)
    if (usernameError) {
      setError(usernameError.message)
      return
    }
    setStep(2)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (loading) return
    setError(null)

    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError.message)
      return
    }

    setLoading(true)
    try {
      await register({ displayName, username, password })
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Inscription impossible. Reessayez.')
      if (err instanceof AuthApiError && err.code === 'USERNAME_TAKEN') setStep(1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col px-6 pt-6">
      <button
        onClick={() => {
          setError(null)
          if (step === 1) navigate('/login')
          else setStep(1)
        }}
        aria-label="Retour"
        className="mb-6 flex items-center gap-2 text-sm text-paperDim"
      >
        <ArrowLeft size={16} /> Retour
      </button>

      <div className="mb-2 flex items-center gap-1.5">
        <span className={`h-1.5 w-8 rounded-full ${step >= 1 ? 'bg-transmit' : 'bg-line'}`} />
        <span className={`h-1.5 w-8 rounded-full ${step >= 2 ? 'bg-transmit' : 'bg-line'}`} />
      </div>
      <p className="callsign mb-6 text-[11px] uppercase tracking-widest text-paperDim">Etape {step} sur 2</p>

      <h1 className="font-display text-2xl font-semibold text-paper">
        {step === 1 ? 'Creez votre compte' : 'Choisissez un mot de passe'}
      </h1>

      <form onSubmit={step === 1 ? goToStep2 : submit} className="mt-6 max-w-xs space-y-3" noValidate>
        {step === 1 ? (
          <>
            <div>
              <label className="mb-1 block text-xs text-paperDim" htmlFor="displayName">Nom affiche</label>
              <input
                id="displayName"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ex. Awa Sarr"
                className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm text-paper placeholder:text-paperDim outline-none focus:border-transmit"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-paperDim" htmlFor="username">Identifiant</label>
              <input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="awa_sarr"
                className="callsign w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm text-paper placeholder:text-paperDim outline-none focus:border-transmit"
              />
              <p className="mt-1 text-[11px] text-paperDim">Votre callsign public, ex. @awa_sarr</p>
            </div>
          </>
        ) : (
          <div>
            <label className="mb-1 block text-xs text-paperDim" htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 caracteres minimum"
              className="w-full rounded-xl border border-line bg-panel px-4 py-3 text-sm text-paper placeholder:text-paperDim outline-none focus:border-transmit"
            />
          </div>
        )}

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
          {loading ? 'Creation...' : step === 1 ? 'Continuer' : 'Creer mon compte'}
        </button>
      </form>
    </div>
  )
}
