import { useEffect, useRef, useState, type FormEvent } from 'react'

type AuthTab = 'login' | 'register'

interface AuthModalProps {
  initialTab?: AuthTab
  serverError?: string
  loading?: boolean
  onClose: () => void
  onLogin: (username: string, password: string) => void
  onRegister: (username: string, email: string, password: string) => void
}

export function AuthModal({
  initialTab = 'login',
  serverError,
  loading,
  onClose,
  onLogin,
  onRegister,
}: AuthModalProps) {
  const [tab, setTab] = useState<AuthTab>(initialTab)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [clientError, setClientError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  useEffect(() => {
    setUsername('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setClientError('')
  }, [tab])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setClientError('')

    const trimmedUsername = username.trim()
    const trimmedPassword = password.trim()

    if (!trimmedUsername || !trimmedPassword) {
      setClientError('Please fill in all fields.')
      return
    }

    if (tab === 'register') {
      const trimmedEmail = email.trim()
      if (!trimmedEmail) {
        setClientError('Please enter your email.')
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

  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose()
  }

  return (
    <dialog ref={dialogRef} className="authDialog" onCancel={onClose} onClick={handleDialogClick}>
      <div className="authDialogHeader">
        <div className="authTabs">
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
        </div>
        <button className="authDialogClose" type="button" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      <form className="authForm" onSubmit={handleSubmit}>
        <label className="label" htmlFor="authUsername">
          Username
        </label>
        <input
          id="authUsername"
          name="username"
          type="text"
          className="input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
        />

        {tab === 'register' && (
          <>
            <label className="label" htmlFor="authEmail">
              Email
            </label>
            <input
              id="authEmail"
              name="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </>
        )}

        <label className="label" htmlFor="authPassword">
          Password
        </label>
        <input
          id="authPassword"
          name="password"
          type="password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
        />

        {tab === 'register' && (
          <>
            <label className="label" htmlFor="authConfirmPassword">
              Confirm Password
            </label>
            <input
              id="authConfirmPassword"
              name="confirmPassword"
              type="password"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </>
        )}

        {displayError && <p className="authError">{displayError}</p>}

        <button type="submit" className="playButton" disabled={loading}>
          {loading ? 'Please wait…' : tab === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
    </dialog>
  )
}
