import { useRef, useState } from 'react'
import { API_BASE } from '../config/client'
import { resendVerificationRequest } from '../services/authApi'
import type { AuthUser } from '../types/auth'
import './ProfileScreen.css'

interface ProfileScreenProps {
  user: AuthUser
  onBack: () => void
  onUsernameChanged: (newUsername: string) => void
  onAvatarChanged: (url: string) => void
  onEmailVerified: () => void
}

export function ProfileScreen({ user, onBack, onUsernameChanged, onAvatarChanged, onEmailVerified }: ProfileScreenProps) {
  const [newUsername, setNewUsername] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [usernameSuccess, setUsernameSuccess] = useState('')
  const [usernameLoading, setUsernameLoading] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)

  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarError, setAvatarError] = useState('')
  const [avatarSuccess, setAvatarSuccess] = useState('')
  const [avatarLoading, setAvatarLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [emailVerified, setEmailVerified] = useState(user.emailVerified ?? false)
  const [resendLoading, setResendLoading] = useState(false)
  const [resendMessage, setResendMessage] = useState('')
  const [resendError, setResendError] = useState('')

  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = newUsername.trim()
    if (!trimmed) {
      setUsernameError('Enter a new username.')
      return
    }
    if (trimmed === user.name) {
      setUsernameError('New username is the same as current.')
      return
    }
    setUsernameLoading(true)
    setUsernameError('')
    setUsernameSuccess('')
    try {
      const res = await fetch(`${API_BASE}/auth/profile/username`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: Number(user.id), username: trimmed }),
      })
      const data = (await res.json()) as { username?: string; error?: string }
      if (!res.ok) {
        setUsernameError(data.error ?? 'Failed to update username.')
        return
      }
      setUsernameSuccess('Username updated.')
      setNewUsername('')
      onUsernameChanged(data.username ?? trimmed)
    } catch {
      setUsernameError('Could not reach the server.')
    } finally {
      setUsernameLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setAvatarError('Please select a JPEG, PNG, GIF or WebP image.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Image must be 2 MB or smaller.')
      return
    }
    setAvatarError('')
    setAvatarSuccess('')
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleAvatarUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!avatarPreview || !avatarFile) {
      setAvatarError('Please select an image first.')
      return
    }
    setAvatarLoading(true)
    setAvatarError('')
    setAvatarSuccess('')
    try {
      const res = await fetch(`${API_BASE}/auth/profile/picture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: Number(user.id), imageData: avatarPreview }),
      })
      const data = (await res.json()) as { avatarUrl?: string; error?: string }
      if (!res.ok) {
        setAvatarError(data.error ?? 'Failed to upload picture.')
        return
      }
      setAvatarSuccess('Profile picture updated.')
      setAvatarPreview(null)
      setAvatarFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      onAvatarChanged(data.avatarUrl ?? '')
    } catch {
      setAvatarError('Could not reach the server.')
    } finally {
      setAvatarLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentPassword) {
      setPasswordError('New password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }
    setPasswordLoading(true)
    setPasswordError('')
    setPasswordSuccess('')
    try {
      const res = await fetch(`${API_BASE}/auth/profile/password`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: Number(user.id), currentPassword, newPassword }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) {
        setPasswordError(data.error ?? 'Failed to update password.')
        return
      }
      setPasswordSuccess('Password updated.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      setPasswordError('Could not reach the server.')
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleResendVerification = async () => {
    setResendLoading(true)
    setResendMessage('')
    setResendError('')
    try {
      const res = await resendVerificationRequest(user.id)
      if (res.status === 409) {
        setEmailVerified(true)
        onEmailVerified()
        setResendMessage('Your email is already verified.')
        return
      }
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        setResendError(data.error ?? 'Failed to send verification email.')
        return
      }
      setResendMessage('Verification email sent! Check your inbox.')
    } catch {
      setResendError('Could not reach the server.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <main className="screen">
      <section className="panel profilePanel">
        <div className="profileHeader">
          <button type="button" className="backButton" onClick={onBack}>
            ← Back
          </button>
          <h1 className="title">Profile</h1>
        </div>

        <p className="profileCurrentName">
          Current username: <strong>{user.name}</strong>
        </p>

        {/* ── Email verification status ── */}
        {user.email && (
          <>
            <div className="emailVerificationRow">
              <span className="profileCurrentName">
                Email: <strong>{user.email}</strong>
              </span>
              {emailVerified ? (
                <span className="emailBadgeVerified">✓ Verified</span>
              ) : (
                <span className="emailBadgeUnverified">✗ Not verified</span>
              )}
            </div>
            {!emailVerified && (
              <div className="emailVerificationActions">
                {resendMessage && <p className="formSuccess">{resendMessage}</p>}
                {resendError && <p className="formError">{resendError}</p>}
                <button
                  type="button"
                  className="backButton"
                  onClick={() => void handleResendVerification()}
                  disabled={resendLoading}
                >
                  {resendLoading ? 'Sending…' : 'Resend verification email'}
                </button>
              </div>
            )}
            <hr className="profileDivider" />
          </>
        )}

        {/* ── Profile picture ── */}
        <form className="profileForm" onSubmit={(e) => void handleAvatarUpload(e)}>
          <h2 className="sectionTitle">Profile Picture</h2>
          <div className="avatarPreviewWrap">
            {(avatarPreview ?? user.avatarUrl) ? (
              <img
                className="avatarPreviewImg"
                src={avatarPreview ?? user.avatarUrl ?? ''}
                alt="Profile preview"
              />
            ) : (
              <span className="avatarPreviewDefault">
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
              </span>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="backButton"
            onClick={() => fileInputRef.current?.click()}
          >
            Choose image…
          </button>
          {avatarFile && <p className="profileCurrentName">{avatarFile.name}</p>}
          {avatarError && <p className="formError">{avatarError}</p>}
          {avatarSuccess && <p className="formSuccess">{avatarSuccess}</p>}
          <button type="submit" className="playButton" disabled={!avatarFile || avatarLoading}>
            {avatarLoading ? 'Uploading…' : 'Upload Picture'}
          </button>
        </form>

        <hr className="profileDivider" />

        <form className="profileForm" onSubmit={(e) => void handleUsernameSubmit(e)}>
          <h2 className="sectionTitle">Change Username</h2>
          <label className="label" htmlFor="newUsername">
            New username
          </label>
          <input
            id="newUsername"
            className="input"
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            maxLength={64}
            autoComplete="username"
          />
          {usernameError && <p className="formError">{usernameError}</p>}
          {usernameSuccess && <p className="formSuccess">{usernameSuccess}</p>}
          <button type="submit" className="playButton" disabled={usernameLoading}>
            {usernameLoading ? 'Saving…' : 'Update Username'}
          </button>
        </form>

        <hr className="profileDivider" />

        <form className="profileForm" onSubmit={(e) => void handlePasswordSubmit(e)}>
          <h2 className="sectionTitle">Change Password</h2>
          <label className="label" htmlFor="currentPassword">
            Current password
          </label>
          <input
            id="currentPassword"
            className="input"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password"
          />
          <label className="label" htmlFor="newPassword">
            New password
          </label>
          <input
            id="newPassword"
            className="input"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
          />
          <label className="label" htmlFor="confirmPassword">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            className="input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          {passwordError && <p className="formError">{passwordError}</p>}
          {passwordSuccess && <p className="formSuccess">{passwordSuccess}</p>}
          <button type="submit" className="playButton" disabled={passwordLoading}>
            {passwordLoading ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </section>
    </main>
  )
}
