import { API_BASE } from '../config/client'

// интерфейс ответа при авторизации
export interface AuthResponse {
  id: number
  username: string
  avatarUrl?: string | null
  email?: string | null
  emailVerified?: boolean
}

// интерфейс ошибки авторизации
export interface AuthErrorResponse {
  error: string
}

// запрос на логин
export async function loginRequest(username: string, password: string): Promise<Response> {
  return fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

// запрос на регистрацию
export async function registerRequest(
  username: string,
  email: string,
  password: string,
): Promise<Response> {
  return fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  })
}

// парсим ответ авторизации
export async function parseAuthResponse(response: Response): Promise<AuthResponse> {
  return response.json() as Promise<AuthResponse>
}

// парсим ошибку авторизации
export async function parseAuthErrorResponse(response: Response): Promise<string> {
  const data = (await response.json()) as AuthErrorResponse
  return data.error ?? 'Unknown error'
}

// запрос на верификацию email по токену
export async function verifyEmailRequest(token: string): Promise<Response> {
  return fetch(`${API_BASE}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
}

// запрос на сброс пароля
export async function requestPasswordResetRequest(email: string): Promise<Response> {
  return fetch(`${API_BASE}/auth/request-password-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

// запрос на установку нового пароля по токену
export async function resetPasswordRequest(token: string, newPassword: string): Promise<Response> {
  return fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  })
}

// повторная отправка письма верификации
export async function resendVerificationRequest(userId: string): Promise<Response> {
  return fetch(`${API_BASE}/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: Number(userId) }),
  })
}

// проверяем верифицирован ли email у юзера
export async function fetchEmailVerifiedRequest(userId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/auth/profile/${encodeURIComponent(userId)}`)
  if (!res.ok) return false
  const data = (await res.json()) as { emailVerified: boolean }
  return data.emailVerified
}
