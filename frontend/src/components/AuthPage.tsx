import { useState } from 'react'
import { loginUser, registerUser } from '../api'
import { useAuth } from '../context/AuthContext'

type Mode = 'login' | 'register'

interface FieldProps {
  label: string
  type?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  error?: string
}

function Field({ label, type = 'text', value, onChange, placeholder, autoComplete, error }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium uppercase tracking-[0.08em] text-text-secondary">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={`h-10 px-3 rounded-lg bg-bg-elevated border text-[14px] text-text-primary
          placeholder:text-text-muted outline-none transition-all duration-200
          focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]
          ${error ? 'border-error' : 'border-border-dim hover:border-border-bright'}`}
      />
      {error && <p className="text-[12px] text-error">{error}</p>}
    </div>
  )
}

export default function AuthPage() {
  const { login } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)

  // Login fields
  const [loginId,   setLoginId]   = useState('')
  const [loginPass, setLoginPass] = useState('')

  // Register fields
  const [regUsername, setRegUsername]   = useState('')
  const [regEmail,    setRegEmail]      = useState('')
  const [regPass,     setRegPass]       = useState('')
  const [regDisplay,  setRegDisplay]    = useState('')
  const [fieldErrors, setFieldErrors]   = useState<Record<string, string>>({})

  function switchMode(m: Mode) {
    setMode(m)
    setGlobalError(null)
    setFieldErrors({})
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!loginId || !loginPass) return
    setLoading(true)
    setGlobalError(null)
    try {
      const res = await loginUser({ username: loginId, password: loginPass })
      login(res.access_token, {
        id: res.user_id,
        username: res.username,
        display_name: res.display_name,
        email: '',
      })
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    const errors: Record<string, string> = {}
    if (regUsername.length < 3) errors.username = 'At least 3 characters'
    if (!regEmail.includes('@'))  errors.email    = 'Enter a valid email'
    if (regPass.length < 8)       errors.password = 'At least 8 characters'
    if (Object.keys(errors).length) { setFieldErrors(errors); return }

    setLoading(true)
    setGlobalError(null)
    setFieldErrors({})
    try {
      const res = await registerUser({
        username:     regUsername,
        email:        regEmail,
        password:     regPass,
        display_name: regDisplay || undefined,
      })
      login(res.access_token, {
        id: res.user_id,
        username: res.username,
        display_name: res.display_name,
        email: regEmail,
      })
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-4">
      {/* Radial glow backdrop */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 70%)' }}
      />

      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-10">
        <svg width="32" height="32" viewBox="0 0 28 28" fill="none" aria-hidden>
          <rect x="1" y="1" width="12" height="12" rx="2.5" stroke="#7c80b0" strokeWidth="1.5" fill="rgba(124,128,176,0.08)" />
          <rect x="9" y="9" width="12" height="12" rx="2.5" stroke="#9094c4" strokeWidth="1.5" fill="rgba(144,148,196,0.08)" />
          <circle cx="7" cy="7" r="1.5" fill="#7c80b0" />
          <circle cx="21" cy="21" r="1.5" fill="#9094c4" />
          <circle cx="14" cy="14" r="2" fill="#a4a8d8" />
          <line x1="7" y1="7" x2="14" y2="14" stroke="#7c80b0" strokeWidth="0.75" strokeOpacity="0.5" />
          <line x1="14" y1="14" x2="21" y2="21" stroke="#9094c4" strokeWidth="0.75" strokeOpacity="0.5" />
        </svg>
        <span className="text-[18px] font-semibold tracking-[-0.02em] text-text-primary">CodeNova</span>
      </div>

      {/* Card */}
      <div className="w-full max-w-[400px] bg-bg-surface border border-border-dim rounded-2xl p-8 shadow-card">

        {/* Mode tabs */}
        <div className="flex mb-8 p-1 bg-bg-elevated rounded-lg">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`flex-1 py-2 rounded-md text-[13px] font-medium transition-all duration-200
                ${mode === m
                  ? 'bg-bg-surface text-text-primary shadow-card'
                  : 'text-text-muted hover:text-text-secondary'}`}
            >
              {m === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {/* Global error */}
        {globalError && (
          <div className="mb-5 px-3 py-2.5 rounded-lg bg-error/10 border border-error/20 text-[13px] text-error">
            {globalError}
          </div>
        )}

        {/* Login form */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <Field
              label="Username or Email"
              value={loginId}
              onChange={setLoginId}
              placeholder="you@example.com"
              autoComplete="username"
            />
            <Field
              label="Password"
              type="password"
              value={loginPass}
              onChange={setLoginPass}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button
              type="submit"
              disabled={loading || !loginId || !loginPass}
              className="mt-2 h-11 rounded-lg font-semibold text-[14px] text-white
                flex items-center justify-center gap-2 transition-all duration-200
                disabled:opacity-40 disabled:cursor-not-allowed
                hover:brightness-110 hover:shadow-glow active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #5a5e8a, #464a78)' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
                    <path d="M8 2a6 6 0 016 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Signing in…
                </>
              ) : 'Sign In'}
            </button>
          </form>
        )}

        {/* Register form */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Username"
                value={regUsername}
                onChange={setRegUsername}
                placeholder="janedoe"
                autoComplete="username"
                error={fieldErrors.username}
              />
              <Field
                label="Display Name"
                value={regDisplay}
                onChange={setRegDisplay}
                placeholder="Jane Doe"
                autoComplete="name"
              />
            </div>
            <Field
              label="Email"
              type="email"
              value={regEmail}
              onChange={setRegEmail}
              placeholder="you@example.com"
              autoComplete="email"
              error={fieldErrors.email}
            />
            <Field
              label="Password"
              type="password"
              value={regPass}
              onChange={setRegPass}
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              error={fieldErrors.password}
            />
            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 rounded-lg font-semibold text-[14px] text-white
                flex items-center justify-center gap-2 transition-all duration-200
                disabled:opacity-40 disabled:cursor-not-allowed
                hover:brightness-110 hover:shadow-glow active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #5a5e8a, #464a78)' }}
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="white" strokeWidth="2" strokeOpacity="0.3" />
                    <path d="M8 2a6 6 0 016 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Creating account…
                </>
              ) : 'Create Account'}
            </button>
          </form>
        )}
      </div>

      <p className="mt-6 text-[12px] text-text-muted">IU Hackathon 2026</p>
    </div>
  )
}
