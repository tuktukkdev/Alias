import type { AuthUser } from '../types/auth'

const AUTH_KEY = 'alias_auth_user'

export function getStoredAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function setStoredAuthUser(user: AuthUser): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user))
}

export function clearStoredAuthUser(): void {
  localStorage.removeItem(AUTH_KEY)
}
