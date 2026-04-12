import { useEffect, useRef, useState, type FormEvent } from 'react'
import './AuthModal.css'

interface ResetPasswordModalProps {
  onClose: () => void
  onSubmit: (newPassword: string) => Promise<string | null>
}

export function ResetPasswordModal({ onClose, onSubmit }: ResetPasswordModalProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)
    const err = await onSubmit(newPassword)
    setLoading(false)
    if (err) { setError(err); return }
    setSuccess(true)
  }

  return (
    <dialog ref={dialogRef} className="authDialog" onCancel={onClose}>
      <div className="authDialogHeader">
        <div className="authTabs">
          <button className="authTab authTabActive" type="button" disabled>
            New password
          </button>
        </div>
        <button className="authDialogClose" type="button" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        </button>
      </div>

      {success ? (
        <div className="authForm">
          <p className="authSuccess">Password updated! You can now log in with your new password.</p>
          <button type="button" className="playButton" onClick={onClose}>
            Log in
          </button>
        </div>
      ) : (
        <form className="authForm" onSubmit={(e) => void handleSubmit(e)}>
          <label className="label" htmlFor="resetNewPassword">New password</label>
          <input
            id="resetNewPassword"
            name="newPassword"
            type="password"
            className="input"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
          />
          <label className="label" htmlFor="resetConfirmPassword">Confirm password</label>
          <input
            id="resetConfirmPassword"
            name="confirmPassword"
            type="password"
            className="input"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          {error && <p className="authError">{error}</p>}
          <button type="submit" className="playButton" disabled={loading}>
            {loading ? 'Saving…' : 'Set new password'}
          </button>
        </form>
      )}
    </dialog>
  )
}
