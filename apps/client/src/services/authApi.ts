import { API_BASE } from '../config/client'

export interface AuthResponse {
  id: number
  username: string
  avatarUrl?: string | null
  email?: string | null
  emailVerified?: boolean
}

export interface AuthErrorResponse {
  error: string
}

export async function loginRequest(username: string, password: string): Promise<Response> {
  return fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

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

export async function parseAuthResponse(response: Response): Promise<AuthResponse> {
  return response.json() as Promise<AuthResponse>
}

export async function parseAuthErrorResponse(response: Response): Promise<string> {
  const data = (await response.json()) as AuthErrorResponse
  return data.error ?? 'Unknown error'
}

export async function verifyEmailRequest(token: string): Promise<Response> {
  return fetch(`${API_BASE}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
}

export async function requestPasswordResetRequest(email: string): Promise<Response> {
  return fetch(`${API_BASE}/auth/request-password-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
}

export async function resetPasswordRequest(token: string, newPassword: string): Promise<Response> {
  return fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  })
}

export async function resendVerificationRequest(userId: string): Promise<Response> {
  return fetch(`${API_BASE}/auth/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: Number(userId) }),
  })
}
