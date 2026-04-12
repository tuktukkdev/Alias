import { useEffect, useRef, useState, type FormEvent } from 'react'
import './AuthModal.css'

type AuthTab = 'login' | 'register'

interface AuthModalProps {
  initialTab?: AuthTab
  serverError?: string
  loading?: boolean
  onClose: () => void
  onLogin: (username: string, password: string) => void
  onRegister: (username: string, email: string, password: string) => void
  onForgotPassword: (email: string) => Promise<boolean>
}

export function AuthModal({
  initialTab = 'login',
  serverError,
  loading,
  onClose,
  onLogin,
  onRegister,
  onForgotPassword,
}: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>(initialTab)
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [clientError, setClientError] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const dialogRef = useRef<HTMLDialogElement>(null)
  // Track where mousedown started so we only close on backdrop click,
  // not when the user drags from inside → outside and releases.
  const mousedownOnBackdrop = useRef(false)

  const markTouched = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }))

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  useEffect(() => {
    setUsername('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setClientError('')
    setTouched({})
    setForgotMode(false)
    setForgotEmail('')
    setForgotSent(false)
    setForgotError('')
  }, [tab])

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const USERNAME_RE = /^[a-zA-Z0-9._/]+$/

  // Per-field validation helpers used for live highlighting
  const emailInvalid  = touched.email  && (email.trim() === '' || !EMAIL_RE.test(email.trim()))
  const passInvalid   = touched.password && (password.trim() === '' || password.trim().length < 6)
  const confirmInvalid = touched.confirmPassword && confirmPassword.trim() !== password.trim()

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setClientError('')
    // Mark all relevant fields as touched so empty ones highlight
    const fields: Record<string, boolean> = { username: true, password: true }
    if (tab === 'register') { fields.email = true; fields.confirmPassword = true }
    setTouched(fields)

    const trimmedUsername = username.trim()
    const trimmedPassword = password.trim()

    if (!trimmedUsername || !trimmedPassword) {
      setClientError('Please fill in all required fields.')
      return
    }

    if (!USERNAME_RE.test(trimmedUsername)) {
      setClientError('Username may only contain letters, numbers, . / and _')
      return
    }

    if (trimmedPassword.length < 6) {
      setClientError('Password must be at least 6 characters.')
      return
    }

    if (tab === 'register') {
      const trimmedEmail = email.trim()
      if (!trimmedEmail || !EMAIL_RE.test(trimmedEmail)) {
        setClientError('Please enter a valid email address.')
        return
      }
      if (trimmedPassword !== confirmPassword.trim()) {
        setClientError('Passwords do not match.')
        return
      }
      onRegister(trimmedUsername, trimmedEmail, trimmedPassword)
    } else {
      onLogin(trimmedUsername, trimmedPassword)
    }
  }

  const displayError = clientError || serverError || ''

  const handleDialogMouseDown = (e: React.MouseEvent<HTMLDialogElement>) => {
    mousedownOnBackdrop.current = e.target === dialogRef.current
  }

  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (mousedownOnBackdrop.current && e.target === dialogRef.current) onClose()
    mousedownOnBackdrop.current = false
  }

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedEmail = forgotEmail.trim()
    if (!trimmedEmail) { setForgotError('Please enter your email address.'); return }
    setForgotLoading(true)
    setForgotError('')
    const ok = await onForgotPassword(trimmedEmail)
    setForgotLoading(false)
    if (ok) {
      setForgotSent(true)
    } else {
      setForgotError('Something went wrong. Please try again.')
    }
  }

  return (
    <dialog ref={dialogRef} className="authDialog" onCancel={onClose} onMouseDown={handleDialogMouseDown} onClick={handleDialogClick}>
      <div className="authDialogHeader">
        <div className="authTabs">
          {!forgotMode && (
            <>
              <button
                className={`authTab${tab === 'login' ? ' authTabActive' : ''}`}
                type="button"
                onClick={() => setTab('login')}
              >
                Log in
              </button>
              <button
                className={`authTab${tab === 'register' ? ' authTabActive' : ''}`}
                type="button"
                onClick={() => setTab('register')}
              >
                Register
              </button>
            </>
          )}
          {forgotMode && (
            <button className="authTab authTabActive" type="button" disabled>
              Reset password
            </button>
          )}
        </div>
        <button className="authDialogClose" type="button" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      {forgotMode ? (
        forgotSent ? (
          <div className="authForm">
            <p className="authSuccess">Check your inbox — we sent you a password reset link.</p>
            <button type="button" className="authForgotLink" onClick={() => setForgotMode(false)}>
              ← Back to log in
            </button>
          </div>
        ) : (
          <form className="authForm" onSubmit={(e) => void handleForgotSubmit(e)}>
            <label className="label" htmlFor="forgotEmail">Email</label>
            <input
              id="forgotEmail"
              name="email"
              type="email"
              className="input"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              autoComplete="email"
              autoFocus
            />
            {forgotError && <p className="authError">{forgotError}</p>}
            <button type="submit" className="playButton" disabled={forgotLoading}>
              {forgotLoading ? 'Sending…' : 'Send reset link'}
            </button>
            <button type="button" className="authForgotLink" onClick={() => setForgotMode(false)}>
              ← Back to log in
            </button>
          </form>
        )
      ) : (
        <form className="authForm" onSubmit={handleSubmit}>
          <label className="label" htmlFor="authUsername">
            Username <span className="requiredMark">*</span>
          </label>
          <input
            id="authUsername"
            name="username"
            type="text"
            className={`input${touched.username && !username.trim() ? ' inputInvalid' : ''}`}
            value={username}
            onChange={(e) => {
              const val = e.target.value.replace(/[^a-zA-Z0-9._/]/g, '')
              setUsername(val)
            }}
            onBlur={() => markTouched('username')}
            autoComplete="username"
            autoFocus
            maxLength={15}
          />

          {tab === 'register' && (
            <>
              <label className="label" htmlFor="authEmail">
                Email <span className="requiredMark">*</span>
              </label>
              <input
                id="authEmail"
                name="email"
                type="email"
                className={`input${emailInvalid ? ' inputInvalid' : ''}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => markTouched('email')}
                autoComplete="email"
              />
            </>
          )}

          <label className="label" htmlFor="authPassword">
            Password <span className="requiredMark">*</span>
          </label>
          <input
            id="authPassword"
            name="password"
            type="password"
            className={`input${passInvalid ? ' inputInvalid' : ''}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => markTouched('password')}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            maxLength={20}
          />

          {tab === 'register' && (
            <>
              <label className="label" htmlFor="authConfirmPassword">
                Confirm Password <span className="requiredMark">*</span>
              </label>
              <input
                id="authConfirmPassword"
                name="confirmPassword"
                type="password"
                className={`input${confirmInvalid ? ' inputInvalid' : ''}`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => markTouched('confirmPassword')}
                autoComplete="new-password"
                maxLength={20}
              />
            </>
          )}

          {displayError && <p className="authError">{displayError}</p>}

          <button type="submit" className="playButton" disabled={loading}>
            {loading ? 'Please wait…' : tab === 'login' ? 'Log in' : 'Create account'}
          </button>

          {tab === 'login' && (
            <button type="button" className="authForgotLink" onClick={() => setForgotMode(true)}>
              Forgot password?
            </button>
          )}
        </form>
      )}
    </dialog>
  )
}
