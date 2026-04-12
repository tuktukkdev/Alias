import { useState } from 'react'
import {
  loginRequest,
  parseAuthErrorResponse,
  parseAuthResponse,
  registerRequest,
} from '../services/authApi'
import { findMyRoomRequest } from '../services/roomApi'
import type { AuthUser } from '../types/auth'
import { clearStoredAuthUser, getStoredAuthUser, setStoredAuthUser } from '../utils/authSession'

interface UseAuthOptions {
  onLoginSuccess: (user: AuthUser) => void
  onLogout: () => void
}

export function useAuth({ onLoginSuccess, onLogout }: UseAuthOptions) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => getStoredAuthUser())
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  const handleAuthSuccess = async (data: { id: number; username: string; avatarUrl?: string | null; email?: string | null; emailVerified?: boolean }) => {
    const user: AuthUser = { id: String(data.id), name: data.username, avatarUrl: data.avatarUrl ?? null, email: data.email ?? null, emailVerified: data.emailVerified ?? false }
    setStoredAuthUser(user)
    setAuthUser(user)
    setAuthModal(null)
    setAuthError('')
    onLoginSuccess(user)

    try {
      const roomResponse = await findMyRoomRequest(String(data.id))
      if (roomResponse.ok) {
        return (await roomResponse.json()) as { roomId: string; playerId: string }
      }
    } catch {
      // Non-critical: proceed without rejoin on network error.
    }
    return null
  }

  const handleLogin = async (username: string, password: string) => {
    setAuthLoading(true)
    setAuthError('')
    try {
      const response = await loginRequest(username, password)
      if (!response.ok) {
        setAuthError(await parseAuthErrorResponse(response))
        return null
      }
      const data = await parseAuthResponse(response)
      return await handleAuthSuccess(data)
    } catch {
      setAuthError('Could not reach the server. Is it running?')
      return null
    } finally {
      setAuthLoading(false)
    }
  }

  const handleRegister = async (username: string, email: string, password: string) => {
    setAuthLoading(true)
    setAuthError('')
    try {
      const response = await registerRequest(username, email, password)
      if (!response.ok) {
        setAuthError(await parseAuthErrorResponse(response))
        return null
      }
      const data = await parseAuthResponse(response)
      return await handleAuthSuccess(data)
    } catch {
      setAuthError('Could not reach the server. Is it running?')
      return null
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    clearStoredAuthUser()
    setAuthUser(null)
    onLogout()
  }

  const updateAuthUser = (updater: (prev: AuthUser) => AuthUser) => {
    setAuthUser((prev) => {
      if (!prev) return prev
      const updated = updater(prev)
      setStoredAuthUser(updated)
      return updated
    })
  }

  return {
    authUser,
    authModal,
    authLoading,
    authError,
    setAuthModal,
    setAuthError,
    handleLogin,
    handleRegister,
    handleLogout,
    updateAuthUser,
  }
}
