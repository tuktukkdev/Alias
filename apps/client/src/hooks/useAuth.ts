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

// опции для хука авторизации
interface UseAuthOptions {
  onLoginSuccess: (user: AuthUser) => void
  onLogout: () => void
}

// хук для управления авторизацией юзера
export function useAuth({ onLoginSuccess, onLogout }: UseAuthOptions) {
  // текущий авторизованный юзер, берем из localStorage при инициализации
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => getStoredAuthUser())
  const [authModal, setAuthModal] = useState<'login' | 'register' | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  // обработка успешной авторизации, сохраняем юзера и ищем его комнату
  const handleAuthSuccess = async (data: { id: number; username: string; avatarUrl?: string | null; email?: string | null; emailVerified?: boolean }) => {
    const user: AuthUser = { id: String(data.id), name: data.username, avatarUrl: data.avatarUrl ?? null, email: data.email ?? null, emailVerified: data.emailVerified ?? false }
    setStoredAuthUser(user)
    setAuthUser(user)
    setAuthModal(null)
    setAuthError('')
    onLoginSuccess(user)

    // пробуем найти комнату юзера для автореконнекта
    try {
      const roomResponse = await findMyRoomRequest(String(data.id))
      if (roomResponse.ok) {
        return (await roomResponse.json()) as { roomId: string; playerId: string }
      }
    } catch {
    }
    return null
  }

  // логин по юзернейму и паролю
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

  // регистрация нового юзера
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

  // логаут, чистим localStorage
  const handleLogout = () => {
    clearStoredAuthUser()
    setAuthUser(null)
    onLogout()
  }

  // обновление данных юзера (имя, аватар итд)
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
