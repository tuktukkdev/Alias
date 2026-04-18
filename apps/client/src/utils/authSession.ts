import type { AuthUser } from '../types/auth'

// ключ для хранения данных авторизации в localStorage
const AUTH_KEY = 'alias_auth_user'

// достаем сохраненного юзера из localStorage
export function getStoredAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

// сохраняем юзера в localStorage
export function setStoredAuthUser(user: AuthUser): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user))
}

// удаляем юзера из localStorage при логауте
export function clearStoredAuthUser(): void {
  localStorage.removeItem(AUTH_KEY)
}
